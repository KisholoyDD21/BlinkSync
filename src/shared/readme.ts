import type { ComplexityReport, LeetCodeSubmission } from './types';

function htmlToText(html = ''): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|pre|tr)>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function safeMarkdown(value: string): string {
  return value.replace(/[\r\u0000]/g, '').slice(0, 30_000);
}

export function generateProblemReadme(
  submission: LeetCodeSubmission,
  solutionPath: string,
  complexity: ComplexityReport,
  reviewDue?: Date,
  approachPaths: string[] = [solutionPath],
  includeProblemDescription = false,
): string {
  const q = submission.question;
  const tags = q.topicTags.map((tag) => `\`${tag.name.replace(/[`\r\n]/g, '')}\``).join(', ') || 'Not supplied';
  const leetCodeUrl = `https://leetcode.com/problems/${encodeURIComponent(q.titleSlug)}/`;
  const description = includeProblemDescription
    ? safeMarkdown(htmlToText(q.content))
    : `Full problem statement omitted by default. Open the [LeetCode problem page](${leetCodeUrl}) to read the original statement.`;
  const runtime = submission.runtime ?? 'Not supplied by LeetCode';
  const memory = submission.memory ?? 'Not supplied by LeetCode';
  const runtimePercentile = submission.runtimePercentile == null ? 'Not supplied' : `${submission.runtimePercentile}%`;
  const memoryPercentile = submission.memoryPercentile == null ? 'Not supplied' : `${submission.memoryPercentile}%`;
  const review = reviewDue ? `\n- **Review due:** ${reviewDue.toISOString().slice(0, 10)}` : '';
  const problemNumber = q.questionId.padStart(4, '0');
  const submissionUrl = `https://leetcode.com/submissions/detail/${encodeURIComponent(submission.submissionId)}/`;
  const approaches = [...new Set(approachPaths.length ? approachPaths : [solutionPath])];
  const approachList = approaches.map((path, index) => `- **Approach ${index + 1}:** [${path.split('/').pop()}](./${path.split('/').pop()})`).join('\n');

  return `# ${problemNumber}. ${q.title}

[![LeetCode](https://img.shields.io/badge/LeetCode-${encodeURIComponent(q.difficulty)}-orange)](${leetCodeUrl})

| Field | Value |
|---|---|
| Problem | [${q.title}](${leetCodeUrl}) |
| Difficulty | ${q.difficulty} |
| Language | ${submission.lang} |
| Submission | [${submission.submissionId}](${submissionUrl}) |
| Runtime | ${runtime} |
| Runtime percentile | ${runtimePercentile} |
| Memory | ${memory} |
| Memory percentile | ${memoryPercentile} |${review}

## Topics

${tags}

## Problem description

${description || 'The problem description was not available from the submission detail response.'}

## Approaches\n\n${approachList}\n\nThe complexity summary below applies to the latest accepted approach; earlier variants are retained as separate files.

## Complexity analysis

> **Estimated locally using static heuristics — not a proof.**

- **Time:** ${complexity.time}
- **Space:** ${complexity.space}
- **Detected patterns:** ${complexity.patterns.join(', ')}
- **Confidence:** ${complexity.confidence}

${complexity.caveat}

## Submission

Accepted submission ID: \`${submission.submissionId}\`  
Synced by [BlinkSync](https://github.com/)
`;
}
