# Signed auto-update

**Português (Brasil):** [AUTO_UPDATE.pt_BR.md](AUTO_UPDATE.pt_BR.md)

This repository does not update itself. [INSTALL.md](INSTALL.md) says to replace the Linux package by hand. There is no update channel. The rule is the same for whatever toolkit builds the shell. [Desktop #18](https://github.com/FabioLeitao/zero-bridge-desktop/issues/18) does not start an updater.

An updater may land only after the following exist outside this tree:

- A signing key that is not generated, stored, or committed here.
- A signature over the package the operator installs, produced by that key.
- A check, in the shell that is about to replace itself, that verifies the signature before the new file replaces the installed one. A checksum without that signature is not enough.

Until that check exists, the shell must not download a replacement and must not call an updater.

Refs #9
Refs #18
