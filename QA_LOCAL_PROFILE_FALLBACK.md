# Local profile fallback smoke check

Date: 2026-08-13

The local Vite client was opened at `/profile/fano` while its API proxy had no reachable backend because the sandbox does not have a `DATABASE_URL`. The route first showed its loading state and then rendered the deliberate **Creator profile unavailable** fallback with a visible **Explore Live** action. The route did not remain in a loading loop or crash.

This is a client-only fallback check, not a production authenticated-data verification.
