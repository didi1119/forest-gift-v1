#!/bin/sh
set -eu

NODE_BIN="${NODE_BIN:-node}"

SCRIPTS="
 scripts/e2e-admin-ui.js
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
 scripts/e2e-api-edge-cases.js
"

for script in $SCRIPTS; do
  echo "==> $script"
  "$NODE_BIN" "$script"
done
