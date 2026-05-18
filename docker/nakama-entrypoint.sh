#!/bin/sh
# Container entrypoint that expands ${VAR} placeholders in local.yml.tpl using
# the container's environment variables, then hands off to the original Nakama
# binary (or whatever command Docker/Railway passes as CMD).
#
# Nakama's config parser (server/config.go convertRuntimeEnv) reads
# runtime.env entries as LITERAL strings — it does NOT perform shell expansion.
# So `${ADMIN_TEST_MODE}` in local.yml ends up in ctx.env verbatim instead of
# the value of $ADMIN_TEST_MODE. envsubst fixes that at boot.

set -e

TEMPLATE=/nakama/data/local.yml.tpl
RENDERED=/nakama/data/local.yml

if [ -f "$TEMPLATE" ]; then
  envsubst < "$TEMPLATE" > "$RENDERED"
fi

exec "$@"
