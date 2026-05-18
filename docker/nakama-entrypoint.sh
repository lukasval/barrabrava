#!/bin/sh
# BarraBrava Nakama entrypoint wrapper.
#
# Forwards a known list of container environment variables into Nakama's
# runtime.env (visible to the JS runtime as ctx.env) by appending one
# --runtime.env=KEY=VALUE CLI flag per variable to whatever start command
# Docker/Railway passes as $@.
#
# Why this exists: Nakama's server/config.go convertRuntimeEnv reads YAML
# runtime.env entries as LITERAL strings — no shell expansion. So putting
# `${ADMIN_TEST_MODE}` in local.yml leaves the literal string in ctx.env.
# CLI flags, in contrast, are expanded by the shell before reaching Nakama,
# so the real values land where the runtime can see them. This is the
# canonical Heroic Labs pattern for cloud deploys (see runtime_javascript_init.go).
#
# To add a new env var: append the variable name (no $) to RUNTIME_ENV_VARS
# below. The value is read from the container env at boot. Missing vars
# become empty strings — which is what Nakama treats as "unset" anyway.

set -e

RUNTIME_ENV_VARS="
  ADMIN_BEARER
  ADMIN_TEST_MODE
  API_FOOTBALL_KEY
  FCM_PROJECT_ID
  FCM_SERVICE_ACCOUNT_B64
  PASSWORD_RESET_BASE_URL
  RESEND_API_KEY
  RESEND_ENABLED
  RESEND_FROM
  RESEND_FROM_EMAIL
"

# Build the --runtime.env=KEY=VALUE args using POSIX positional params so
# quoting is preserved even for long base64 values (e.g. FCM_SERVICE_ACCOUNT_B64).
for v in $RUNTIME_ENV_VARS; do
  eval "val=\${${v}:-}"
  set -- "$@" "--runtime.env=${v}=${val}"
done

exec "$@"
