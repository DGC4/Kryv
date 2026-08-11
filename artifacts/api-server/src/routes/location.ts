import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

/**
 * GET /location?resolve=true
 *
 * Location is entirely optional. By default this endpoint returns no location
 * data and never sends a visitor address to a third party. A client must make
 * an explicit opt-in request with resolve=true before a coarse city, region,
 * and country lookup is attempted. IP addresses are never returned to the
 * browser and are not persisted by this endpoint.
 */
router.get("/location", async (req: Request, res: Response): Promise<void> => {
  const shouldResolve = req.query.resolve === "true";
  if (!shouldResolve) {
    res.json({ city: null, region: null, country: null, lat: null, lon: null, resolved: false, optional: true });
    return;
  }

  const forwarded = req.headers["x-forwarded-for"];
  const rawIp =
    (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0]?.trim()) ??
    req.socket.remoteAddress ??
    "";
  const ip = rawIp.replace(/^::ffff:/, "");
  const isPrivate =
    !ip ||
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip);

  if (isPrivate) {
    res.json({ city: null, region: null, country: null, lat: null, lon: null, resolved: false, optional: true });
    return;
  }

  try {
    const apiRes = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,city,regionName,country,lat,lon`,
      { signal: AbortSignal.timeout(4000) },
    );
    if (!apiRes.ok) throw new Error(`location lookup HTTP ${apiRes.status}`);
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
        city: data.city ?? null,
        region: data.regionName ?? null,
        country: data.country ?? null,
        lat: data.lat ?? null,
        lon: data.lon ?? null,
        resolved: true,
        optional: true,
      });
      return;
    }
  } catch {
    // Optional enrichment should never block sign-in, browsing, or streaming.
  }

  res.json({ city: null, region: null, country: null, lat: null, lon: null, resolved: false, optional: true });
});

export default router;
