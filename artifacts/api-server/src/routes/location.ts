import { Router, type IRouter } from "express";
import type { Request, Response } from "express";

const router: IRouter = Router();

/**
 * GET /location
 * Returns the caller's IP address and resolves it to city/region/country
 * using the ip-api.com free tier (no key required, 45 req/min limit).
 * Used on the login page and enforced before going live.
 */
router.get("/location", async (req: Request, res: Response): Promise<void> => {
  // Resolve real IP — Render/Cloudflare forward via X-Forwarded-For.
  const forwarded = req.headers["x-forwarded-for"];
  const rawIp =
    (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0]?.trim()) ??
    req.socket.remoteAddress ??
    "";

  // Strip IPv6 loopback prefix so localhost dev works.
  const ip = rawIp.replace(/^::ffff:/, "");

  // For local/private IPs return a placeholder rather than calling the API.
  const isPrivate =
    !ip ||
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip);

  if (isPrivate) {
    res.json({ ip, city: null, region: null, country: null, lat: null, lon: null, resolved: false });
    return;
  }

  try {
    const apiRes = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,city,regionName,country,lat,lon`,
      { signal: AbortSignal.timeout(4000) },
    );
    if (!apiRes.ok) throw new Error(`ip-api HTTP ${apiRes.status}`);
    const data = (await apiRes.json()) as {
      status: string;
      city?: string;
      regionName?: string;
      country?: string;
      lat?: number;
      lon?: number;
    };
    if (data.status === "success") {
      res.json({
        ip,
        city: data.city ?? null,
        region: data.regionName ?? null,
        country: data.country ?? null,
        lat: data.lat ?? null,
        lon: data.lon ?? null,
        resolved: true,
      });
    } else {
      res.json({ ip, city: null, region: null, country: null, lat: null, lon: null, resolved: false });
    }
  } catch {
    res.json({ ip, city: null, region: null, country: null, lat: null, lon: null, resolved: false });
  }
});

export default router;
