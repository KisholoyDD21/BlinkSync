import type { BlinkConfig } from './types';

export const DEFAULT_CONFIG: BlinkConfig = {
  repo: '',
  branch: 'main',
  enabled: false,
  consentGranted: false,
  fileTemplate: '{difficulty}/{problemNumber}-{problemSlug}/solution.{extension}',
  commitTemplate: 'feat(dsa): solve {problemNumber}. {title}',
  duplicateMode: 'overwrite',
  spacedRepetitionEnabled: false,
  includeProblemDescription: false,
  contestSafeMode: false,
  contestReleaseAt: null,
};

export const STORAGE_KEYS = {
  config: 'config',
  queue: 'queue',
  history: 'history',
  ledger: 'ledger',
  reviews: 'reviews',
} as const;

export const MAX_CODE_BYTES = 1_000_000;
export const MAX_QUEUE_ITEMS = 100;
export const MAX_HISTORY_ITEMS = 250;
export const MAX_RETRIES = 3;
export const RETRY_ALARM = 'blinksync-retry';
export const CONTEST_RELEASE_ALARM = 'blinksync-contest-release';
export const MAIN_WORLD_EVENT = 'blinksync:page-event';
export const MAIN_WORLD_REARM_EVENT = 'blinksync:rearm';
