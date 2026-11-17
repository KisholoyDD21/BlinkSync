import { describe, expect, it } from 'vitest';
import { parseSubmissionId, validateCandidate, validateConfig } from '../src/shared/validators';
import { DEFAULT_CONFIG } from '../src/shared/constants';

describe('submission id validation', () => {
  it('accepts a numeric ID and a LeetCode submission URL', () => {
    expect(parseSubmissionId('123456')).toBe('123456');
    expect(parseSubmissionId('https://leetcode.com/submissions/detail/123456/')).toBe('123456');
  });
  it('rejects strings without an ID', () => {
    expect(parseSubmissionId('not a submission')).toBeNull();
  });
  it('rejects unsafe Git refs and enabled sync without consent', () => {
    for (const branch of ['main..evil', '@', '.main', 'main.', 'feature//test', 'feature/@{x}', 'topic.lock', 'feature/.hidden', 'feature/branch.lock', 'feature/ends.']) {
      expect(validateConfig({ ...DEFAULT_CONFIG, branch })).toBe(false);
    }
    expect(validateConfig({ ...DEFAULT_CONFIG, enabled: true, consentGranted: false })).toBe(false);
    expect(validateConfig({ ...DEFAULT_CONFIG, repo: 'owner/repo', enabled: true, consentGranted: true })).toBe(true);
    expect(validateConfig({ ...DEFAULT_CONFIG, enabled: true, consentGranted: true })).toBe(false);
    expect(validateConfig({ ...DEFAULT_CONFIG, repo: '../repo' })).toBe(false);
  });
  it('validates candidate origin metadata shape', () => {
    expect(validateCandidate({ submissionId: '123456', observedAt: Date.now(), source: 'network' })).toBe(true);
    expect(validateCandidate({ submissionId: 'bad', observedAt: Date.now(), source: 'network' })).toBe(false);
  });
});
