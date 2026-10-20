# zero-bridge-desktop — Instalação e Segurança

## Instalação (Linux)

### AppImage (recomendado, sem instalação)

```bash
chmod +x zero-bridge-<versao>.AppImage
./zero-bridge-<versao>.AppImage
```

### Debian/Ubuntu (.deb)

```bash
sudo apt install ./zero-bridge-desktop_<versao>_amd64.deb
# depois execute pelo menu ou:
zero-bridge-desktop
```

## Como funciona

O app desktop inicia o binário **zero-bridge** (Go) como sidecar. O listen padrão é uma porta loopback efêmera. Depois que `GET /health` responde, o shell faz login, grava o cookie `zb_session` e carrega `http://127.0.0.1:<porta>/`. Quando `shell-config.json` define um `unixSocket` absoluto, a bridge não escuta TCP. O shell faz login e carrega a UI por esse socket (`zb://bridge/`) e não abre um proxy TCP. A bridge continua criando o socket no modo `0600`.

## Token e Segurança

- Um **token por lançamento** é gerado pelo processo principal do Electron e escrito num arquivo `0600` em `userData/tokens/<uuid>/` (`0700`). Se o `chmod` falha, o diretório é apagado e o lançamento aborta. `ZB_E2E_TOKEN_FILE` só troca o diretório nos testes.
- O token vai ao bridge por `--token-file`. Ele não entra em argv, logs, URL nem no objeto devolvido ao renderer. O cookie de sessão é gravado pelo processo principal.
- O bridge exige: bind apenas loopback, validação Host/Origin, sem CORS, CSP estrito.
- Notificações nativas para pedidos de permissão mostram **apenas o título da ferramenta** (texto puro, sanitizado). Saída do agente nunca aparece em notificações.

## Testes de ponta a ponta

`npm test` não abre o Electron. Os scripts de instalação estão bloqueados (`.npmrc` `ignore-scripts=true`), então um `npm ci` comum não baixa o binário do Electron. `ignore-scripts` se sobrepõe ao campo `allowScripts`.

Para rodar a UI localmente:

```bash
npm ci --ignore-scripts=false
npm run build
npm run test:e2e
```

No npm 11 e no npm 12 essa exceção ainda roda só `electron@41.10.6`. Os outros pacotes com script de instalação estão `false` em `allowScripts`. O Node 22.23.3 traz o npm 10.9.9, que ignora esse campo e roda todos os scripts de instalação. O CI instala o npm 12.2.0 e depois usa este mesmo comando (`.github/workflows/check.yml`).

A suíte compila `cmd/zero-bridge` e `cmd/acpfake` do módulo Go. Defina `ZB_BRIDGE_SRC` com o diretório desse módulo, ou deixe o bridge em `./zero-bridge` ou `../zero-bridge`.

## Atualização

Baixe o novo AppImage/.deb e substitua. Canal de auto-atualização ainda não existe (planejado para follow-up do S23c).

## Reportando Problemas de Segurança

Email: `fabio.tleitao@gmail.com` (chave PGP no perfil GitHub)

**Não** abra issue público para vulnerabilidades de segurança.