import { MAX_CODE_BYTES } from '../shared/constants';
import type { LeetCodeSubmission } from '../shared/types';

const SUBMISSION_DETAILS_QUERY = `
query submissionDetails($submissionId: Int!) {
  submissionDetails(submissionId: $submissionId) {
    code
    runtime
    memory
    runtimePercentile
    memoryPercentile
    statusCode
    timestamp
    lang { name verboseName }
    question { title titleSlug questionId }
    topicTags { name slug }
  }
}`;

const QUESTION_DETAIL_QUERY = `
query questionDetail($titleSlug: String!) {
  question(titleSlug: $titleSlug) {
    questionFrontendId
    difficulty
    content
    topicTags { name slug }
  }
}`;

interface GraphQLResponse<T> {
  data?: T;
  errors?: unknown[];
}

export class LeetCodeAuthError extends Error {}
export class LeetCodeTransientError extends Error {}

/**
 * LeetCode's GraphQL operations are undocumented integration contracts.
 * Keep requests and schema normalization isolated here and fixture-test them.
 */
async function leetCodeGraphQL<T>(
  query: string,
  operationName: string,
  variables: Record<string, string | number>,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch('https://leetcode.com/graphql/', {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
      },
      signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({ operationName, query, variables }),
    });
  } catch (error) {
    throw new LeetCodeTransientError(error instanceof Error ? error.message : 'LeetCode network request failed.');
  }

  if (response.status === 401 || response.status === 403) {
    throw new LeetCodeAuthError('LeetCode authentication is required. Sign in to LeetCode and retry.');
  }
  if (!response.ok) throw new LeetCodeTransientError(`LeetCode returned HTTP ${response.status}.`);

  try {
    const body = await response.json() as GraphQLResponse<T>;
    if (!body.data) {
      throw new LeetCodeTransientError(body.errors?.length
        ? `LeetCode rejected the ${operationName} GraphQL query. The response schema may have changed.`
        : `LeetCode returned no data for ${operationName}.`);
    }
    return body.data;
  } catch (error) {
    if (error instanceof LeetCodeTransientError) throw error;
    throw new LeetCodeTransientError('LeetCode returned an unreadable GraphQL response.');
  }
}

export async function fetchAcceptedSubmission(submissionId: string): Promise<LeetCodeSubmission> {
  if (!/^\d{1,10}$/.test(submissionId)) throw new Error('Invalid submission ID.');
  const numericSubmissionId = Number(submissionId);
  // The LeetCode GraphQL schema declares Int!, which is a signed 32-bit integer.
  if (!Number.isSafeInteger(numericSubmissionId) || numericSubmissionId > 2_147_483_647) {
    throw new Error('Submission ID is outside LeetCode GraphQL Int range.');
  }

  const data = await leetCodeGraphQL<{ submissionDetails?: Record<string, unknown> }>(
    SUBMISSION_DETAILS_QUERY,
    'submissionDetails',
    { submissionId: numericSubmissionId },
  );
  const result = data.submissionDetails;
  if (!result) throw new LeetCodeTransientError('LeetCode did not return submission details.');

  // LeetCode's accepted status code is 10. Never trust the page's verdict alone.
  if (Number(result.statusCode) !== 10) {
    throw new Error(`Submission revalidation failed: LeetCode status code is ${String(result.statusCode ?? 'unknown')}.`);
  }
  if (typeof result.code !== 'string' || !result.code.trim()) throw new LeetCodeTransientError('LeetCode did not return the submitted source code.');
  if (new TextEncoder().encode(result.code).byteLength > MAX_CODE_BYTES) throw new Error('Submission source exceeds the 1 MB safety limit.');

  const rawQuestion = result.question as Record<string, unknown> | undefined;
  if (!rawQuestion) throw new LeetCodeTransientError('LeetCode did not return problem metadata.');
  const title = String(rawQuestion.title ?? '');
  const titleSlug = String(rawQuestion.titleSlug ?? '');
  if (!title || !/^[a-z0-9-]{1,120}$/i.test(titleSlug)) throw new LeetCodeTransientError('Problem metadata is incomplete.');

  // questionId is an internal LeetCode ID. Query questionFrontendId for the human-facing number.
  const questionData = await leetCodeGraphQL<{ question?: { questionFrontendId?: string | number; difficulty?: string; content?: string; topicTags?: unknown[] } }>(
    QUESTION_DETAIL_QUERY,
    'questionDetail',
    { titleSlug },
  );
  const problemNumber = String(questionData.question?.questionFrontendId ?? '');
  if (!/^\d{1,8}$/.test(problemNumber)) throw new LeetCodeTransientError('LeetCode did not return a valid problem number.');

  const rawLang = result.lang as { name?: unknown; verboseName?: unknown } | string | undefined;
  const language = typeof rawLang === 'string'
    ? rawLang
    : String(rawLang?.verboseName ?? rawLang?.name ?? 'unknown');
  // Problem-level tags and description belong to the question object. Some LeetCode
  // deployments also expose submission-level topicTags; use them only as a fallback.
  const rawTags = questionData.question?.topicTags ?? result.topicTags;
  const tags = Array.isArray(rawTags) ? rawTags : [];
  const optionalNumber = (value: unknown): number | undefined => {
    const number = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(number) ? number : undefined;
  };
  const runtimePercentile = optionalNumber(result.runtimePercentile);
  const memoryPercentile = optionalNumber(result.memoryPercentile);
  const timestamp = optionalNumber(result.timestamp);

  const submission: LeetCodeSubmission = {
    submissionId,
    status: 'Accepted',
    code: result.code,
    lang: language,
    question: {
      questionId: problemNumber,
      title,
      titleSlug,
      difficulty: String(questionData.question?.difficulty ?? rawQuestion.difficulty ?? 'Unknown'),
      ...(typeof questionData.question?.content === 'string' ? { content: questionData.question.content }
        : typeof rawQuestion.content === 'string' ? { content: rawQuestion.content } : {}),
      topicTags: tags.flatMap((tag): Array<{ name: string; slug?: string }> => {
        if (!tag || typeof tag !== 'object' || typeof (tag as { name?: unknown }).name !== 'string') return [];
        const t = tag as { name: string; slug?: unknown };
        return [{ name: t.name, ...(typeof t.slug === 'string' ? { slug: t.slug } : {}) }];
      }),
    },
    ...(typeof result.runtime === 'string' ? { runtime: result.runtime } : {}),
    ...(typeof result.memory === 'string' ? { memory: result.memory } : {}),
    ...(runtimePercentile !== undefined ? { runtimePercentile } : {}),
    ...(memoryPercentile !== undefined ? { memoryPercentile } : {}),
    ...(timestamp !== undefined ? { timestamp } : {}),
  };
  return submission;
}
