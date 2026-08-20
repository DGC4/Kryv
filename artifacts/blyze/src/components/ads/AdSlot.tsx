import { ExternalLink, Flag, Info, Volume2, VolumeX } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * This is deliberately independent from the API/server runtime gate. Both must
 * be explicitly enabled in a future, separately reviewed launch. Keeping the
 * presentation layer false by default prevents a UI import from accidentally
 * activating ad rendering during ordinary Cinema, Watch, or Live work.
 */
export const AD_DELIVERY_PRESENTATION_ENABLED = false;

export type KryvAdSurface = "cinema" | "watch" | "live" | "clip";

export type AdCreativePresentation = {
  decisionId: string;
  placement: string;
  advertiserName: string;
  label: string;
  assetUrl: string;
  creativeType: "image" | "video" | "sponsorship" | "house";
  durationSeconds?: number | null;
  skipAfterSeconds?: number | null;
  syntheticMediaLabel?: string | null;
  callToActionLabel?: string | null;
};

export type AdSlotProps = {
  surface: KryvAdSurface;
  creative?: AdCreativePresentation | null;
  /**
   * The host must validate a server-returned, allowlisted destination before it
   * invokes this callback. The component intentionally never accepts a raw
   * landing URL, preventing unreviewed creative content from navigating users.
   */
  onCallToAction?: (decisionId: string) => void;
  onFeedback?: (decisionId: string) => void;
  onSkip?: (decisionId: string) => void;
  className?: string;
};

function formatRemaining(seconds: number) {
  const safe = Math.max(0, Math.ceil(seconds));
  return `0:${String(safe).padStart(2, "0")}`;
}

function isApprovedCreativeAssetUrl(value: string) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function AdDisclosure({
  advertiserName,
  label,
  syntheticMediaLabel,
}: Pick<
  AdCreativePresentation,
  "advertiserName" | "label" | "syntheticMediaLabel"
>) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-black uppercase tracking-[0.13em] text-white/85">
      <span className="rounded-full border border-primary/35 bg-primary/15 px-2 py-1 text-primary">
        Sponsored
      </span>
      <span className="text-white/70">{label}</span>
      <span className="text-white/35">by</span>
      <span className="text-white">{advertiserName}</span>
      {syntheticMediaLabel && (
        <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-2 py-1 text-amber-100">
          {syntheticMediaLabel}
        </span>
      )}
    </div>
  );
}

/**
 * Future-safe, disclosure-first visual treatment for a policy-eligible ad.
 * It returns `null` while the presentation kill switch is disabled or there is
 * no fully formed decision, so content never waits on advertising.
 */
export function AdSlot({
  surface,
  creative,
  onCallToAction,
  onFeedback,
  onSkip,
  className,
}: AdSlotProps) {
  const [muted, setMuted] = useState(true);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const durationSeconds = Math.max(0, creative?.durationSeconds ?? 0);
  const skipAfterSeconds = Math.max(0, creative?.skipAfterSeconds ?? 0);
  const skipAvailable = Boolean(creative && elapsedSeconds >= skipAfterSeconds);

  useEffect(() => {
    setElapsedSeconds(0);
  }, [creative?.decisionId]);

  useEffect(() => {
    if (!creative || !AD_DELIVERY_PRESENTATION_ENABLED || durationSeconds <= 0)
      return;
    const interval = window.setInterval(() => {
      setElapsedSeconds((current) => Math.min(durationSeconds, current + 1));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [creative, durationSeconds]);

  if (
    !AD_DELIVERY_PRESENTATION_ENABLED ||
    !creative ||
    !isApprovedCreativeAssetUrl(creative.assetUrl)
  )
    return null;

  const remainingSeconds = Math.max(0, durationSeconds - elapsedSeconds);
  const mediaLabel = `${creative.label}, sponsored content on Kryv ${surface}`;

  return (
    <section
      className={`relative overflow-hidden rounded-2xl border border-primary/30 bg-[#0b1018] text-white shadow-[0_18px_50px_rgba(0,0,0,0.35)] ${className ?? ""}`}
      aria-label={mediaLabel}
      data-kryv-ad-slot={surface}
      data-kryv-ad-placement={creative.placement}
    >
      <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 bg-gradient-to-b from-black/80 to-transparent p-3 sm:p-4">
        <AdDisclosure
          advertiserName={creative.advertiserName}
          label={creative.label}
          syntheticMediaLabel={creative.syntheticMediaLabel}
        />
        <button
          type="button"
          onClick={() => onFeedback?.(creative.decisionId)}
          className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border border-white/20 bg-black/45 px-2.5 text-[11px] font-bold text-white/80 backdrop-blur transition hover:border-primary/60 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label={`Provide feedback about sponsored content from ${creative.advertiserName}`}
        >
          <Flag className="h-3.5 w-3.5" /> Feedback
        </button>
      </div>

      <div className="relative aspect-video bg-black">
        {creative.creativeType === "video" ? (
          <video
            className="h-full w-full object-cover"
            src={creative.assetUrl}
            muted={muted}
            autoPlay
            playsInline
            preload="metadata"
            aria-label={mediaLabel}
            onTimeUpdate={(event) =>
              setElapsedSeconds(
                Math.min(
                  durationSeconds,
                  Math.floor(event.currentTarget.currentTime),
                ),
              )
            }
          />
        ) : (
          <img
            src={creative.assetUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
      </div>

      <div className="relative flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-bold text-white/75">
            <Info className="h-3.5 w-3.5 text-primary" /> Advertisement
          </p>
          <p className="mt-1 text-xs leading-relaxed text-white/50">
            Kryv labels paid placements separately from creator and editorial
            content.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {creative.creativeType === "video" && (
            <button
              type="button"
              onClick={() => setMuted((current) => !current)}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.06] px-3 text-xs font-bold text-white/85 transition hover:border-white/30 hover:bg-white/[0.11] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label={muted ? "Unmute advertisement" : "Mute advertisement"}
            >
              {muted ? (
                <VolumeX className="h-3.5 w-3.5" />
              ) : (
                <Volume2 className="h-3.5 w-3.5" />
              )}
              {muted ? "Unmute" : "Mute"}
            </button>
          )}
          {onCallToAction && (
            <button
              type="button"
              onClick={() => onCallToAction(creative.decisionId)}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-primary px-3.5 text-xs font-black text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <ExternalLink className="h-3.5 w-3.5" />{" "}
              {creative.callToActionLabel || "Learn more"}
            </button>
          )}
          {onSkip &&
            (skipAvailable ? (
              <button
                type="button"
                onClick={() => onSkip(creative.decisionId)}
                className="inline-flex min-h-10 items-center rounded-xl border border-white/20 bg-white/[0.06] px-3.5 text-xs font-black text-white transition hover:border-primary/60 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                Skip ad
              </button>
            ) : (
              <span
                className="inline-flex min-h-10 items-center rounded-xl border border-white/10 bg-black/25 px-3 text-xs font-bold text-white/55"
                aria-live="polite"
              >
                {skipAfterSeconds > 0
                  ? `Skip in ${formatRemaining(skipAfterSeconds - elapsedSeconds)}`
                  : `Ad ${formatRemaining(remainingSeconds)}`}
              </span>
            ))}
        </div>
      </div>
    </section>
  );
}
