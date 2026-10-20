# Auto-update assinado

Este repositório não se atualiza sozinho. [INSTALL.pt_BR.md](INSTALL.pt_BR.md) manda substituir o AppImage ou o deb à mão. Não há canal de atualização.

Um atualizador só pode entrar depois que existir, fora desta árvore:

- Uma chave de assinatura que não é gerada, guardada nem commitada aqui.
- Uma assinatura do AppImage ou do deb, feita com essa chave.
- Uma verificação dessa assinatura antes de o arquivo novo substituir o instalado. Um checksum sem essa assinatura não basta.

Enquanto essa verificação não existir, o shell não baixa um substituto e não chama um atualizador. `build.publish` continua nulo.

Refs #9
