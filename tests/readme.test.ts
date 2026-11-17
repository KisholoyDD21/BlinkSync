import { describe, expect, it } from 'vitest';
import { generateProblemReadme } from '../src/shared/readme';
import type { LeetCodeSubmission } from '../src/shared/types';

const payload: LeetCodeSubmission = {
  submissionId: '12345', status: 'Accepted', code: 'return 1;', lang: 'javascript',
  question: { questionId: '1', title: 'Two Sum', titleSlug: 'two-sum', difficulty: 'Easy', content: '<p>Find &amp; return.</p><script>alert(1)</script>', topicTags: [{ name: 'Array' }] },
};

describe('generateProblemReadme', () => {
  it('sanitizes problem description markup', () => {
    const readme = generateProblemReadme(payload, 'Easy/0001-two-sum/solution.js', { time: 'O(n)', space: 'O(1)', patterns: ['Hash map'], confidence: 'low', caveat: 'Check manually.' }, undefined, undefined, true);
    expect(readme).toContain('Find & return.');
    expect(readme).not.toContain('<script>');
    expect(readme).toContain('Complexity analysis');
  });
  it('omits the full problem statement unless explicitly enabled', () => {
    const readme = generateProblemReadme(payload, 'Easy/0001-two-sum/solution.js', { time: 'O(n)', space: 'O(1)', patterns: [], confidence: 'low', caveat: '' });
    expect(readme).toContain('Full problem statement omitted by default');
    expect(readme).not.toContain('Find & return.');
  });
});
