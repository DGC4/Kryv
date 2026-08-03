# FastPix Integration Research

## Credentials
The user provided a `.env` file with:
- `SECRET_KEY`: `a8feade5-d57b-4465-a694-1e7912b67777`
- `ACCESS_TOKEN`: `5f03572a-803f-4863-98d2-c551b79b0df2`

## SDK and Installation
- **NPM Package**: `@fastpix/fastpix-node`
- **Installation**: `pnpm add @fastpix/fastpix-node`
- **Frontend Player**: `@fastpix/fp-player`

## API Capabilities
- **Live Streaming**: Real RTMP ingest + HLS playback.
- **VOD**: On-demand asset transcoding.
- **Free Tier**: 100,000 streaming minutes/month + 10 videos + $25 free credit.

## Migration Plan
1. Replace `@mux/mux-node` with `@fastpix/fastpix-node` in the backend.
2. Update `lib/mux.ts` to `lib/fastpix.ts` (or keep name and swap implementation).
3. Update `channels.ts` and `videos.ts` routes.
4. Update `webhooks.ts` for FastPix webhook format.
5. Update frontend `Live.tsx`, `Watch.tsx`, `Cinema.tsx` to use FastPix playback logic.
