# Kryv Render Real-Time Deployment Sources

Render’s current Blueprint reference supports `web`, `worker`, and Redis-compatible `keyvalue` services in one `render.yaml` file. It documents paid plans for workers and recommends a `healthCheckPath`, graceful shutdown delay, and explicit service configuration for production workloads.

Render Key Value is Redis-compatible (new instances run Valkey), provides internal private-network URLs for same-region services, and supports standard Redis clients including `ioredis`. Render recommends `allkeys-lru` and persistence off for loss-tolerant caches, while a job queue needs `noeviction` and durable journal-plus-snapshot persistence. Kryv should therefore use separate cache and job-queue instances rather than mix their durability and eviction requirements.

Sources:

1. [Render Blueprint YAML Reference](https://render.com/docs/blueprint-spec)
2. [Render Key Value](https://render.com/docs/key-value)
3. [Render Valkey FAQ](https://render.com/docs/valkey-faq)
