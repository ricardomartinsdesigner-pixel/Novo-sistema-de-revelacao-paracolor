#!/bin/sh
set -eu

APP_OUTPUT_DIR=/var/lib/paracolor/app-output
mkdir -p "$APP_OUTPUT_DIR"
if [ ! -f "$APP_OUTPUT_DIR/current/server/index.mjs" ]; then
  mkdir -p "$APP_OUTPUT_DIR/current"
  cp -a /opt/paracolor/.output/. "$APP_OUTPUT_DIR/current/"
fi
ln -sfn "$APP_OUTPUT_DIR/current" /app/.output

exec node /app/.output/server/index.mjs
