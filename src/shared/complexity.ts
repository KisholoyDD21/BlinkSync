import type { ComplexityReport } from './types';

/**
 * Deliberately heuristic: this is a transparent pattern detector, not an AST proof.
 * It returns conservative estimates and always labels them as estimates.
 */
export function analyzeComplexity(code: string): ComplexityReport {
  const text = code.toLowerCase();
  const patterns: string[] = [];
  let time = 'Not confidently inferred';
  let space = 'Not confidently inferred';
  let confidence: ComplexityReport['confidence'] = 'low';

  const hasNestedLoops = /for\s*\([^)]*\)[\s\S]{0,500}for\s*\(/.test(text)
    || /for\s+\w+\s+in[\s\S]{0,500}for\s+\w+\s+in/.test(text)
    || /while\s*\([^)]*\)[\s\S]{0,500}for\s*\(/.test(text);
  const hasLogLoop = /(?:i|left|right|mid)\s*(?:\*=\s*2|<<=\s*1)/.test(text);
  const hasBinarySearch = /(binary.?search|mid\s*=|middle\s*=)/.test(text)
    && /(left|low)\s*[<>=]|(right|high)\s*[<>=]/.test(text);
  const hasSort = /\.sort\s*\(|sort\s*\(/.test(text);
  const hasHash = /unordered_map|unordered_set|hashmap|hash_map|dict\s*\(|\bmap\s*<|\bset\s*<|\bseen\b|\bvisited\b/.test(text);
  const hasWindow = /(sliding.?window|window.?size|windowstart|windowend)/.test(text)
    || (/\bwhile\s*\(/.test(text) && /(left|start)\s*\+\+/.test(text) && /(right|end)\s*\+\+/.test(text));
  const hasTwoPointers = /(left|slow)\s*[,=].*(right|fast)|(left|right)\s*\+\+/.test(text);
  const hasBfs = /queue|deque|popleft|poll\s*\(/.test(text) && /(visited|neighbors|adj)/.test(text);
  const hasDfs = /\bdfs\s*\(|\bdepthfirst/.test(text) || /visited/.test(text) && /return\s+.*\w+\s*\(/.test(text);
  const hasDp = /\bdp\b|memo(?:ization)?|cache\s*\[/.test(text);
  const hasBacktracking = /(backtrack|choose|unchoose|path\.pop|\.pop\s*\(\))/.test(text)
    && /(\.push\s*\(|append\s*\(|\.add\s*\()/.test(text);
  const hasHeap = /priority.?queue|heapq|heappush|heappop|\bheap\b/.test(text);
  const hasPrefix = /prefix.?sum|prefixsum|running.?sum/.test(text);
  const hasGraph = /adjacency|neighbors|\badj\b|edges\s*\[/.test(text);
  const hasLinearLoop = /for\s*\(|for\s+\w+\s+in|while\s*\(/.test(text);

  if (hasSort) patterns.push('Sorting');
  if (hasBinarySearch) patterns.push('Binary search');
  if (hasWindow) patterns.push('Sliding window');
  if (hasTwoPointers) patterns.push('Two pointers');
  if (hasHash) patterns.push('Hash map / set');
  if (hasBfs) patterns.push('Breadth-first search');
  if (hasDfs) patterns.push('Depth-first search');
  if (hasGraph) patterns.push('Graph representation');
  if (hasDp) patterns.push('Dynamic programming / memoization');
  if (hasBacktracking) patterns.push('Backtracking');
  if (hasHeap) patterns.push('Heap / priority queue');
  if (hasPrefix) patterns.push('Prefix sum');
  if (hasLogLoop) patterns.push('Logarithmic iteration');
  if (hasNestedLoops) patterns.push('Nested iteration');

  if (hasBfs || hasDfs) {
    time = 'O(V + E)';
    space = 'O(V)';
    confidence = 'medium';
  } else if (hasBacktracking) {
    time = 'Potentially exponential (e.g. O(2^n)); depends on branching and pruning';
    space = 'Depends on recursion depth and stored candidates';
    confidence = 'low';
  } else if (hasDp && hasNestedLoops) {
    time = 'Potentially O(n²) or O(n × states); inspect transitions';
    space = 'Potentially O(n) to O(n²)';
    confidence = 'low';
  } else if (hasSort) {
    time = 'At least O(n log n) if the detected sort dominates';
    space = 'Depends on sorting implementation and auxiliary structures';
    confidence = 'medium';
  } else if (hasBinarySearch || hasLogLoop) {
    time = 'Potentially O(log n) for the logarithmic section';
    space = 'O(1) auxiliary space unless recursion or containers are used';
    confidence = 'medium';
  } else if (hasNestedLoops) {
    time = 'Potentially O(n²); verify loop bounds and dependencies';
    space = 'O(1) auxiliary space unless containers are allocated';
    confidence = 'medium';
  } else if (hasLinearLoop || hasHash || hasWindow || hasTwoPointers || hasPrefix) {
    time = 'Potentially O(n)';
    space = hasHash || hasPrefix ? 'Potentially O(n)' : 'Often O(1) auxiliary space';
    confidence = 'low';
  }

  return {
    time,
    space,
    patterns: patterns.length ? [...new Set(patterns)] : ['No recognizable pattern'],
    confidence,
    caveat: 'Static heuristic only. It does not know input constraints, recursion branching, library costs, or loop bounds; verify manually.',
  };
}
