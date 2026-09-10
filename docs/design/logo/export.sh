#!/usr/bin/env sh
# Regenera os PNGs a partir dos SVGs (fonte da verdade). Requer rsvg-convert (librsvg).
# Uso: sh docs/design/logo/export.sh
set -e
cd "$(dirname "$0")"
mkdir -p png
for s in 16 32 64 128 256 512 1024; do
  rsvg-convert -w $s -h $s kumite-mark.svg      -o png/kumite-mark-$s.png
  rsvg-convert -w $s -h $s kumite-mark-dark.svg -o png/kumite-mark-dark-$s.png
done
rsvg-convert -w 512  -h 512  kumite-app-icon.svg -o png/kumite-app-icon-512.png
rsvg-convert -w 1024 -h 1024 kumite-app-icon.svg -o png/kumite-app-icon-1024.png
rsvg-convert -w 32 -h 32 kumite-mark.svg -o png/favicon-32.png
rsvg-convert -w 180 -h 180 kumite-app-icon.svg -o png/apple-touch-icon-180.png
for f in kumite-lockup-horizontal kumite-lockup-horizontal-dark kumite-lockup-horizontal-on-paper kumite-lockup-horizontal-on-ink kumite-lockup-stacked kumite-lockup-stacked-dark kumite-wordmark kumite-wordmark-paper; do
  rsvg-convert -w 1200 $f.svg -o png/$f-1200.png
  rsvg-convert -w 2400 $f.svg -o png/$f-2400.png
done
echo "png/ regenerado: $(ls png | wc -l) arquivos"
