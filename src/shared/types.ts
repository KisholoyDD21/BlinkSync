export type DuplicateMode = 'overwrite' | 'version';

export interface BlinkConfig {
  repo: string;
  branch: string;
  enabled: boolean;
  consentGranted: boolean;
  fileTemplate: string;
  commitTemplate: string;
  duplicateMode: DuplicateMode;
  spacedRepetitionEnabled: boolean;
  includeProblemDescription: boolean;
  contestSafeMode: boolean;
  contestReleaseAt: number | null;
}

export interface SubmissionCandidate {
  submissionId: string;
  observedAt: number;
  source: 'network' | 'dom' | 'manual';
}

export interface LeetCodeSubmission {
  submissionId: string;
  status: 'Accepted';
  code: string;
  lang: string;
  runtime?: string;
  memory?: string;
  runtimePercentile?: number;
  memoryPercentile?: number;
  timestamp?: number;
  question: {
    questionId: string;
    title: string;
    titleSlug: string;
    difficulty: string;
    content?: string;
    topicTags: Array<{ name: string; slug?: string }>;
  };
}

export interface ComplexityReport {
  time: string;
  space: string;
  patterns: string[];
  confidence: 'low' | 'medium';
  caveat: string;
}

export interface SyncPayload {
  submission: LeetCodeSubmission;
  candidate: SubmissionCandidate;
}

export interface QueueItem {
  key: string;
  candidate: SubmissionCandidate;
  /** Missing only while LeetCode's submission details are temporarily unavailable. */
  payload?: SyncPayload;
  attempts: number;
  nextAttemptAt: number;
  held: boolean;
  lastError?: string;
}

export interface ReviewRecord {
  problemSlug: string;
  problemTitle: string;
  problemNumber: string;
  difficulty: string;
  topics: string[];
  repetitions: number;
  intervalDays: number;
  dueAt: number;
  lastReviewedAt?: number;
}

export interface SyncRecord {
  key: string;
  submissionId: string;
  problemTitle: string;
  problemSlug: string;
  difficulty: string;
  topics: string[];
  path: string;
  status: 'synced' | 'duplicate' | 'queued' | 'failed' | 'held';
  commitUrl?: string;
  latencyMs?: number;
  createdAt: number;
  message?: string;
}

export type RuntimeMessage =
  | { type: 'SUBMISSION_ACCEPTED'; candidate: SubmissionCandidate }
  | { type: 'SYNC_MANUAL'; submissionId: string }
  | { type: 'SAVE_CONFIG'; config: BlinkConfig }
  | { type: 'SAVE_TOKEN'; token: string }
  | { type: 'CLEAR_TOKEN' }
  | { type: 'TEST_CONNECTION' }
  | { type: 'GET_STATE' }
  | { type: 'GET_REVIEW_STATUS'; problemSlug: string }
  | { type: 'RELEASE_CONTEST_QUEUE' }
  | { type: 'RETRY_FAILED' }
  | { type: 'MARK_REVIEWED'; problemSlug: string; rating: 'again' | 'good' }
  | { type: 'FLUSH_QUEUE' };

export interface RuntimeReply {
  ok: boolean;
  message?: string;
  review?: ReviewRecord;
  state?: {
    config: BlinkConfig;
    connected: boolean;
    history: SyncRecord[];
    queue: QueueItem[];
    reviews: ReviewRecord[];
  };
  connection?: { owner: string; repo: string; isPrivate: boolean; branch: string };
  record?: SyncRecord;
}
