# Kryv Source Integration TODO

- [x] Audit the existing `artifacts/blyze` routes, API server, database schema, Mux integration, and deployment configuration.
- [x] Identify the exact existing theme tokens, animated background components, layout conventions, and brand treatments to preserve.
- [x] Capture the native creator-studio integration decisions for design continuity, stream security, and real data ownership.
- [x] Remove the previously copied standalone dashboard directory from this source branch so the creator studio lives only in the real Kryv application.
- [x] Replace the isolated creator-dashboard copy with a first-class creator studio inside the existing Kryv application.
- [x] Reuse the existing Kryv logo, Golden D owner badge, hover badge tooltips, theme-cycle behavior, and motion system wherever appropriate.
- [x] Connect the creator studio to the existing channel, stream, category, and Mux-backed credential APIs rather than local placeholder data.
- [x] Implement clear live-stream readiness, RTMP credentials, encoder setup, and real stream-status feedback through the established backend.
- [x] Audit and fix authenticated access, source-data ownership, error states, and sensitive credential handling in the existing codebase.
- [x] Add an explicit one-time production cleanup command for any legacy plaintext Mux stream-key copies.
- [ ] Verify desktop and mobile visual consistency with the existing Kryv public surfaces.
- [ ] Configure the real Render deployment with `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET`, `MUX_WEBHOOK_SECRET`, and Clerk credentials, then verify an end-to-end authenticated broadcast and signed live-state webhook.
- [ ] Run the existing workspace build and type checks, resolve failures, commit the source integration, and push it to GitHub.
