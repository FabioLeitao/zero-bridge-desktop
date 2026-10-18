# Contributing

## Development setup

```bash
npm ci
npm run build
npm test
```

## Commit rules

- Sign commits (`git config commit.gpgsign true`).
- One commit per change. No co-author trailer.
- Branch names: `epic/sN-slug`.
- Merge commits only.

## Security

- No secrets in argv, logs, URL, query string, or renderer.
- Preload allowlist only. No Node in renderer.
- `npm audit --package-lock-only` must pass.

## Tests

- Unit tests under `tests/`.
- Smoke tests under `scripts/`.
- `npm test` runs both.

## Releases

- Lockfile is canonical. Do not run `npm install` without `--package-lock-only`.
- Install scripts are blocked. If a dependency needs it, pick another.

## License

MIT. See LICENSE.
