import type { BlinkConfig, LeetCodeSubmission } from '../shared/types';
import { generateProblemReadme } from '../shared/readme';
import { analyzeComplexity } from '../shared/complexity';
import { renderFilePath, siblingReadmePath } from '../shared/path';

const API = 'https://api.github.com';
const API_VERSION = '2026-03-10';

export class GitHubApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryAt?: number,
    readonly retryable = false,
  ) { super(message); }
}

async function githubRequest<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    const headers = new Headers({
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'x-github-api-version': API_VERSION,
      ...(init.body ? { 'content-type': 'application/json' } : {}),
    });
    new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    response = await fetch(`${API}${path}`, { ...init, headers, cache: 'no-store' });
  } catch (error) {
    throw new GitHubApiError(error instanceof Error ? error.message : 'GitHub network request failed.', 0, undefined, true);
  }

  if (!response.ok) {
    let message = `GitHub returned HTTP ${response.status}.`;
    try {
      const body = await response.json() as { message?: string };
      if (body.message) message = body.message;
    } catch { /* response body is optional */ }
    const reset = Number(response.headers.get('x-ratelimit-reset'));
    const retryAfterHeader = response.headers.get('retry-after');
    const retryAfterMs = retryAfterHeader
      ? (/^\d+(?:\.\d+)?$/.test(retryAfterHeader)
        ? Date.now() + Number(retryAfterHeader) * 1_000
        : Date.parse(retryAfterHeader))
      : Number.NaN;
    const retryAt = Number.isFinite(retryAfterMs)
      ? retryAfterMs
      : response.status === 403 && Number(response.headers.get('x-ratelimit-remaining')) === 0 && Number.isFinite(reset)
        ? reset * 1_000
        : undefined;
    const retryable = response.status === 429 || response.status >= 500 || response.status === 0 || response.status === 409 || response.status === 422 || (response.status === 403 && retryAt !== undefined);
    throw new GitHubApiError(message, response.status, retryAt, retryable);
  }
  if (response.status === 204) return undefined as T;
  return await response.json() as T;
}

interface RepoResponse { private: boolean; default_branch: string; permissions?: { push?: boolean } }
interface RefResponse { object: { sha: string } }
interface CommitResponse { tree: { sha: string } }
interface BlobResponse { sha: string }
interface TreeResponse { sha: string }
interface NewCommitResponse { sha: string; html_url: string }
interface ContentResponse { sha: string; type: string; content?: string }

function repoParts(repo: string): [string, string] {
  const match = repo.trim().match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (!match || match[1] === '.' || match[1] === '..' || match[2] === '.' || match[2] === '..') {
    throw new Error('Repository must use the owner/repository format.');
  }
  return [match[1]!, match[2]!];
}

function repoPath(owner: string, repo: string, endpoint: string): string {
  return `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}${endpoint}`;
}

function branchRef(branch: string): string {
  return branch.split('/').map(encodeURIComponent).join('/');
}

export async function testGitHubConnection(token: string, repoValue: string, branch: string) {
  const [owner, repo] = repoParts(repoValue);
  const repoInfo = await githubRequest<RepoResponse>(token, repoPath(owner, repo, ''));
  if (repoInfo.permissions && repoInfo.permissions.push === false) throw new Error('The token can read this repository but cannot push to it.');
  const resolvedBranch = branch.trim() || repoInfo.default_branch;
  await githubRequest<RefResponse>(token, repoPath(owner, repo, `/git/ref/heads/${branchRef(resolvedBranch)}`));
  return { owner, repo, isPrivate: repoInfo.private, branch: resolvedBranch };
}

async function getRemoteFileSha(token: string, owner: string, repo: string, path: string, branch: string): Promise<string | null> {
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  try {
    const result = await githubRequest<ContentResponse>(token, repoPath(owner, repo, `/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`));
    return result.type === 'file' ? result.sha : null;
  } catch (error) {
    if (error instanceof GitHubApiError && error.status === 404) return null;
    throw error;
  }
}

async function gitBlobSha(content: string): Promise<string> {
  const bytes = new TextEncoder().encode(content);
  const header = new TextEncoder().encode(`blob ${bytes.length}\0`);
  const combined = new Uint8Array(header.length + bytes.length);
  combined.set(header);
  combined.set(bytes, header.length);
  const digest = await crypto.subtle.digest('SHA-1', combined);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function pickVersionedPath(
  token: string,
  owner: string,
  repo: string,
  original: string,
  branch: string,
  localSha: string,
): Promise<{ path: string; identical: boolean; existingPaths: string[] }> {
  const dot = original.lastIndexOf('.');
  const stem = dot > original.lastIndexOf('/') ? original.slice(0, dot) : original;
  const extension = dot > original.lastIndexOf('/') ? original.slice(dot) : '';
  const originalSha = await getRemoteFileSha(token, owner, repo, original, branch);
  if (!originalSha) return { path: original, identical: false, existingPaths: [] };
  const existingPaths = [original];
  if (originalSha === localSha) return { path: original, identical: true, existingPaths };
  for (let version = 2; version <= 50; version += 1) {
    const candidate = `${stem}-v${version}${extension}`;
    const sha = await getRemoteFileSha(token, owner, repo, candidate, branch);
    if (!sha) return { path: candidate, identical: false, existingPaths };
    existingPaths.push(candidate);
    if (sha === localSha) return { path: candidate, identical: true, existingPaths };
  }
  throw new Error('Could not find a free versioned filename (checked v2–v50).');
}

export async function createAtomicSolutionCommit(
  token: string,
  config: BlinkConfig,
  submission: LeetCodeSubmission,
  reviewDue?: Date,
): Promise<{ path: string; commitUrl: string; duplicate: boolean }> {
  const [owner, repo] = repoParts(config.repo);
  const basePath = renderFilePath(config.fileTemplate, submission);
  const readmePath = siblingReadmePath(basePath);

  // Run local analysis while GitHub preflight requests are in flight.
  const analysisPromise = Promise.resolve().then(() => analyzeComplexity(submission.code));
  const [solutionLocalSha, repoHead] = await Promise.all([
    gitBlobSha(submission.code),
    githubRequest<RefResponse>(token, repoPath(owner, repo, `/git/ref/heads/${branchRef(config.branch)}`)),
  ]);

  const solutionPlan = config.duplicateMode === 'version'
    ? await pickVersionedPath(token, owner, repo, basePath, config.branch, solutionLocalSha)
    : { path: basePath, identical: false, existingPaths: [] as string[] };
  const solutionPath = solutionPlan.path;
  const approachPaths = config.duplicateMode === 'version'
    ? [...solutionPlan.existingPaths, ...(solutionPlan.existingPaths.includes(solutionPath) ? [] : [solutionPath])]
    : [solutionPath];
  const complexity = await analysisPromise;
  const readme = generateProblemReadme(submission, solutionPath, complexity, reviewDue, approachPaths, config.includeProblemDescription);
  const readmeLocalSha = await gitBlobSha(readme);
  const [remoteSolutionSha, remoteReadmeSha] = await Promise.all([
    getRemoteFileSha(token, owner, repo, solutionPath, config.branch),
    getRemoteFileSha(token, owner, repo, readmePath, config.branch),
  ]);

  if (remoteSolutionSha === solutionLocalSha && remoteReadmeSha === readmeLocalSha) {
    return { path: solutionPath, commitUrl: '', duplicate: true };
  }

  const [solutionBlob, readmeBlob, parentCommit] = await Promise.all([
    githubRequest<BlobResponse>(token, repoPath(owner, repo, '/git/blobs'), {
      method: 'POST', body: JSON.stringify({ content: submission.code, encoding: 'utf-8' }),
    }),
    githubRequest<BlobResponse>(token, repoPath(owner, repo, '/git/blobs'), {
      method: 'POST', body: JSON.stringify({ content: readme, encoding: 'utf-8' }),
    }),
    githubRequest<CommitResponse>(token, repoPath(owner, repo, `/git/commits/${repoHead.object.sha}`)),
  ]);

  const tree = await githubRequest<TreeResponse>(token, repoPath(owner, repo, '/git/trees'), {
    method: 'POST',
    body: JSON.stringify({
      base_tree: parentCommit.tree.sha,
      tree: [
        { path: solutionPath, mode: '100644', type: 'blob', sha: solutionBlob.sha },
        { path: readmePath, mode: '100644', type: 'blob', sha: readmeBlob.sha },
      ],
    }),
  });

  const message = config.commitTemplate
    .replaceAll('{problemNumber}', submission.question.questionId.padStart(4, '0'))
    .replaceAll('{title}', submission.question.title)
    .replaceAll('{difficulty}', submission.question.difficulty)
    .slice(0, 180);
  const commit = await githubRequest<NewCommitResponse>(token, repoPath(owner, repo, '/git/commits'), {
    method: 'POST',
    body: JSON.stringify({ message, tree: tree.sha, parents: [repoHead.object.sha] }),
  });

  // force:false is essential: GitHub rejects a non-fast-forward update rather than overwriting others' work.
  await githubRequest(token, repoPath(owner, repo, `/git/refs/heads/${branchRef(config.branch)}`), {
    method: 'PATCH', body: JSON.stringify({ sha: commit.sha, force: false }),
  });
  return { path: solutionPath, commitUrl: commit.html_url, duplicate: false };
}
