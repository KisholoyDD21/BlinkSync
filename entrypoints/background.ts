import type { RuntimeMessage, RuntimeReply } from '../src/shared/types';
import { isLeetCodeSender, validateCandidate, validateConfig } from '../src/shared/validators';
import { clearToken, getConfig, getHistory, getQueue, getToken, initStorageAccess, saveConfig, saveToken } from '../src/background/storage';
import { processCandidate, processManualSubmission, flushQueue, releaseContestQueue, retryFailedQueue, configureContestRelease } from '../src/background/sync';
import { testGitHubConnection } from '../src/background/github';
import { getReviews } from '../src/background/storage';
import { markReviewDone } from '../src/background/reviews';

export default defineBackground(() => {
  // Register listeners synchronously at module evaluation; service workers are ephemeral.
  void initStorageAccess().catch((error) => console.error('[BlinkSync] Storage access setup failed', error));

  chrome.runtime.onMessage.addListener((message: RuntimeMessage, sender: chrome.runtime.MessageSender, sendResponse: (response?: unknown) => void) => {
    void routeMessage(message, sender)
      .then((reply) => sendResponse(reply))
      .catch((error: unknown) => sendResponse({ ok: false, message: error instanceof Error ? error.message : 'Unexpected extension error.' } satisfies RuntimeReply));
    return true;
  });

  chrome.alarms.onAlarm.addListener((alarm: { name: string }) => {
    if (alarm.name === 'blinksync-retry') void flushQueue().catch((error) => console.error('[BlinkSync] Queue flush failed', error));
    if (alarm.name === 'blinksync-contest-release') void releaseContestQueue(false).catch((error) => console.error('[BlinkSync] Contest release failed', error));
  });

  chrome.runtime.onStartup.addListener(() => {
    void flushQueue().catch((error) => console.error('[BlinkSync] Startup queue flush failed', error));
  });
});


function requireExtensionUiSender(sender: chrome.runtime.MessageSender): void {
  const extensionOrigin = new URL(chrome.runtime.getURL('/')).origin;
  if (!sender.url || new URL(sender.url).origin !== extensionOrigin) {
    throw new Error('This settings action can only be called from a BlinkSync extension page.');
  }
}

function isLeetCodeProblemSender(url: string | undefined, slug: string): boolean {
  if (!isLeetCodeSender(url)) return false;
  try {
    return new URL(url!).pathname.match(/^\/problems\/([^/]+)/)?.[1] === slug;
  } catch {
    return false;
  }
}

async function routeMessage(message: RuntimeMessage, sender: chrome.runtime.MessageSender): Promise<RuntimeReply> {
  switch (message.type) {
    case 'SUBMISSION_ACCEPTED': {
      if (!isLeetCodeSender(sender.url) || !sender.tab?.id || !validateCandidate(message.candidate)) {
        throw new Error('Rejected submission event from an untrusted sender.');
      }
      const record = await processCandidate(message.candidate);
      return { ok: true, record, ...(record.message ? { message: record.message } : {}) };
    }
    case 'SYNC_MANUAL': {
      if (!isLeetCodeSender(sender.url) || !sender.tab?.id || !/^\d{1,20}$/.test(message.submissionId)) {
        throw new Error('Manual sync must originate from a LeetCode tab and use a valid submission ID.');
      }
      const record = await processManualSubmission(message.submissionId);
      return { ok: true, record, ...(record.message ? { message: record.message } : {}) };
    }
    case 'SAVE_CONFIG': {
      requireExtensionUiSender(sender);
      if (!validateConfig(message.config)) throw new Error('Configuration is invalid.');
      await saveConfig(message.config);
      await configureContestRelease(message.config.contestReleaseAt, message.config.contestSafeMode);
      if (!message.config.consentGranted || !message.config.enabled) await chrome.alarms.clear('blinksync-retry');
      else if (message.config.repo && message.config.contestSafeMode && message.config.contestReleaseAt !== null && message.config.contestReleaseAt <= Date.now()) void releaseContestQueue(false).catch((error) => console.error('[BlinkSync] Scheduled contest release failed', error));
      else if (message.config.repo) void flushQueue().catch((error) => console.error('[BlinkSync] Resume after settings save failed', error));
      return { ok: true, message: 'Settings saved.' };
    }
    case 'CLEAR_TOKEN': {
      requireExtensionUiSender(sender);
      await clearToken();
      return { ok: true, message: 'GitHub token cleared for this browser session.' };
    }
    case 'SAVE_TOKEN': {
      requireExtensionUiSender(sender);
      if (typeof message.token !== 'string' || message.token.trim().length < 20 || message.token.length > 500) throw new Error('Enter a valid GitHub token.');
      await saveToken(message.token.trim());
      const config = await getConfig();
      if (config.enabled && config.consentGranted && config.repo && config.contestSafeMode && config.contestReleaseAt !== null && config.contestReleaseAt <= Date.now()) void releaseContestQueue(false).catch((error) => console.error('[BlinkSync] Scheduled contest release after reconnect failed', error));
      else if (config.enabled && config.consentGranted && config.repo) void flushQueue().catch((error) => console.error('[BlinkSync] Resume after token save failed', error));
      return { ok: true, message: 'Token stored for this browser session.' };
    }
    case 'TEST_CONNECTION': {
      requireExtensionUiSender(sender);
      const token = await getToken();
      if (!token) throw new Error('Add a GitHub token first.');
      const config = await getConfig();
      if (!config.repo) throw new Error('Enter a repository in owner/repository format.');
      const connection = await testGitHubConnection(token, config.repo, config.branch);
      if (config.consentGranted && config.enabled) void flushQueue();
      return { ok: true, connection, message: `Connected to ${connection.owner}/${connection.repo} (${connection.isPrivate ? 'private' : 'public'}).` };
    }
    case 'GET_STATE': {
      requireExtensionUiSender(sender);
      return {
        ok: true,
        state: {
          config: await getConfig(),
          connected: Boolean(await getToken()),
          history: await getHistory(),
          queue: await getQueue(),
          reviews: await getReviews(),
        },
      };
    }
    case 'GET_REVIEW_STATUS': {
      if (!sender.tab?.id || typeof message.problemSlug !== 'string' || !/^[a-z0-9-]{1,120}$/.test(message.problemSlug) || !isLeetCodeProblemSender(sender.url, message.problemSlug)) {
        throw new Error('Review status is available only from a valid LeetCode problem page.');
      }
      const review = (await getReviews()).find((item) => item.problemSlug === message.problemSlug && item.dueAt <= Date.now());
      return { ok: true, ...(review ? { review } : {}) };
    }
    case 'RELEASE_CONTEST_QUEUE':
      requireExtensionUiSender(sender);
      await releaseContestQueue(true);
      return { ok: true, message: 'Contest queue released for synchronization.' };
    case 'RETRY_FAILED':
      requireExtensionUiSender(sender);
      await retryFailedQueue();
      return { ok: true, message: 'Failed/held items were re-queued for retry.' };
    case 'MARK_REVIEWED': {
      if (!sender.tab?.id || typeof message.problemSlug !== 'string' || !/^[a-z0-9-]{1,120}$/.test(message.problemSlug) || !isLeetCodeProblemSender(sender.url, message.problemSlug) || !['again', 'good'].includes(message.rating)) {
        throw new Error('Review action must originate from a valid LeetCode problem page.');
      }
      await markReviewDone(message.problemSlug, message.rating);
      return { ok: true, message: 'Review schedule updated.' };
    }
    case 'FLUSH_QUEUE':
      if (!isLeetCodeSender(sender.url)) requireExtensionUiSender(sender);
      await flushQueue();
      return { ok: true, message: 'Retry queue checked.' };
    default:
      throw new Error('Unsupported BlinkSync message.');
  }
}
