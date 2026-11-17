# Privacy and data-handling specification

This document is the implementation target. The public privacy page must be reviewed against the exact release build and the developer's legal obligations.

## Data accessed

- LeetCode submission ID and Accepted status, to detect and verify a user-submitted accepted solution.
- Accepted source code, language, problem title/number/slug/difficulty, description, topics, and performance metrics when returned by LeetCode.
- GitHub token, selected repository, branch, and GitHub API responses needed to create commits.
- Local sync status, retry metadata, and timestamps.

## Purposes and destinations

- LeetCode source/metadata is retrieved from `leetcode.com` using the user's signed-in session.
- Source/README files are sent directly to `api.github.com` only after the user configures a destination and the submission passes background validation.
- The GitHub token is stored in chrome.storage.session and is session-only in this build. Settings/history are stored in chrome.storage.local. Pending submission IDs and verified source payloads are stored in extension-origin IndexedDB. The extension does not read the active Monaco editor buffer; it retrieves the actual accepted submission source from LeetCode.
- Full LeetCode problem statements are omitted from generated READMEs by default. The optional full-statement setting is off unless the user explicitly enables it.
- No analytics, telemetry, advertising, or BlinkSync-operated data collection endpoint is included.

## Permissions

- `storage`: configuration, history, and session token.
- IndexedDB: durable pending submission IDs and verified source payloads.
- `alarms`: retry queue wake-up.
- `https://leetcode.com/*`: fetch the user's accepted submission details and inject the detector on LeetCode.
- `https://api.github.com/*`: create Git objects and update the chosen repository branch.

No `<all_urls>` permission is requested. The MAIN-world script is packaged with the extension and exposed only on LeetCode pages. The GitHub token is not passed to it.

## User control and consent

Before sync begins, the popup must clearly explain that accepted source code and problem metadata are transferred to the GitHub repository selected by the user. The user must actively provide a GitHub token and choose a repository. Users can pause automatic sync at any time.

## Security limitations

- `chrome.storage.session` is preferable to persistent storage for this session-only token design, but it is not a hardware-backed encrypted vault.
- Browser-profile malware, a malicious local user, or a compromised extension update may still expose secrets.
- Page-world network events are untrusted hints and are independently verified by the service worker.
- LeetCode GraphQL operation names and response fields are undocumented integration points.

## Before publication

- Replace the draft privacy page with a public HTTPS URL and support address.
- Verify each data-use disclosure against production code, especially if OAuth, telemetry, crash reporting, sync, or account features are later added.
- Put the privacy policy URL in the Chrome Web Store dashboard.
- Prominently disclose source-code transfer before enabling automatic sync and obtain affirmative consent.
- Keep the store listing, permission justification, in-product disclosure, and privacy policy consistent.
