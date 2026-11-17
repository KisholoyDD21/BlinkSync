# Authentication options and OAuth design decision

## Implemented now: fine-grained PAT

The popup accepts a fine-grained GitHub PAT scoped to one repository with Contents read/write. It is stored in `chrome.storage.session`, and the background service worker alone reads it. It is cleared at browser restart, extension reload, or update. The extension does not send it to LeetCode, the distribution website, or the MAIN-world bridge.

## Recommended production OAuth: GitHub App + serverless broker

Do not embed a GitHub OAuth client secret or GitHub App private key in the extension package. A polished production flow should use a GitHub App installed only on selected repositories, with Contents write permission and a serverless token broker that mints short-lived installation tokens. The broker must authenticate the installation/user relationship, verify requested repository ownership and installation access, and never expose the GitHub App private key.

The extension should only receive a short-lived installation token and keep it in `chrome.storage.session`. The broker should return minimal token data and avoid logging tokens, source code, or problem content.

## Why the scaffold does not include a fake OAuth button

GitHub OAuth App authorization-code exchange requires a client secret; GitHub supports PKCE, but an exchange that includes the secret must happen in a trusted server. A generic OAuth App `repo` scope can also be broader than a one-repository fine-grained PAT. The GitHub documentation recommends considering GitHub Apps because they provide fine-grained permissions, user-controlled repository access, and short-lived tokens.

References:
- https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps
- https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/best-practices-for-creating-an-oauth-app
- https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app

Do not implement OAuth Device Flow simply because it avoids a client secret: GitHub documents it primarily for headless/CLI-style applications and warns against enabling it without a constrained-environment need.

## Serverless broker contract (future)

`POST /v1/installation-token`

Request (authenticated and bound to a completed GitHub App installation flow):

```json
{
  "installationId": 123456,
  "repositoryId": 789012,
  "repository": "owner/repo"
}
```

Response:

```json
{
  "token": "ghs_...",
  "expiresAt": "2026-11-17T13:00:00Z",
  "repository": "owner/repo"
}
```

Security requirements: validate the authenticated installation identity, repository ID, and selected repo; mint only Contents read/write permissions for that repository; rate-limit token minting; redact request/response bodies; set strict CORS to the extension origin or use a one-time authorization handoff; and never accept a user-supplied private key or installation ID without authorization.
