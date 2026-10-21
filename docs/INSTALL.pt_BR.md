# zero-bridge-desktop — Instalação e Segurança

**English:** [INSTALL.md](INSTALL.md)

## Instalação (Linux)

Os nomes abaixo vêm de `package.json` `version` `0.1.0-alpha`. O controle do deb grava essa versão como `0.1.0~alpha`. Nada neste repositório publica os arquivos. Não há canal de auto-atualização.

O pacote traz o bridge em Go e não traz um agente. O `npm run dist` lê o único commit em `bridge.sha`, busca esse commit, confere o `git rev-parse` com esse SHA e compila `cmd/zero-bridge` com `go build -trimpath` e `GOFLAGS=-buildvcs=false`. O binário fica em `resources/bridge/zero-bridge` dentro do AppImage e em `/opt/zero-bridge/resources/bridge/zero-bridge` depois da instalação do deb. Um app empacotado usa esse caminho, a menos que `shell-config.json` defina `bridgeBin`. A linha de log da partida é `sidecar start bridge` seguida do SHA fixado. O SBOM lista essa bridge e as versões dos módulos Go do mesmo commit. Sem `agentBin` a janela abre e o sidecar não sobe.

### AppImage (recomendado, sem instalação)

```bash
sha256sum -c SHA256SUMS.txt
chmod +x zero-bridge-0.1.0-alpha.AppImage
./zero-bridge-0.1.0-alpha.AppImage
```

No Ubuntu 24.04 ou mais novo, o sistema restringe user namespaces sem privilégio. O AppImage extraído não traz perfil AppArmor, então ele não abre com o sandbox nessa configuração. Prefira o deb: o `postinst` instala o perfil AppArmor e, quando não há user namespaces, faz `chmod 4755` em `chrome-sandbox`. Para o AppImage, o operador libera com `sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0`. Esse valor vale para o sistema inteiro e não permanece depois de reiniciar. A outra saída é instalar um perfil AppArmor próprio.

### Debian/Ubuntu (.deb)

`dpkg-deb -I` informa `Depends: libgtk-3-0, libnotify4, libnss3, libxss1, libxtst6, xdg-utils, libatspi2.0-0, libuuid1, libsecret-1-0` e `Recommends: libappindicator3-1`. O executável é `/opt/zero-bridge/zero-bridge-desktop`.

```bash
sha256sum -c SHA256SUMS.txt
sudo apt install ./zero-bridge-desktop_0.1.0-alpha_amd64.deb
zero-bridge-desktop
```

## Como funciona

O app desktop inicia o binário **zero-bridge** (Go) como sidecar. O listen padrão é uma porta loopback efêmera. Depois que `GET /health` responde, o shell faz login, grava o cookie `zb_session` e carrega `http://127.0.0.1:<porta>/`. Quando `shell-config.json` define um `unixSocket` absoluto, a bridge não escuta TCP. O shell faz login e carrega a UI por esse socket (`zb://bridge/`) e não abre um proxy TCP. A bridge continua criando o socket no modo `0600`.

No Linux o shell passa `--exit-with-parent`. Se esse processo do Electron é morto, a bridge sai e apaga o socket unix. Um `bridgeBin` cujo arquivo não contém a flag é recusado antes de subir. A janela mostra `bridge does not support --exit-with-parent`.

## shell-config.json

O arquivo fica em `userData/shell-config.json`. O renderer não define esses campos. Um valor inválido aborta a partida e a página de erro mostra a causa, não o corpo do arquivo.

| Campo | Forma | Lançamento |
| --- | --- | --- |
| `bridgeBin` | string não vazia, opcional | caminho absoluto que sobrepõe a bridge embarcada. Ausente num pacote, vale `resources/bridge/zero-bridge` |
| `agentBin` | string não vazia | caminho absoluto do agente. O pacote não inclui um |
| `agentArgs` | lista de strings | cada item é um `--agent-arg`. O item tem de ter de 1 a 256 caracteres e não pode conter quebra de linha nem NUL. Ausente significa `--agent-arg acp`; uma lista vazia significa nenhum |
| `profile` | string | de 1 a 32 caracteres em `[a-z0-9-]`, passado como `--profile` quando definido |
| `passEnv` | lista de nomes | nomes de ambiente que o sidecar pode herdar |
| `unixSocket` | caminho absoluto | escuta nesse socket em vez de TCP |
| `openAtLogin` | boolean | iniciar com o login |
| `locale` | `en` ou `pt-BR` | idioma do shell |

A bridge aceita os nomes de perfil `generic` e `zero`. Qualquer outro nome que passe no padrão do shell ainda falha quando o sidecar sobe.

A suíte de ponta a ponta compila `cmd/acpfake` como agente. Esse binário é um dublê de teste, não um caminho de produto. Uma config que o exercita fica assim. O binário em si vem de `ZB_AGENT_BIN` ou `agentBin`, não deste exemplo:

```json
{
  "agentArgs": ["acp", "e2e-marker"],
  "profile": "generic"
}
```

Esta config sobe o Zero como agente. `zero acp` é o servidor do Agent Client Protocol, então `agentArgs` é `acp`. O `profile` `zero` é o perfil da bridge para esse agente. `agentBin` precisa ser um arquivo regular seu, sem ser symlink, e sem permissão de escrita para o grupo ou para os outros. Se o `zero` no `PATH` for um symlink, use o arquivo alvo. Sem `agentArgs`, o shell ainda passa `--agent-arg acp`.

```json
{
  "agentBin": "/usr/local/bin/zero",
  "agentArgs": ["acp"],
  "profile": "zero"
}
```

## Onde o shell guarda os arquivos

No Linux, `app.getPath("userData")` é `$XDG_CONFIG_HOME/zero-bridge-desktop` quando `XDG_CONFIG_HOME` existe, e `~/.config/zero-bridge-desktop` caso contrário. `app.getPath("logs")` é esse diretório mais `logs`. macOS e Windows não são declarados até a desktop #10 ter teste naquele SO.

| O quê | Onde |
| --- | --- |
| `shell-config.json`, `window-bounds.json` | `app.getPath("userData")` |
| `localStorage` da página | o perfil do Chromium nesse mesmo diretório de dados. O shell não escolhe o caminho |
| `shell.log` | `app.getPath("logs")`. As linhas gravadas passam por `src/redactLog.ts` |
| Diretório do token e `bridge.sock` | `$XDG_RUNTIME_DIR/zero-bridge` no modo `0700` quando essa variável é um caminho absoluto. Senão, `<tmpdir>/zero-bridge-<uid>` no modo `0700` no POSIX. No Windows fica `<tmpdir>/zero-bridge` |

Sem o caminho de dados do usuário ou o de logs, o shell recusa. Ele não monta um home por conta própria. Antes de usar, faz `lstat` do diretório privado e recusa symlink, outro dono ou modo diferente de `0700`, sem seguir o link. Um `unixSocket` absoluto em `shell-config.json` é o caminho do operador. O socket que o shell alocaria é `bridge.sock` nesse diretório privado. O listen padrão continua a porta loopback efêmera.

## Token e Segurança

- Um **token por lançamento** é gerado pelo processo principal do Electron e escrito num arquivo `0600` no diretório privado acima, em `<uuid>/` (`0700`). Se o `chmod` falha, o diretório é apagado e o lançamento aborta. `ZB_E2E_TOKEN_FILE` só troca o diretório nos testes.
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

O Electron 44 não traz mais script de instalação. O `postinstall` da raiz roda `node node_modules/electron/install.js` quando os scripts estão ligados. `allowScripts` continua permitindo só `electron@44.9.3`. Os outros pacotes com script de instalação estão `false` em `allowScripts`. O Node 22.23.3 traz o npm 10.9.9, que ignora esse campo e roda todos os scripts de instalação. O CI instala o npm 12.2.0 e depois usa este mesmo comando (`.github/workflows/check.yml` e `.github/workflows/package.yml`).

A suíte compila `cmd/zero-bridge` e `cmd/acpfake` do módulo Go. Defina `ZB_BRIDGE_SRC` com o diretório desse módulo, ou deixe o bridge em `./zero-bridge` ou `../zero-bridge`.

## Atualização

Baixe o novo AppImage/.deb e substitua. Canal de auto-atualização ainda não existe (planejado para follow-up do S23c).

## Reportando Problemas de Segurança

Email: `fabio.tleitao@gmail.com` (chave PGP no perfil GitHub)

**Não** abra issue público para vulnerabilidades de segurança.