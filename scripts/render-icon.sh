#!/bin/sh
# Regenerates the PNG sizes from assets/icon.svg.
# Requires ImageMagick (`convert`).
set -eu
root=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
svg=$root/assets/icon.svg
tmp=$(mktemp)
sed 's/#000/#fff/g' "$svg" > "$tmp"
render() {
  convert -background none -density 1024 "$1" -resize "$2x$2" "$3"
}
render "$svg" 1024 "$root/assets/icon.png"
render "$svg" 256 "$root/assets/icon-256.png"
render "$svg" 32 "$root/assets/icon-32.png"
render "$svg" 16 "$root/assets/icon-16.png"
render "$svg" 32 "$root/assets/trayTemplate.png"
render "$tmp" 32 "$root/assets/trayTemplate-on-dark.png"
rm -f "$tmp"
