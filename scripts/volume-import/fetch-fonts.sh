#!/bin/sh
# Reference outlines of Noto Naskh Arabic 2.021 (SIL Open Font License), used to
# identify the glyphs embedded in the volume PDFs. Downloaded from npm on demand.
set -e
cd "$(dirname "$0")"
mkdir -p fonts
tmp=$(mktemp -d)
(cd "$tmp" && npm pack --silent @fontsource/noto-naskh-arabic@5.3.0 >/dev/null && tar xzf ./*.tgz)
cp "$tmp"/package/files/noto-naskh-arabic-arabic-400-normal.woff fonts/
cp "$tmp"/package/files/noto-naskh-arabic-arabic-700-normal.woff fonts/
rm -rf "$tmp"
echo "Reference fonts ready in $(pwd)/fonts"
