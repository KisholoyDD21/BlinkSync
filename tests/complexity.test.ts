import { describe, expect, it } from 'vitest';
import { analyzeComplexity } from '../src/shared/complexity';

describe('analyzeComplexity', () => {
  it('detects sorting', () => expect(analyzeComplexity('arr.sort()').patterns).toContain('Sorting'));
  it('detects nested iteration', () => expect(analyzeComplexity('for (;;) { for (;;) {} }').time).toMatch(/O\(n²\)/));
  it('does not claim certainty', () => expect(analyzeComplexity('return x;').confidence).toBe('low'));
  it('recognizes BFS-like code', () => expect(analyzeComplexity('queue = []; visited = set(); while(queue) { neighbors(); }').time).toBe('O(V + E)'));
});
