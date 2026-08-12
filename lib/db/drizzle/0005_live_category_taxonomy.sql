-- Forward-only controlled taxonomy seed for Kryv Live discovery.
-- Categories remain owner-governed records; client applications do not receive write access.

INSERT INTO categories (name, slug, kind, image_url)
VALUES
  ('Just Chatting', 'just-chatting', 'live_game', NULL),
  ('IRL & Travel', 'irl-travel', 'live_game', NULL),
  ('Music & DJs', 'music-djs', 'live_game', NULL),
  ('Creative', 'creative', 'live_game', NULL),
  ('Gaming', 'gaming', 'live_game', NULL),
  ('Esports', 'esports', 'live_game', NULL),
  ('Sports', 'sports', 'live_game', NULL),
  ('Talk & Podcasts', 'talk-podcasts', 'live_game', NULL),
  ('Tech & Building', 'tech-building', 'live_game', NULL),
  ('Food & Culture', 'food-culture', 'live_game', NULL),
  ('Fashion & Lifestyle', 'fashion-lifestyle', 'live_game', NULL),
  ('Special Events', 'special-events', 'live_game', NULL)
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name,
    kind = EXCLUDED.kind;
