#!/bin/sh

CURRENT_DIR="$PWD"
INIT_DIR="$INIT_CWD"

if command -v cygpath >/dev/null 2>&1; then
	CURRENT_DIR="$(cygpath -am "$PWD")"
	INIT_DIR="$(cygpath -am "$INIT_CWD")"
else
	CURRENT_DIR="$(pwd -P)"
	INIT_DIR="$(cd "$INIT_CWD" 2>/dev/null && pwd -P || printf '%s' "$INIT_CWD")"
fi

[ "$INIT_DIR" != "$CURRENT_DIR" ] && npm run build
