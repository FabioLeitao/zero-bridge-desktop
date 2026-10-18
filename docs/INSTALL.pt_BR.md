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

O app desktop inicia o binário **zero-bridge** (Go) como sidecar em uma porta loopback local (ou Unix socket quando S21 chegar). O bridge spawna o agente ACP (`zero acp` ou `acpfake` para testes). A UI é servida pelo bridge em `http://127.0.0.1:<porta>/`.

## Token e Segurança

- Um **token por lançamento** é gerado pelo processo principal do Electron e escrito em um arquivo `0600` dentro de um diretório `0700` (`$XDG_RUNTIME_DIR/zb-<uuid>/token.txt` ou `$TMPDIR/zb-<uuid>/token.txt`).
- O token é passado ao bridge via `--token-file`. Nunca aparece em argv, logs, URL ou no processo renderer.
- O bridge exige: bind apenas loopback, validação Host/Origin, sem CORS, CSP estrito.
- Notificações nativas para pedidos de permissão mostram **apenas o título da ferramenta** (texto puro, sanitizado). Saída do agente nunca aparece em notificações.

## Atualização

Baixe o novo AppImage/.deb e substitua. Canal de auto-atualização ainda não existe (planejado para follow-up do S23c).

## Reportando Problemas de Segurança

Email: `fabio.tleitao@gmail.com` (chave PGP no perfil GitHub)

**Não** abra issue público para vulnerabilidades de segurança.