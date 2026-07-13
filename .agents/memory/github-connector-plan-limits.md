---
name: GitHub connector plan limits
description: What to do when a user can't authorize the GitHub connector via ProposeIntegration.
---

Some users' plans do not support authorizing the GitHub connector through the normal `ProposeIntegration` flow. If the user dismisses that proposal and says something like "I don't have the upgraded version" or "connect it a different way", don't retry the same connector proposal.

**Why:** The connector flow requires account-level GitHub authorization that isn't available on every plan; repeating the same prompt just gets dismissed again.

**How to apply:** Offer the fallback of a user-supplied GitHub Personal Access Token (classic, `repo` scope, or fine-grained with Contents + Administration read/write) requested via `requestSecrets` (e.g. `GITHUB_TOKEN`), then create the repo and push using direct git/GitHub API calls instead of the `git-remote` skill's `gitPush`/`createPullRequest` (those still require the connector-based `origin` credential wiring).
