#!/usr/bin/env bash
# Shrink a ~70 MB pack GLB (≈1.9M tris, 4K textures) to a ~1 MB game asset.
# Usage: tools/optimize-model.sh "<pack model>.glb" assets/ships/<name>.glb
# Needs: npm i -g @gltf-transform/cli@4.1.1
set -euo pipefail
gltf-transform optimize "$1" "$2" \
  --compress quantize --texture-compress webp --texture-size 1024 \
  --simplify-ratio 0.02 --simplify-error 0.002
