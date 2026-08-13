# Lazy Route Smoke Check

The local Vite preview loaded `/search?q=kr` through the new lazy-route boundary. The page first displayed the intentional **Loading Kryv…** state and then rendered the full search interface.

Because the local preview does not have the API service available, the request settled into the explicit **Search is temporarily unavailable** state. The route did not remain blank and showed its search field, clear control, submit action, header, and footer normally.

This confirms the route module resolves and that no-data/API-unavailable handling remains explicit in the local browser environment. Production validation still requires a deployed API with public search data, including rights-cleared Cinema titles.
