import KryvPlayer from './KryvPlayer';

/**
 * Backward-compatible import surface for the existing HLS player call sites.
 * The transport and live-edge contract now live in KryvPlayer, which adds
 * Kryv-owned accessible controls above the same native/Hls.js media paths.
 */
export default KryvPlayer;
export type { KryvPlayerProps as HlsPlayerProps } from './KryvPlayer';
