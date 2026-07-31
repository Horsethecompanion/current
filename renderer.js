name = "current-prices"
main = "worker.js"
compatibility_date = "2025-01-01"

# Non-secret config. Set your actual GitHub Pages URL here so the
# worker only answers requests from your app (leave "*" while testing).
[vars]
ALLOWED_ORIGIN = "https://horsethecompanion.github.io"
DEFAULT_NODE = "ALB0331"

# Secrets — do NOT put these here. Set them with:
#   wrangler secret put WITS_CLIENT_ID
#   wrangler secret put WITS_CLIENT_SECRET
