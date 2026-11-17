import {
  CONTEST_RELEASE_ALARM, MAX_QUEUE_ITEMS, MAX_RETRIES, RETRY_ALARM,
} from '../shared/constants';
import type { BlinkConfig, LeetCodeSubmission, QueueItem, SubmissionCandidate, SyncPayload, SyncRecord } from '../shared/types';
import { fetchAcceptedSubmission, LeetCodeAuthError, LeetCodeTransientError } from './leetcode';
import { createAtomicSolutionCommit, GitHubApiError } from './github';
import { scheduleFirstReview } from './reviews';
import {
  addHistory, getConfig, getHistory, getQueue, getReviews, getToken, hasCompleted, markCompleted,
  removeQueueItem, upsertQueueItem,
} from './storage';

const inFlight = new Map<string, Promise<SyncRecord>>();
const pushInFlight = new Map<string, Promise<SyncRecord>>();

function queueKey(submissionId: string): string { return `leetcode:${submissionId}`; }

async function requireToken(): Promise<string> {
  const token = await getToken();
  if (!token) throw new Error('GitHub is not connected. Add a fine-grained token in BlinkSync settings.');
  return token;
}

function makeCandidateRecord(candidate: SubmissionCandidate, status: SyncRecord['status'], message: string): SyncRecord {
  return {
    key: queueKey(candidate.submissionId),
    submissionId: candidate.submissionId,
    problemTitle: 'Submission awaiting details',
    problemSlug: '',
    difficulty: 'Unknown',
    topics: [],
    path: '',
    status,
    createdAt: Date.now(),
    message,
  };
}

function makeRecord(payload: SyncPayload, status: SyncRecord['status'], message?: string): SyncRecord {
  return {
    key: queueKey(payload.submission.submissionId),
    submissionId: payload.submission.submissionId,
    problemTitle: payload.submission.question.title,
    problemSlug: payload.submission.question.titleSlug,
    difficulty: payload.submission.question.difficulty,
    topics: payload.submission.question.topicTags.map((tag) => tag.name),
    path: '',
    status,
    createdAt: Date.now(),
    ...(message ? { message } : {}),
  };
}

async function writeToGitHub(payload: SyncPayload): Promise<SyncRecord> {
  const startedAt = performance.now();
  const config = await getConfig();
  if (!config.consentGranted) throw new Error('Source-code transfer consent has been withdrawn. Re-enable consent before retrying.');
  const token = await requireToken();
  if (!config.repo) throw new Error('Choose a GitHub repository before enabling automatic sync.');
  const reviews = config.spacedRepetitionEnabled ? await getReviews() : [];
  const review = reviews.find((item) => item.problemSlug === payload.submission.question.titleSlug);
  const result = await createAtomicSolutionCommit(token, config, payload.submission, review ? new Date(review.dueAt) : undefined);
  const record: SyncRecord = {
    ...makeRecord(payload, result.duplicate ? 'duplicate' : 'synced'),
    path: result.path,
    ...(result.commitUrl ? { commitUrl: result.commitUrl } : {}),
    latencyMs: Math.round(performance.now() - startedAt),
    message: result.duplicate ? 'Identical solution and README already exist; no commit created.' : 'Solution and README committed atomically.',
  };
  // A completed ledger entry makes replay safe if the service worker is restarted.
  await markCompleted(record.key);
  await removeQueueItem(record.key);
  await addHistory(record);
  return record;
}

async function writeToGitHubOnce(payload: SyncPayload): Promise<SyncRecord> {
  const key = queueKey(payload.submission.submissionId);
  const active = pushInFlight.get(key);
  if (active) return active;
  const task = writeToGitHub(payload);
  pushInFlight.set(key, task);
  try { return await task; }
  finally { pushInFlight.delete(key); }
}

let queueAdmission = Promise.resolve();

function serializeQueueAdmission<T>(task: () => Promise<T>): Promise<T> {
  const operation = queueAdmission.then(task);
  queueAdmission = operation.then(() => undefined, () => undefined);
  return operation;
}

function enqueueCandidate(candidate: SubmissionCandidate, error: string): Promise<SyncRecord> {
  return serializeQueueAdmission(async () => {
    const key = queueKey(candidate.submissionId);
    const queue = await getQueue();
    const existing = queue.find((item) => item.key === key);
    if (!existing && queue.length >= MAX_QUEUE_ITEMS) throw new Error('BlinkSync retry queue is full. Resolve queued items before accepting more automatic syncs.');
    const item: QueueItem = {
      key,
      candidate,
      attempts: existing?.attempts ?? 0,
      nextAttemptAt: existing?.nextAttemptAt ?? Date.now() + 5_000,
      held: existing?.held ?? false,
      lastError: error,
      ...(existing?.payload ? { payload: existing.payload } : {}),
    };
    await upsertQueueItem(item);
    const record = makeCandidateRecord(candidate, item.held ? 'held' : 'queued', error);
    await addHistory(record);
    if (!item.held) await scheduleRetry(item.nextAttemptAt);
    return record;
  });
}

function enqueue(payload: SyncPayload, held: boolean, error?: string, retryAt?: number): Promise<SyncRecord> {
  return serializeQueueAdmission(async () => {
    const key = queueKey(payload.submission.submissionId);
    const queue = await getQueue();
    const existing = queue.find((item) => item.key === key);
    if (!existing && queue.length >= MAX_QUEUE_ITEMS) throw new Error('BlinkSync retry queue is full. Export or resolve queued items before accepting more automatic syncs.');
    const item: QueueItem = {
      key,
      candidate: payload.candidate,
      payload,
      attempts: existing?.attempts ?? 0,
      nextAttemptAt: existing?.nextAttemptAt ?? retryAt ?? (Date.now() + 5_000),
      held: held || existing?.held === true,
      ...(error ? { lastError: error } : held ? { lastError: 'Held by Contest Safe Mode.' } : existing?.lastError ? { lastError: existing.lastError } : {}),
    };
    await upsertQueueItem(item);
    const record = makeRecord(payload, item.held ? 'held' : 'queued', error ?? (item.held ? 'Held by Contest Safe Mode.' : 'Queued for retry.'));
    await addHistory(record);
    if (!item.held) await scheduleRetry(item.nextAttemptAt);
    return record;
  });
}

async function scheduleRetry(when: number): Promise<void> {
  // Chrome alarms are coarse-grained; a retry never blocks the LeetCode UI.
  await chrome.alarms.create(RETRY_ALARM, { when: Math.max(Date.now() + 30_000, when) });
}

export async function processCandidate(candidate: SubmissionCandidate): Promise<SyncRecord> {
  const key = queueKey(candidate.submissionId);
  const existing = inFlight.get(key);
  if (existing) return existing;
  const task = (async () => {
    const config = await getConfig();
    if (!config.consentGranted) throw new Error('Please review and accept the source-code transfer disclosure in BlinkSync settings.');
    if (!config.enabled && candidate.source !== 'manual') throw new Error('Automatic sync is paused in BlinkSync settings.');
    if (!config.repo) throw new Error('Choose a GitHub repository before syncing.');
    if (await hasCompleted(key)) {
      const previous = (await getHistory()).find((item) => item.key === key);
      if (previous) {
        const record: SyncRecord = { ...previous, status: 'duplicate', createdAt: Date.now(), message: 'This submission has already been synchronized.' };
        await addHistory(record);
        return record;
      }
    }

    // The page event supplies only an untrusted ID. Fetch exact source and revalidate Accepted here.
    let submission: LeetCodeSubmission;
    try {
      submission = await fetchAcceptedSubmission(candidate.submissionId);
    } catch (error) {
      if (error instanceof LeetCodeAuthError) throw error;
      if (error instanceof LeetCodeTransientError) {
        return enqueueCandidate(candidate, `Waiting for LeetCode submission details: ${error.message}`);
      }
      throw error;
    }

    const payload: SyncPayload = { candidate, submission };
    if (config.spacedRepetitionEnabled) await scheduleFirstReview(submission);
    if (config.contestSafeMode) return enqueue(payload, true);

    try {
      return await writeToGitHubOnce(payload);
    } catch (error) {
      if (error instanceof GitHubApiError && error.status === 401) {
        return enqueue(payload, true, 'GitHub token expired or revoked. Reconnect in settings.');
      }
      if (error instanceof GitHubApiError && !error.retryable && error.status !== 409 && error.status !== 422) {
        const record = makeRecord(payload, 'failed', `GitHub rejected the write (HTTP ${error.status}): ${error.message}`);
        await addHistory(record);
        return record;
      }
      const retryAt = error instanceof GitHubApiError ? error.retryAt : undefined;
      return enqueue(payload, false, retryMessage(error, retryAt), retryAt);
    }
  })();
  inFlight.set(key, task);
  try { return await task; }
  finally { inFlight.delete(key); }
}

export async function processManualSubmission(submissionId: string): Promise<SyncRecord> {
  return processCandidate({ submissionId, observedAt: Date.now(), source: 'manual' });
}

function retryDelay(attempt: number): number {
  return Math.min(60_000, 5_000 * (2 ** Math.max(0, attempt - 1)));
}

function messageFor(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown retry error.';
}

function retryMessage(error: unknown, retryAt?: number): string {
  if (error instanceof GitHubApiError && (error.status === 403 || error.status === 429) && retryAt) {
    const minutes = Math.max(1, Math.ceil((retryAt - Date.now()) / 60_000));
    return `GitHub rate limit reached; your solution will be pushed automatically in about ${minutes} minute${minutes === 1 ? '' : 's'}.`;
  }
  return messageFor(error);
}

let flushChain: Promise<void> = Promise.resolve();

export function flushQueue(allowPaused = false): Promise<void> {
  // Serialize queue walkers. Queue mutations remain item-scoped so a new submission
  // arriving during a flush cannot be lost by writing an old full-queue snapshot.
  // allowPaused is reserved for explicit user actions (release/retry), never for alarms.
  const run = flushChain.then(() => flushQueueInternal(allowPaused));
  flushChain = run.catch(() => undefined);
  return run;
}

async function flushQueueInternal(allowPaused: boolean): Promise<void> {
  const queueAtStart = await getQueue();
  const config = await getConfig();
  const token = await getToken();
  if (!config.consentGranted || (!config.enabled && !allowPaused) || !token) {
    const reason = !config.consentGranted
      ? 'Waiting for source-code transfer consent.'
      : !token
        ? 'Waiting for GitHub reconnection.'
        : 'Automatic sync is paused.';
    // Keep the items retryable. Restoring consent/token and testing the connection
    // can resume them without silently converting every item into a permanent hold.
    for (const item of queueAtStart) {
      if (!item.held) await upsertQueueItem({ ...item, lastError: reason });
    }
    await chrome.alarms.clear(RETRY_ALARM);
    return;
  }

  for (const queuedItem of queueAtStart) {
    // Refresh each item before processing; another action may have released or removed it.
    const item = (await getQueue()).find((candidate) => candidate.key === queuedItem.key);
    // Held entries are never processed implicitly. Explicit actions must first
    // unhold only the intended records (especially Contest Safe Mode entries).
    if (!item || item.held) continue;
    if (await hasCompleted(item.key)) {
      await removeQueueItem(item.key);
      continue;
    }
    if (item.nextAttemptAt > Date.now() && !allowPaused) continue;

    let payload = item.payload;
    if (!payload) {
      try {
        const submission = await fetchAcceptedSubmission(item.candidate.submissionId);
        payload = { candidate: item.candidate, submission };
        await upsertQueueItem({ ...item, payload }); // Persist verified source before any GitHub write.
        if (config.spacedRepetitionEnabled) await scheduleFirstReview(submission);
      } catch (error) {
        if (error instanceof LeetCodeAuthError) {
          const updated = { ...item, held: true, lastError: 'LeetCode session expired. Sign in to LeetCode, then retry.' };
          await upsertQueueItem(updated);
          await addHistory(makeCandidateRecord(item.candidate, 'held', updated.lastError));
          continue;
        }
        if (!(error instanceof LeetCodeTransientError)) {
          const updated = { ...item, held: true, lastError: messageFor(error) };
          await upsertQueueItem(updated);
          await addHistory(makeCandidateRecord(item.candidate, 'failed', updated.lastError));
          continue;
        }
        const attempts = item.attempts + 1;
        const exhausted = attempts >= MAX_RETRIES;
        const nextAttemptAt = Date.now() + retryDelay(attempts);
        const updated: QueueItem = exhausted
          ? { ...item, attempts, held: true, lastError: `LeetCode retrieval retry limit reached: ${error.message}` }
          : { ...item, attempts, nextAttemptAt, lastError: error.message };
        await upsertQueueItem(updated);
        await addHistory(makeCandidateRecord(item.candidate, exhausted ? 'failed' : 'queued', updated.lastError!));
        continue;
      }
    }

    try {
      await writeToGitHubOnce(payload);
    } catch (error) {
      const attempts = item.attempts + 1;
      const apiError = error instanceof GitHubApiError ? error : null;
      const exhausted = attempts >= MAX_RETRIES || Boolean(apiError && !apiError.retryable && apiError.status !== 409 && apiError.status !== 422);
      if (apiError?.status === 401) {
        const updated = { ...item, attempts, held: true, lastError: 'GitHub token expired or revoked. Reconnect.' };
        await upsertQueueItem(updated);
        await addHistory(makeRecord(payload, 'failed', updated.lastError));
      } else if (exhausted) {
        const updated = { ...item, attempts, held: true, lastError: messageFor(error) };
        await upsertQueueItem(updated);
        await addHistory(makeRecord(payload, 'failed', `Retry limit reached: ${messageFor(error)}`));
      } else {
        const nextAttemptAt = apiError?.retryAt ?? (Date.now() + retryDelay(attempts));
        const retryReason = retryMessage(error, apiError?.retryAt);
        const updated = { ...item, attempts, nextAttemptAt, lastError: retryReason };
        await upsertQueueItem(updated);
        await addHistory(makeRecord(payload, 'queued', retryReason));
      }
    }
  }

  const latestQueue = await getQueue();
  const due = latestQueue.filter((item) => !item.held).map((item) => item.nextAttemptAt).sort((a, b) => a - b)[0];
  if (due) await scheduleRetry(due);
  else await chrome.alarms.clear(RETRY_ALARM);
}

export async function releaseContestQueue(manual = false): Promise<void> {
  await chrome.alarms.clear(CONTEST_RELEASE_ALARM);
  const config = await getConfig();
  const token = await getToken();
  // Scheduled releases must respect automation pause, consent, and reconnection.
  // Only the explicit Release now action may bypass the automatic-sync toggle.
  if (!manual && (!config.enabled || !config.consentGranted || !token || !config.contestSafeMode || config.contestReleaseAt === null || config.contestReleaseAt > Date.now())) return;
  const queue = await getQueue();
  for (const item of queue) {
    if (item.lastError === 'Held by Contest Safe Mode.') {
      const { lastError: _lastError, ...rest } = item;
      await upsertQueueItem({ ...rest, held: false, nextAttemptAt: Date.now() });
    }
  }
  await flushQueue(manual);
}

export async function retryFailedQueue(): Promise<void> {
  const queue = await getQueue();
  for (const item of queue) {
    // A generic retry button must never release contest-held solutions.
    if (item.lastError === 'Held by Contest Safe Mode.') continue;
    const { lastError: _lastError, ...rest } = item;
    await upsertQueueItem({ ...rest, attempts: 0, held: false, nextAttemptAt: Date.now() });
  }
  await flushQueue(true);
}

export async function configureContestRelease(releaseAt: number | null, enabled: boolean): Promise<void> {
  if (enabled && releaseAt && releaseAt > Date.now()) {
    await chrome.alarms.create(CONTEST_RELEASE_ALARM, { when: releaseAt });
  } else {
    await chrome.alarms.clear(CONTEST_RELEASE_ALARM);
  }
}
