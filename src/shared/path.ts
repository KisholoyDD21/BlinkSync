import { extensionForLanguage } from './language';
import type { LeetCodeSubmission } from './types';

export function safeSegment(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100) || 'unknown';
}

export function renderFilePath(template: string, submission: LeetCodeSubmission): string {
  const supported = new Set(['difficulty', 'problemNumber', 'problemSlug', 'extension', 'language']);
  for (const match of template.matchAll(/\{([^{}]+)\}/g)) {
    if (!supported.has(match[1] ?? '')) throw new Error(`Unknown path placeholder: {${match[1]}}`);
  }
  const problemNumber = String(submission.question.questionId).padStart(4, '0');
  const replacements: Record<string, string> = {
    difficulty: safeSegment(submission.question.difficulty || 'unknown'),
    problemNumber,
    problemSlug: safeSegment(submission.question.titleSlug || submission.question.title),
    extension: extensionForLanguage(submission.lang),
    language: safeSegment(submission.lang),
  };
  const rendered = template.replace(/\{(difficulty|problemNumber|problemSlug|extension|language)\}/g,
    (_, key: string) => replacements[key] ?? '');
  const normalized = rendered.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  const parts = normalized.split('/');
  if (!normalized || parts.some((part) => !part || part === '.' || part === '..')) {
    throw new Error('The file template produced an unsafe repository path.');
  }
  return normalized;
}

export function siblingReadmePath(solutionPath: string): string {
  return `${solutionPath.slice(0, solutionPath.lastIndexOf('/') + 1)}README.md`;
}
