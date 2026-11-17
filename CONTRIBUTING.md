# Contributing

BlinkSync is an engineering scaffold, and its LeetCode integration depends on undocumented site behavior. Please verify changes against the documented limitations and avoid including real submission source, credentials, or personal data in issues, pull requests, fixtures, and logs.

## Development setup

- Install Node.js 22 or newer and npm 10 or newer.
- From the repository root, run `npm ci`.
- For the distribution site, run `npm ci` from `apps/site`.

## Before opening a pull request

Run the extension checks from the repository root:

```bash
npm run ci
```

For changes to the distribution site, also run:

```bash
npm ci
npm run build
```

The extension's live LeetCode and GitHub integrations require separate manual verification; unit tests do not establish that undocumented LeetCode APIs remain compatible. See [docs/TESTING.md](docs/TESTING.md) for the manual test checklist.

Keep changes focused, preserve user consent and token-handling boundaries, and do not commit generated output, credentials, or real accepted solution code.
