# Auto-update assinado

**English:** [AUTO_UPDATE.md](AUTO_UPDATE.md)

Este repositório não se atualiza sozinho. [INSTALL.pt_BR.md](INSTALL.pt_BR.md) manda substituir o pacote Linux à mão. Não há canal de atualização. A regra é a mesma para qualquer toolkit que monte o shell. A [desktop #18](https://github.com/FabioLeitao/zero-bridge-desktop/issues/18) não inicia um atualizador.

Um atualizador só pode entrar depois que existir, fora desta árvore:

- Uma chave de assinatura que não é gerada, guardada nem commitada aqui.
- Uma assinatura do pacote que o operador instala, feita com essa chave.
- Uma verificação, no shell que está prestes a se substituir, dessa assinatura antes de o arquivo novo substituir o instalado. Um checksum sem essa assinatura não basta.

Enquanto essa verificação não existir, o shell não baixa um substituto e não chama um atualizador.

Refs #9
Refs #18
