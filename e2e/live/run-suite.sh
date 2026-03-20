#!/bin/sh
set -eu

DEFAULT_NODE_BIN="/Users/kobe/.nvm/versions/node/v22.14.0/bin/node"
if [ -z "${NODE_BIN:-}" ]; then
  if [ -x "$DEFAULT_NODE_BIN" ]; then
    NODE_BIN="$DEFAULT_NODE_BIN"
  else
    NODE_BIN="node"
  fi
fi

PLAYWRIGHT_NODE_MODULES="${PLAYWRIGHT_NODE_MODULES:-/tmp/codex-browser-test/node_modules}"
if [ -z "${NODE_PATH:-}" ] && [ -d "$PLAYWRIGHT_NODE_MODULES" ]; then
  export NODE_PATH="$PLAYWRIGHT_NODE_MODULES"
fi
export PLAYWRIGHT_NODE_MODULES

SCRIPTS="
 scripts/e2e-admin-ui.js
 scripts/e2e-booking-line-attribution-ui.js
 scripts/e2e-partner-financial-ui.js
 scripts/e2e-partner-adjustments-ui.js
 scripts/e2e-overview-batch-ui.js
 scripts/e2e-payout-management-ui.js
 scripts/e2e-payout-labels-ui.js
 scripts/e2e-batch-partner-ops-ui.js
 scripts/e2e-manual-checkin-ui.js
 scripts/e2e-retroactive-commissions-ui.js
 scripts/e2e-level-boundaries-ui.js
 scripts/e2e-level-debt-ui.js
 scripts/e2e-payout-reversal-ui.js
 scripts/e2e-public-funnel-ui.js
 scripts/e2e-application-onboarding-ui.js
 scripts/e2e-api-edge-cases.js
"

for script in $SCRIPTS; do
  echo "==> $script"
  "$NODE_BIN" "$script"
done
