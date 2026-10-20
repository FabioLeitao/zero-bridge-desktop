# Signed auto-update

This repository does not update itself. [INSTALL.md](INSTALL.md) says to replace the AppImage or deb by hand. There is no update channel.

An updater may land only after the following exist outside this tree:

- A signing key that is not generated, stored, or committed here.
- A signature over the AppImage or deb, produced by that key.
- A check that verifies the signature before the new file replaces the installed one. A checksum without that signature is not enough.

Until that check exists, the shell must not download a replacement and must not call an updater. `build.publish` stays null.

Refs #9
