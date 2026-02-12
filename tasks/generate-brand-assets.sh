#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_LOGO="${ROOT_DIR}/public/assets/images/logo.png"
OUT_ICON_DIR="${ROOT_DIR}/public/icons"
OUT_SPLASH_DIR="${ROOT_DIR}/public/splash"
OUT_BRANDING_DIR="${ROOT_DIR}/public/assets/branding"
TMP_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

if [[ ! -f "$SRC_LOGO" ]]; then
  echo "Missing source logo: $SRC_LOGO" >&2
  exit 1
fi

mkdir -p "$OUT_ICON_DIR" "$OUT_SPLASH_DIR" "$OUT_BRANDING_DIR"

resize_logo_variant() {
  local width="$1"
  local output="$2"
  sips --resampleWidth "$width" "$SRC_LOGO" --out "$output" >/dev/null 2>&1
}

# Build square icon with colored background and centered logo.
# args: canvas_px inner_ratio output
build_square_icon() {
  local canvas="$1"
  local ratio="$2"
  local output="$3"

  local inner
  inner=$(awk "BEGIN { printf \"%d\", ${canvas} * ${ratio} }")
  if (( inner < 8 )); then inner=8; fi

  local inner_logo="${TMP_DIR}/inner-${canvas}-${ratio}.png"
  sips -s format png --resampleHeightWidthMax "$inner" "$SRC_LOGO" --out "$inner_logo" >/dev/null 2>&1
  sips --padToHeightWidth "$canvas" "$canvas" --padColor 1B4F9E "$inner_logo" --out "$output" >/dev/null 2>&1
}

# Build splash image with centered logo on brand blue background.
# args: width height ratio output
build_splash() {
  local width="$1"
  local height="$2"
  local ratio="$3"
  local output="$4"

  local min_dim=$(( width < height ? width : height ))
  local inner
  inner=$(awk "BEGIN { printf \"%d\", ${min_dim} * ${ratio} }")
  if (( inner < 16 )); then inner=16; fi

  local inner_logo="${TMP_DIR}/splash-inner-${width}-${height}.png"
  sips -s format png --resampleHeightWidthMax "$inner" "$SRC_LOGO" --out "$inner_logo" >/dev/null 2>&1
  sips --padToHeightWidth "$height" "$width" --padColor 1B4F9E "$inner_logo" --out "$output" >/dev/null 2>&1
}

# Branding logo variants
resize_logo_variant 1200 "${OUT_BRANDING_DIR}/logo-hero.png"
resize_logo_variant 820 "${OUT_BRANDING_DIR}/logo-header.png"
resize_logo_variant 420 "${OUT_BRANDING_DIR}/logo-badge.png"

# Favicon set
for size in 16 32 48 64 128 256; do
  build_square_icon "$size" 0.82 "${OUT_ICON_DIR}/favicon-${size}x${size}.png"
done

# Manifest any icons
for size in 72 96 128 144 152 192 384 512; do
  build_square_icon "$size" 0.74 "${OUT_ICON_DIR}/icon-any-${size}x${size}.png"
done

# Manifest maskable icons (extra safe area)
for size in 192 512; do
  build_square_icon "$size" 0.58 "${OUT_ICON_DIR}/icon-maskable-${size}x${size}.png"
done

# Apple touch icons
for size in 120 152 167 180; do
  build_square_icon "$size" 0.7 "${OUT_ICON_DIR}/apple-touch-icon-${size}x${size}.png"
done

# iOS splash portrait
portrait_splashes=(
  "640x1136"
  "750x1334"
  "828x1792"
  "1125x2436"
  "1170x2532"
  "1242x2208"
  "1242x2688"
  "1284x2778"
  "1536x2048"
  "1668x2224"
  "1668x2388"
  "2048x2732"
)

for dims in "${portrait_splashes[@]}"; do
  w="${dims%x*}"
  h="${dims#*x}"
  build_splash "$w" "$h" 0.56 "${OUT_SPLASH_DIR}/apple-splash-${w}-${h}.png"
done

# iOS splash landscape
landscape_splashes=(
  "1136x640"
  "1334x750"
  "1792x828"
  "2436x1125"
  "2532x1170"
  "2208x1242"
  "2688x1242"
  "2778x1284"
  "2048x1536"
  "2224x1668"
  "2388x1668"
  "2732x2048"
)

for dims in "${landscape_splashes[@]}"; do
  w="${dims%x*}"
  h="${dims#*x}"
  build_splash "$w" "$h" 0.5 "${OUT_SPLASH_DIR}/apple-splash-${w}-${h}.png"
done

# Common Android splash files
android_splashes=(
  "1080x1920"
  "1440x2560"
  "1920x1080"
  "2560x1440"
)

for dims in "${android_splashes[@]}"; do
  w="${dims%x*}"
  h="${dims#*x}"
  build_splash "$w" "$h" 0.52 "${OUT_SPLASH_DIR}/android-splash-${w}-${h}.png"
done

echo "Brand assets generated in public/icons, public/splash, and public/assets/branding."
