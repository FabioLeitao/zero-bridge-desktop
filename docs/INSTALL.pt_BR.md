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

O app desktop inicia o binário **zero-bridge** (Go) como sidecar numa porta loopback efêmera. O bridge spawna o agente ACP (`zero acp`, ou `acpfake` nos testes). Depois que `GET /health` responde, o shell faz login em loopback, grava o cookie `zb_session` e carrega `http://127.0.0.1:<porta>/`. O listen por Unix socket existe no bridge e este shell ainda não o usa.

## Token e Segurança

- Um **token por lançamento** é gerado pelo processo principal do Electron e escrito num arquivo `0600` em `userData/tokens/<uuid>/` (`0700`). Se o `chmod` falha, o diretório é apagado e o lançamento aborta. `ZB_E2E_TOKEN_FILE` só troca o diretório nos testes.
- O token vai ao bridge por `--token-file`. Ele não entra em argv, logs, URL nem no objeto devolvido ao renderer. O cookie de sessão é gravado pelo processo principal.
- O bridge exige: bind apenas loopback, validação Host/Origin, sem CORS, CSP estrito.
- Notificações nativas para pedidos de permissão mostram **apenas o título da ferramenta** (texto puro, sanitizado). Saída do agente nunca aparece em notificações.

## Testes de ponta a ponta

`npm test` não abre o Electron. Os scripts de instalação estão bloqueados (`.npmrc` `ignore-scripts=true`), então um `npm ci` comum não baixa o binário do Electron.

Para rodar a UI localmente:

```bash
npm ci --allow-scripts
npm run build
npm run test:e2e
```

A suíte compila `cmd/zero-bridge` e `cmd/acpfake` do módulo Go. Defina `ZB_BRIDGE_SRC` com o diretório desse módulo, ou deixe o bridge em `./zero-bridge` ou `../zero-bridge`. O CI faz isso em `.github/workflows/check.yml` com `npm ci --allow-scripts`.

## Atualização

Baixe o novo AppImage/.deb e substitua. Canal de auto-atualização ainda não existe (planejado para follow-up do S23c).

## Reportando Problemas de Segurança

Email: `fabio.tleitao@gmail.com` (chave PGP no perfil GitHub)

**Não** abra issue público para vulnerabilidades de segurança.