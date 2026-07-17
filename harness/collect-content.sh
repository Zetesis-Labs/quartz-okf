#!/usr/bin/env bash
set -euo pipefail

# Recolecta la documentación dispersa del repo en un directorio de contenido
# para Quartz, preservando rutas (la estructura del repo = la URL del sitio).
# Los README.md se publican como index.md de su carpeta salvo que ya exista un
# index.md o una folder note (<carpeta>/<carpeta>.md), que tienen prioridad.
#
# Uso: collect-content.sh <raíz_repo> <dir_salida>

REPO="${1:?uso: collect-content.sh <raíz_repo> <dir_salida>}"
OUT="${2:?uso: collect-content.sh <raíz_repo> <dir_salida>}"

REPO="$(cd "$REPO" && pwd)"
mkdir -p "$OUT"
OUT="$(cd "$OUT" && pwd)"
rm -rf "${OUT:?}"/*

cd "$REPO"

find . \
  \( -name .git -o -name .claude -o -name .codex -o -name .agents -o -name .devcontainer -o -name node_modules -o -path "./okf/content" -o -path "./okf/skills" \) -prune -o \
  -type f ! -name 'CLAUDE.md' \( -name '*.md' -o -name '*.base' -o -name '*.png' -o -name '*.jpg' -o -name '*.jpeg' -o -name '*.svg' -o -name '*.gif' -o -name '*.webp' \) -print |
while IFS= read -r f; do
  rel="${f#./}"
  dir="$(dirname "$rel")"
  base="$(basename "$rel")"
  if [ "$base" = "README.md" ] && [ ! -f "$dir/index.md" ] &&
     { [ "$dir" = "." ] || [ ! -f "$dir/$(basename "$dir").md" ]; }; then
    dest="$dir/index.md"
  else
    dest="$rel"
  fi
  mkdir -p "$OUT/$(dirname "$dest")"
  cp "$f" "$OUT/$dest"
done

echo "Recolectados $(find "$OUT" -name '*.md' | wc -l | tr -d ' ') markdown en $OUT"
