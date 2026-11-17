# Architecture and sequence

## Trust boundaries

- **LeetCode page (MAIN world):** hostile/untrusted input. The injected observer may be monkey-patched or spoofed by page code. It has no extension API and receives no GitHub credential.
- **Content script (ISOLATED world):** observes bridge events and DOM fallback. It sends only a numeric submission ID, source label, and timestamp.
- **Service worker:** validates sender origin/tab, refetches the submission through LeetCode, validates the authoritative Accepted result, reads configuration and session token, then calls GitHub.
- **GitHub:** receives source and README only after verification. The user selects one repository and branch.
- **Website:** static distribution and policy pages only. It has no sync API and collects no solution payloads.

## Primary flow

1. Content script runs at `document_start` on LeetCode problem and contest routes only; unrelated LeetCode pages receive no detector or observer.
2. WXT injects the bundled `leetcode-main-world.js` into the page context.
3. The main-world script wraps `window.fetch` and `XMLHttpRequest` passively. It clones/reads only matching submission-check responses and dispatches a custom event on a candidate Accepted status.
4. The isolated content script receives the event and sends a single `SUBMISSION_ACCEPTED` message containing `{submissionId, observedAt, source}`.
5. The service worker checks the sender's HTTPS LeetCode origin and tab, validates the message shape, and uses an in-flight map plus durable submission ledger to suppress duplicate work.
6. The background fetches LeetCode `submissionDetails` with the user's existing signed-in session (`credentials: include`), requires LeetCode `statusCode === 10`, and then calls `questionDetail` for the human-facing `questionFrontendId`, difficulty, problem description, and question-level topic tags. It validates a non-empty source string and the problem metadata before continuing.
7. The GitHub layer computes source and README Git blob hashes, checks the existing branch files, fetches the branch head, and creates the blobs in parallel.
8. It creates a Git tree based on the branch head, creates one commit with the current head as parent, and PATCHes the branch ref with `force: false`.
9. The local ledger/history is updated. A failed push is written to the durable IndexedDB queue and does not block LeetCode. If the LeetCode details fetch is temporarily unavailable, only the untrusted candidate ID is queued; exact code is retrieved and Accepted is revalidated on retry.

## Why this verifies twice

A DOM event or `window.postMessage` from the page is forgeable. The bridge is only a low-latency notification channel. It cannot authorize a GitHub write. The background independently retrieves the source and requires LeetCode's response to say Accepted. Never pass a token, repo config, or code from the MAIN world to the background.

## LeetCode compatibility adapter

`src/background/leetcode.ts` encapsulates the submission details GraphQL query. This operation is not a stable public API contract. Before release:

- Record sanitized successful response fixtures from a test account.
- Verify cookies are sent from the extension service worker on Chrome stable.
- Verify the `submissionDetails` fields (`code`, `statusCode`, language object, runtime/memory percentiles, question summary, and optional submission-level tags) and the `questionDetail` fields (`questionFrontendId`, difficulty, content, and topic tags). LeetCode may move or remove any field without notice.
- Treat percentile fields as optional: do not manufacture them when the endpoint does not return them.
- Add response schema validation and a site-change test that fails loudly when required fields disappear.
- Keep a manual submission ID flow available when network event signatures change.

The first-party submission response may not include percentile metrics in every case. The README explicitly says “Not supplied” when values are absent. Full problem statements are omitted by default and require an explicit user setting before they are copied into GitHub.

## GitHub transaction

The Git Data API flow is intentionally used instead of writing several files through independent Contents API calls:

1. GET branch ref.
2. GET parent commit/tree.
3. POST source blob and README blob in parallel.
4. POST tree with `base_tree` and both path/blob entries.
5. POST commit with the base commit as parent.
6. PATCH `refs/heads/<branch>` with `force: false`.

The final ref update is the visibility boundary: readers see the new tree once the ref moves. GitHub's create-tree documentation describes creating a tree and then committing it before updating a ref; the ref API's `force: false` behavior prevents a non-fast-forward overwrite. See GitHub REST docs: <https://docs.github.com/en/rest/git/trees>, <https://docs.github.com/en/rest/git/commits>, and <https://docs.github.com/en/rest/git/refs>.

## Idempotency and races

- Primary idempotency key: `leetcode:<submissionId>`.
- Same-worker simultaneous messages coalesce via an in-flight Promise map.
- Durable local ledger prevents repeat writes after a completed sync.
- Remote file SHA comparison catches a worker crash after a branch update but before the local ledger was written.
- Variant mode probes `solution-v2.ext` through `solution-v50.ext` rather than overwriting a previous approach.
- Branch updates are non-forced. A concurrent update fails safely and is retried against the newer head.

A local ledger is not a distributed lock across multiple browser profiles. GitHub remote SHA checks and fast-forward ref updates are the final cross-device safety net.

## Performance model

Target the following **measurement goals**, not hard guarantees:

- Candidate verdict event to content-script message: p50 < 100 ms on local test harness.
- Candidate event to first GitHub request: measure p50/p95; this includes one or two LeetCode GraphQL round trips and must not be advertised as a fixed < 500 ms guarantee. Optimize and report the measured distribution.
- End-to-end commit: measure p50/p95; aim for < 2 s but report timeouts and queue states honestly.

The Git Data API still has serial dependencies. Source/README blob creation and preflight calls are parallelized, but tree, commit, and ref update must follow in order. Rate limits, branch conflicts, LeetCode session refresh, and network RTT remain outside extension control.

## Storage and service-worker lifecycle

- Settings/history/review metadata: `chrome.storage.local`; pending submission IDs and verified source payloads: extension-origin IndexedDB.
- GitHub PAT: `chrome.storage.session` only.
- Storage access level: `TRUSTED_CONTEXTS`; content scripts must not read tokens/settings directly.
- Event listeners are registered synchronously in `defineBackground`.
- Every retry is stored before scheduling an alarm. Worker memory is only an optimization.
- Service worker globals can be discarded at any time. The IndexedDB queue and local idempotency ledger are authoritative.

Chrome documents that service-worker global variables are lost on shutdown and recommends persisting state in extension storage: <https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle/>.
