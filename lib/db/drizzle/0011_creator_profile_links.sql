-- Creator-facing public profile metadata. Additive and safe for existing production channels.
ALTER TABLE IF EXISTS channels ADD COLUMN IF NOT EXISTS website_url text;
ALTER TABLE IF EXISTS channels ADD COLUMN IF NOT EXISTS youtube_url text;
ALTER TABLE IF EXISTS channels ADD COLUMN IF NOT EXISTS instagram_url text;
ALTER TABLE IF EXISTS channels ADD COLUMN IF NOT EXISTS x_url text;

-- Stored links are optional; URL scheme and host allow-list validation is enforced in the API contract.
