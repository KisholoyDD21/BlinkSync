import { describe, expect, it } from 'vitest';
import { renderFilePath } from '../src/shared/path';
import type { LeetCodeSubmission } from '../src/shared/types';

const sample: LeetCodeSubmission = {
  submissionId: '123456', status: 'Accepted', code: 'print(1)', lang: 'python3',
  question: { questionId: '1', title: 'Two Sum', titleSlug: 'two-sum', difficulty: 'Easy', topicTags: [{ name: 'Array' }] },
};

describe('renderFilePath', () => {
  it('renders normalized paths and language extensions', () => {
    expect(renderFilePath('{difficulty}/{problemNumber}-{problemSlug}/solution.{extension}', sample))
      .toBe('easy/0001-two-sum/solution.py');
  });
  it('rejects traversal templates and sanitizes untrusted metadata segments', () => {
    expect(() => renderFilePath('../{problemSlug}/solution.{extension}', sample)).toThrow(/unsafe/);
    expect(() => renderFilePath('{difficulty}/{unknown}/solution.{extension}', sample)).toThrow(/Unknown path placeholder/);
    const suspicious = { ...sample, question: { ...sample.question, difficulty: '../../private' } };
    expect(renderFilePath('{difficulty}/{problemSlug}/solution.{extension}', suspicious))
      .toBe('private/two-sum/solution.py');
  });
});
