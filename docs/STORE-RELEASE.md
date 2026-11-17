# Chrome Web Store release checklist

## Before submission

- [ ] Confirm current Chrome Web Store Developer Program Policies and User Data Policy.
- [ ] Replace the current privacy-policy draft and publish it over HTTPS.
- [ ] Add verified support email, developer/company identity, store screenshots, icon, feature graphic, and concise listing.
- [ ] Provide a clear single-purpose description: syncing the user's LeetCode Accepted solutions to the user's selected GitHub repository.
- [ ] Prominently disclose that solution source code and associated problem metadata are accessed on LeetCode and sent to the selected GitHub repository.
- [ ] Obtain affirmative user consent before first automatic sync.
- [ ] Fill the Chrome Web Store privacy/data-use declarations accurately.
- [ ] Explain why `storage`, `alarms`, LeetCode host access, and GitHub API host access are necessary.
- [ ] Verify no unneeded permission, no `<all_urls>`, no remote executable code, no `eval`, no dynamic code loaders, no obfuscated functionality.
- [ ] Build from reviewed source and inspect the unpacked output.
- [ ] Run a clean-profile test and full test matrix.
- [ ] Verify all URLs, support channels, and version numbers.
- [ ] Revoke test tokens and ensure secrets are not in source maps, logs, screenshots, or ZIPs.

## Listing claims

Do not claim “first”, “only”, “zero-fragility”, “instantaneous”, or “guaranteed under two seconds” without defensible evidence. Some competitors already advertise automatic accepted syncing, duplicate skipping, local token storage, and dashboards. Describe measurable behavior and supported features accurately.

## Build inspection

```bash
npm install --no-audit --no-fund  # generate and commit package-lock.json first for release reproducibility
npm run typecheck
npm test
npm run build
npm run zip
```

Inspect the generated `.output/chrome-mv3/manifest.json`. Ensure the final ZIP contains only the production package and no `.env`, test data, debug logs, or private credentials.

## Public release artifacts

- [ ] Signed/published Chrome Web Store listing.
- [ ] Public source repository and license.
- [ ] Release ZIP or signed extension package for manual distribution.
- [ ] Static website configured with real download/store URLs.
- [ ] Published privacy policy and terms/support page.
