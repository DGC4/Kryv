---
name: Mux Node SDK webhooks
description: How to verify/parse Mux webhook payloads with @mux/mux-node (v14) without guessing a static API.
---

`@mux/mux-node`'s `Webhooks` class (exposed as `client.webhooks` on a constructed `Mux` instance) only has **instance** methods:
`unwrap(bodyString, headers, secret)` (async, returns the parsed+verified event) and `verifySignature(...)`. There is no static `Mux.Webhooks.unwrap(...)`.

**Why:** Guessed a static API first based on other SDKs' patterns; TypeScript build failed with "Property 'unwrap' does not exist on type 'typeof Webhooks'".

**How to apply:** Construct a `Mux` client (real tokens not required for webhook verification, only the webhook signing secret) and call `await mux.webhooks.unwrap(rawBodyString, req.headers, webhookSecret)`. Mount the receiving route with `express.raw({ type: "application/json" })` (not `express.json()`) so the raw string body is available for signature verification — do this on a path-specific middleware before the global JSON body parser.
