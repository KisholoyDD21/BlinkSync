# Testing checklist

## Automated checks in this repository

```bash
npm run typecheck
npm test
npm run build
```

Unit tests cover safe path generation, language-extension mapping, submission/config validation, basic complexity pattern recognition, and README problem-statement controls/HTML stripping. These tests do not prove live LeetCode or GitHub API compatibility.

## Required manual / integration tests

### Detection and correctness

- [ ] Use a test account and a controlled accepted submission; capture the network request/response contract.
- [ ] Measure `performance.now()` at the first Accepted response callback and at the first GitHub request.
- [ ] Verify a non-Accepted result never creates a GitHub request.
- [ ] Verify a forged `blinksync:page-event` cannot cause a write unless the background fetch independently returns Accepted.
- [ ] Verify actual accepted source is committed when the editor is changed immediately after submission.
- [ ] Verify XHR and Fetch detection separately.
- [ ] Verify GraphQL response detection if LeetCode uses it in the deployed UI.
- [ ] Verify DOM fallback with network detection disabled in a test build.
- [ ] Verify manual submission URL and numeric ID entry.
- [ ] Navigate between problem routes without full page reload; verify one bridge and one manual button.

### GitHub behavior

- [ ] Fine-grained token with Contents read/write on one public repository.
- [ ] Same setup on a private repository.
- [ ] Wrong repository and wrong branch.
- [ ] Existing identical source + README: no new commit.
- [ ] Changed solution in overwrite mode: one new commit, same path.
- [ ] Changed solution in version mode: new solution-v2 path, previous solution remains.
- [ ] Verify exactly one commit contains both solution and README files.
- [ ] Update target branch concurrently from a second client; verify non-forced update fails safely and the retry reads the newer head.
- [ ] Token revoked mid-run; verify 401 handling and no repeated unauthorized calls.
- [ ] Rate limit exhausted; verify reset scheduling and user-facing messaging.
- [ ] Simulate 429, 500, 502, timeout, and offline errors.

### Lifecycle and resilience

- [ ] Two tabs observe the same submission ID at nearly the same time; only one GitHub commit.
- [ ] Enqueue a second accepted submission while the retry queue is flushing; verify item-scoped updates do not lose either queue item.
- [ ] Trigger overlapping queue flush events (online, alarm, popup); verify serialized queue processing and one commit per submission.
- [ ] Terminate the service worker from `chrome://serviceworker-internals` / extension tooling during each transaction phase.
- [ ] Restart browser with queued payload; verify IndexedDB queue remains and the session-only GitHub token must be re-entered.
- [ ] Simulate offline immediately after Accepted; verify the candidate ID is held in IndexedDB, then the verified source payload is persisted before any GitHub write.
- [ ] Verify retry count never exceeds three automatic attempts.
- [ ] Test quota handling and 100-item queue cap.
- [ ] Test contest safe mode: verified payload is held, no GitHub request, manual Release now pushes it.
- [ ] With contest-held items present, click Retry failed; verify they remain held and no contest solution is published.
- [ ] Test scheduled contest release, browser sleep/restart, and explicit release; scheduled releases must not publish while consent or automatic sync is paused.
- [ ] Test consent withdrawal and automatic-sync pause: no queued background item is sent while paused.
- [ ] Test spaced repetition intervals, due dashboard, route changes, and in-page review action; verify the content script can read only that problem’s due status, not full extension state.
- [ ] Verify full problem descriptions are omitted from generated READMEs unless the user explicitly enables the setting.
- [ ] Test the extension update / disable / enable behavior of `storage.session`.

### Performance

- [ ] Record at least 100 accepted submissions across representative networks.
- [ ] Report p50, p95 and p99 for verdict-to-message, message-to-first-GitHub-request, and end-to-end commit.
- [ ] Measure bundle sizes: content script gzip < 50 KB; background bundle gzip < 200 KB.
- [ ] Ensure no polling or recurring timer runs on unrelated LeetCode pages.
- [ ] Confirm content script uses only the LeetCode host and never sends token data to MAIN world.

### Store and privacy

- [ ] Inspect built manifest; confirm no `<all_urls>` and no unnecessary permissions.
- [ ] Confirm all executable logic is packaged; no remote JS/eval/Function.
- [ ] Confirm privacy policy exactly matches the built version.
- [ ] Capture screenshots and complete Chrome Web Store data-use disclosures.
- [ ] Test fresh install with no settings, token, repository, or LeetCode login.
- [ ] Test uninstall/revoke instructions and support contact.

## Performance reporting template

| Metric | p50 | p95 | p99 | Sample count | Environment |
|---|---:|---:|---:|---:|---|
| Accepted response → content message | | | | | |
| Content message → first GitHub request | | | | | |
| Accepted response → GitHub ref update | | | | | |
| GitHub failure → queue persisted | | | | | |

Do not publish “instant” or “under 2 seconds guaranteed” unless these values are supported by repeatable measurements and a clearly defined test environment.
