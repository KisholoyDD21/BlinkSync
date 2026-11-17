import type { BlinkConfig, SubmissionCandidate } from './types';

export function parseSubmissionId(input: string): string | null {
  const value = input.trim();
  const urlMatch = value.match(/\/submissions?\/(?:detail\/)?(\d{1,10})(?:\/|$)/i);
  if (urlMatch?.[1]) return urlMatch[1];
  return /^\d{1,10}$/.test(value) && Number(value) <= 2_147_483_647 ? value : null;
}

export function validateCandidate(value: unknown): value is SubmissionCandidate {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SubmissionCandidate>;
  return typeof candidate.submissionId === 'string'
    && /^\d{1,10}$/.test(candidate.submissionId)
    && Number(candidate.submissionId) <= 2_147_483_647
    && typeof candidate.observedAt === 'number'
    && Number.isFinite(candidate.observedAt)
    && ['network', 'dom', 'manual'].includes(candidate.source ?? '');
}

function isValidBranchName(branch: string): boolean {
  if (branch.length === 0 || branch.length > 240 || branch === '@') return false;
  if (/[\x00-\x20\x7f~^:?*\\\[\]]/.test(branch)) return false;
  if (branch.startsWith('/') || branch.endsWith('/') || branch.includes('//') || branch.includes('..') || branch.includes('@{')) return false;
  // Git forbids dot-prefixed/dot-suffixed ref components and any component ending in .lock.
  return branch.split('/').every((component) =>
    component.length > 0 && !component.startsWith('.') && !component.endsWith('.') && !component.endsWith('.lock'));
}

export function validateConfig(value: unknown): value is BlinkConfig {
  if (!value || typeof value !== 'object') return false;
  const config = value as Partial<BlinkConfig>;
  return typeof config.repo === 'string'
    && config.repo.length <= 200
    && (config.repo === '' || (/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(config.repo)
      && config.repo.split('/').every((part) => part !== '.' && part !== '..')))
    && (!config.enabled || config.repo.length > 0)
    && typeof config.branch === 'string'
    && config.branch.trim().length > 0
    && isValidBranchName(config.branch)
    && typeof config.enabled === 'boolean'
    && typeof config.consentGranted === 'boolean'
    && typeof config.fileTemplate === 'string'
    && config.fileTemplate.trim().length > 0
    && config.fileTemplate.length <= 240
    && typeof config.commitTemplate === 'string'
    && config.commitTemplate.trim().length > 0
    && config.commitTemplate.length <= 180
    && (config.duplicateMode === 'overwrite' || config.duplicateMode === 'version')
    && typeof config.spacedRepetitionEnabled === 'boolean'
    && typeof config.includeProblemDescription === 'boolean'
    && typeof config.contestSafeMode === 'boolean'
    && (!config.enabled || config.consentGranted)
    && (config.contestReleaseAt === null || (typeof config.contestReleaseAt === 'number' && Number.isFinite(config.contestReleaseAt)));
}

export function isLeetCodeSender(url?: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && (parsed.hostname === 'leetcode.com' || parsed.hostname.endsWith('.leetcode.com'));
  } catch {
    return false;
  }
}
