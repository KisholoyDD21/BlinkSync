import type { LeetCodeSubmission, ReviewRecord } from '../shared/types';
import { getReviews, saveReviews } from './storage';

let reviewMutation = Promise.resolve();

function serializeReviewMutation<T>(task: () => Promise<T>): Promise<T> {
  const operation = reviewMutation.then(task);
  reviewMutation = operation.then(() => undefined, () => undefined);
  return operation;
}

const INTERVALS: Record<string, number[]> = {
  easy: [2, 5, 12, 30, 60],
  medium: [1, 3, 7, 18, 35],
  hard: [1, 2, 5, 12, 28],
};

export function scheduleFirstReview(submission: LeetCodeSubmission): Promise<ReviewRecord> {
  return serializeReviewMutation(async () => {
    const records = await getReviews();
    const existing = records.find((item) => item.problemSlug === submission.question.titleSlug);
    if (existing) return existing;
    const intervalDays = INTERVALS[submission.question.difficulty.toLowerCase()]?.[0] ?? 2;
    const record: ReviewRecord = {
      problemSlug: submission.question.titleSlug,
      problemTitle: submission.question.title,
      problemNumber: submission.question.questionId,
      difficulty: submission.question.difficulty,
      topics: submission.question.topicTags.map((tag) => tag.name),
      repetitions: 0,
      intervalDays,
      dueAt: Date.now() + intervalDays * 86_400_000,
    };
    await saveReviews([record, ...records]);
    return record;
  });
}

export function markReviewDone(problemSlug: string, rating: 'again' | 'good'): Promise<ReviewRecord> {
  return serializeReviewMutation(async () => {
    const records = await getReviews();
    const index = records.findIndex((item) => item.problemSlug === problemSlug);
    if (index < 0) throw new Error('No review schedule exists for this problem.');
    const old = records[index]!;
    const repetitions = rating === 'again' ? 0 : old.repetitions + 1;
    const intervals = INTERVALS[old.difficulty.toLowerCase()] ?? [2, 5, 12, 30, 60];
    const intervalDays = rating === 'again' ? 1 : intervals[Math.min(repetitions, intervals.length - 1)]!;
    const updated: ReviewRecord = {
      ...old, repetitions, intervalDays, dueAt: Date.now() + intervalDays * 86_400_000, lastReviewedAt: Date.now(),
    };
    records[index] = updated;
    await saveReviews(records);
    return updated;
  });
}
