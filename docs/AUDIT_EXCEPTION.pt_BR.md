# Exceção do audit do lockfile

**English:** [AUDIT_EXCEPTION.md](AUDIT_EXCEPTION.md)

`npm run audit` roda [scripts/audit-exception.mjs](../scripts/audit-exception.mjs). Ele chama `npm audit --package-lock-only --json` e falha em todo aviso, exceto o de baixo.

Registrado em: 2026-10-19. Revisão até: **2027-01-19**.

## GHSA-hp3w-g68c-fv3c

| | |
| --- | --- |
| Pacote | `sprintf-js` |
| Versão no lock | `1.1.3` (`package-lock.json`) |
| Faixa do aviso | `*` (todas as versões, inclusive 1.1.3) |
| Severidade | moderate |
| Efeito | negação de serviço por especificadores de precisão sem limite |
| Cadeia | `sprintf-js` → `roarr` → `global-agent` → `@electron/get` → `app-builder-lib` → `electron-builder` |
| Onde roda | só devDependency. `npm audit --omit=dev` não reporta vulnerabilidade de produção. O app empacotado não leva essa cadeia como dependência de execução do shell. |

`npm audit fix --force` instalaria `electron-builder@26.5.0`. Isso é um downgrade para fora de `26.6.0 - 27.0.0-alpha.2`, não um patch para frente. Não existe release corrigido do `sprintf-js` fora da faixa do aviso, porque a faixa é todas as versões. Este repo não aceita esse downgrade.

Remova esta exceção quando uma revisão mostrar que o aviso sumiu, ou quando um `electron-builder` sem breaking deixar de puxar a cadeia. Um id de aviso novo faz o gate falhar na hora.

Relacionado: [instalação](INSTALL.pt_BR.md) ([English](INSTALL.md)).
