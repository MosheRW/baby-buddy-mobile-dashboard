#!/usr/bin/env bash
#
# Deploy the Android upload-keystore credentials from the gitignored
# `variables-for-bundle` file into `~/.gradle/gradle.properties`, where Gradle
# actually reads them at build time.
#
# `variables-for-bundle` (repo root, gitignored) holds the source of truth:
#
#   MYAPP_UPLOAD_STORE_FILE=my-upload-key.keystore
#   MYAPP_UPLOAD_KEY_ALIAS=my-key-alias
#   MYAPP_UPLOAD_STORE_PASSWORD=...
#   MYAPP_UPLOAD_KEY_PASSWORD=...
#
# Nothing reads that file automatically — only `~/.gradle/gradle.properties` is
# consulted by the `withAndroidReleaseSigning` plugin's Gradle code. Run this
# after cloning or whenever the credentials change:
#
#   npm run signing:deploy
#
# The upsert is idempotent: each key is replaced in place if present, appended
# otherwise. No other properties are touched.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$REPO_ROOT/variables-for-bundle"
DEST="${GRADLE_USER_HOME:-$HOME/.gradle}/gradle.properties"

if [[ ! -f "$SRC" ]]; then
  echo "error: $SRC not found." >&2
  echo "Create it with the MYAPP_UPLOAD_* keystore credentials (it is gitignored)." >&2
  exit 1
fi

mkdir -p "$(dirname "$DEST")"
touch "$DEST"

deployed=0
while IFS= read -r line || [[ -n "$line" ]]; do
  # Skip blanks and comments.
  [[ -z "${line//[[:space:]]/}" ]] && continue
  [[ "$line" =~ ^[[:space:]]*# ]] && continue
  # Only sync MYAPP_UPLOAD_* keys.
  [[ "$line" =~ ^MYAPP_UPLOAD_[A-Z_]+= ]] || continue

  key="${line%%=*}"
  if grep -q "^${key}=" "$DEST"; then
    # Replace existing line in place. Use a distinct sed delimiter (|) and
    # escape it in the value so passwords/paths with slashes are safe.
    escaped="${line//|/\\|}"
    sed -i "s|^${key}=.*|${escaped}|" "$DEST"
  else
    printf '%s\n' "$line" >> "$DEST"
  fi
  echo "  synced ${key}"
  deployed=$((deployed + 1))
done < "$SRC"

if [[ "$deployed" -eq 0 ]]; then
  echo "warning: no MYAPP_UPLOAD_* keys found in $SRC" >&2
  exit 1
fi

echo "Deployed $deployed signing var(s) to $DEST"
