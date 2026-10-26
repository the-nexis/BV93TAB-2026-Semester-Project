#!/usr/bin/env bash
set -euo pipefail
node --input-type=module - <<'JS'
try {
  const response = await fetch("http://127.0.0.1:8899", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getHealth" }),
  });
  const result = await response.json();
  if (!response.ok || result.result !== "ok") throw new Error("RPC is not healthy");
} catch {
  console.error("Surfpool is not responding at http://127.0.0.1:8899.");
  console.error("Start it in another terminal with: make localnet");
  process.exit(1);
}
JS
