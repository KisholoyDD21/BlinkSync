# Reliability and error-handling matrix

| Scenario | Detection / response | Durable behavior | User-facing result |
|---|---|---|---|
| LeetCode changes submission-check endpoint | MAIN-world adapter no longer sees the expected response | DOM fallback and manual submission-ID action remain available | “Network detection unavailable; use manual sync.” |
| LeetCode DOM locator changes | MutationObserver no longer finds the semantic locator | Network adapter remains primary; manual action remains | No false Accepted verdict; support diagnostics |
| Page forges a bridge event | Background fetches submission details independently | Reject if source/status is missing or status is not Accepted | Clear rejection message; no GitHub write |
| LeetCode GraphQL schema changes | Adapter validation fails | Candidate retained only if safe, retry is limited; no guessed code | “LeetCode response changed; update/retry after extension update.” |
| LeetCode session expires | 401/403 from LeetCode details request | Do not retry indefinitely | Ask user to sign in to LeetCode and retry manually |
| Submission still Pending/Wrong Answer | Background revalidation status is not exactly Accepted | Do not queue a push | “Submission is not Accepted; nothing was pushed.” |
| LeetCode request times out/offline | Network exception | Queue the candidate submission ID in IndexedDB; re-fetch and verify source on retry | “Could not verify submission; no push was made.” |
| GitHub token missing | No session token | If submission details have been retrieved, queue the verified payload; otherwise queue only the candidate ID. Hold until reconnection | “Connect GitHub to release queued work.” |
| GitHub token expired/revoked (401) | Remove/stop using token; pause queued pushes | Queue becomes held; retry after reconnection | “GitHub token expired or revoked. Reconnect.” |
| Fine-grained token lacks Contents write | 403 without rate-limit headers | Fail/hold; do not retry automatically | Explain required repository permission |
| Private repository | Repository `private` flag returned during test | Same Git Data API path | Show “Private repository connected”; token must be scoped to it |
| Repository or branch missing | 404 during connection/ref lookup | No write; queued item marked actionable/held | Ask user to correct owner/repo/branch or initialize repo |
| GitHub rate limit exhausted | 403 with `X-RateLimit-Remaining: 0` and reset header | Queue with `nextAttemptAt` = reset time | Show an approximate automatic retry delay when a reset/retry header is available |
| GitHub 429 / 5xx / network failure | Retryable error | Persist payload; exponential retry; max 3 attempts | “Queued; retry will occur automatically.” |
| Branch updated concurrently | Non-forced PATCH rejects non-fast-forward | Retry after re-reading branch head; remote SHA check prevents duplicates | “Branch changed during sync; retrying safely.” |
| Browser offline at Accepted | LeetCode detail fetch or GitHub request fails | Persist the candidate submission ID in IndexedDB; when details are fetched, persist the verified payload before any GitHub write | “Submission saved locally; waiting for LeetCode/GitHub connection.” |
| Multiple LeetCode tabs submit same ID | In-flight key + local ledger | One sync attempt per extension worker; GitHub blob check is final duplicate guard | One history entry per submission ID |
| User modifies editor after submit | Background fetches accepted submission source, not active editor model | Only accepted source is committed | No impact; active editor is not trusted |
| Unsupported/new LeetCode language | Language map falls back to `.txt` | Preserve source without claiming a known extension | User can add a language mapping before release |
| Same problem solved with different code | Duplicate mode decides overwrite/version | Version mode picks `solution-v2` etc.; overwrite mode changes existing blob | User-selected strategy |
| Contest Safe Mode enabled | Verified payload is queued as held | No GitHub request until explicit contest release or configured release-time alarm; scheduled release respects consent and the automatic-sync pause; generic Retry failed explicitly skips contest-held items | Held count visible in popup |
| User withdraws consent / disables automation | New automatic submissions are rejected; normal queue flush pauses | Existing retry items remain locally held until consent/automation is restored or user explicitly releases them | Explain no new network transfer occurs while paused |
| Spaced repetition enabled | Accepted problem creates a local due date; review uses fixed difficulty-based intervals | Review metadata remains in local storage only | Dashboard lists due items; problem page receives a review action |
| Popup/service worker closes mid-write | Durable item may remain; local ledger may not yet be marked | Remote SHA recheck prevents duplicate tree commit after ref update | Queue resumes on next alarm/startup |
| Oversized source | Enforce 1 MB source cap before storage/GitHub | Reject before write | “Submission exceeds safety limit.” |
| Bad file path template | Reject `..`, empty path segments, invalid output | No GitHub request | Show template validation error |
| README content contains HTML/script | Strip script/style and HTML tags; render as plain text | No active HTML is written into extension UI | Safe plain-text README content |
| User uninstalls extension | Local storage/session credentials removed with extension data | Remote files remain untouched | Explain GitHub token should also be revoked manually |

## Retry policy

- Initial sync path: one GitHub attempt; on transient failure, persist the payload and return quickly to the UI.
- Retry queue: maximum three retries after the initial failure, exponential backoff, respecting `Retry-After` and `X-RateLimit-Reset` when present. Pending submission payloads are persisted in IndexedDB.
- Chrome alarms are best-effort and can be delayed; the persisted queue is authoritative.
- 401, missing permissions, invalid repository, invalid branch, and invalid payloads are not blindly retried.
- After three transient failures, mark the item failed/held and expose manual retry after the underlying problem is fixed.

## Known gaps to close before store release

- Add a schema-compatible LeetCode adapter fixture from the current live site.
- Add complexity-report snapshots for prior variants; the README currently links all known variants but its complexity summary describes the latest accepted approach only.
- Add a browser integration test for simultaneous accepted tabs and service-worker termination mid-commit.
- Verify scheduled contest-release alarm behavior under browser sleep and restart; manual Release now remains the dependable behavior.
