# Contribuindo

## Setup

```bash
npm ci
npm run build
npm test
```

## Regras de commit

- Assine commits (`git config commit.gpgsign true`).
- Um commit por mudança. Sem co-author.
- Branches: `epic/sN-slug`.
- Apenas merge commits.

## Segurança

- Nada de segredos em argv, logs, URL, query string ou renderer.
- Preload allowlist apenas. Sem Node no renderer.
- `npm audit --package-lock-only` deve passar.

## Testes

- Unitários em `tests/`.
- Smoke em `scripts/`.
- `npm test` roda ambos.

## Releases

- Lockfile é canônico.
- Scripts de instalação bloqueados.

## Licença

MIT. Ver LICENSE.
