import { useEffect, useState } from "react";
import { Link, useParams } from "wouter";
import {
  type ViewerProfile,
  useGetCinemaTitle,
} from "@workspace/api-client-react";
import KryvPlayer from "@/components/video/KryvPlayer";
import {
  ArrowLeft,
  Clapperboard,
  Film,
  Info,
  Loader2,
  LockKeyhole,
  Play,
  Share2,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePageMetadata } from "@/hooks/use-page-metadata";
import { useToast } from "@/hooks/use-toast";
import { CinemaDiscussion } from "@/components/discussion/CinemaDiscussion";
import { useAuthStore } from "@/lib/auth-store";
import { getApiUrl } from "@/lib/api";

function formatRuntime(seconds: number | null) {
  if (!seconds) return "Runtime unavailable";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function entitlementLabel(
  entitlement: "free" | "subscription" | "rental" | "purchase",
) {
  if (entitlement === "free") return "Included on Kryv";
  if (entitlement === "subscription") return "Subscription access";
  if (entitlement === "rental") return "Rental access";
  return "Purchase access";
}

const maturityRank = { kids: 0, standard: 1, mature: 2 } as const;

export default function CinemaDetail() {
  const { id } = useParams<{ id: string }>();
  const cinemaTitleId = Number.parseInt(id || "0", 10);
  const signedInUser = useAuthStore((state) => state.user);
  const [activeProfile, setActiveProfile] = useState<ViewerProfile | null>(
    null,
  );
  const [profileResolved, setProfileResolved] = useState(!signedInUser);
  useEffect(() => {
    let active = true;
    if (!signedInUser) {
      setActiveProfile(null);
      setProfileResolved(true);
      return () => {
        active = false;
      };
    }
    setProfileResolved(false);
    void fetch(getApiUrl("/api/me/profiles/active"), { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load active profile.");
        return response.json() as Promise<{ profile: ViewerProfile | null }>;
      })
      .then((payload) => {
        if (active) setActiveProfile(payload.profile ?? null);
      })
      .catch(() => {
        if (active) setActiveProfile(null);
      })
      .finally(() => {
        if (active) setProfileResolved(true);
      });
    return () => {
      active = false;
    };
  }, [signedInUser?.id]);
  const {
    data: title,
    isLoading,
    refetch: refetchTitle,
  } = useGetCinemaTitle(cinemaTitleId, {
    query: {
      enabled:
        Number.isSafeInteger(cinemaTitleId) &&
        cinemaTitleId > 0 &&
        (!signedInUser || (profileResolved && Boolean(activeProfile))),
    } as any,
  });
  const [showTrailer, setShowTrailer] = useState(false);
  const { toast } = useToast();
  usePageMetadata({
    title: title?.title ?? "Cinema title",
    description:
      title?.synopsis?.trim() ||
      "Explore an owner-published, rights-cleared title in Kryv Cinema.",
    imageUrl: title?.backdropUrl || title?.posterUrl,
    type: "video.other",
  });

  const shareCinemaTitle = async () => {
    const shareData = {
      title: `${title?.title ?? "Cinema title"} on Kryv`,
      text:
        title?.synopsis?.trim() ||
        "Explore this owner-published Cinema title on Kryv.",
      url: window.location.href,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
      await navigator.clipboard.writeText(shareData.url);
      toast({
        title: "Cinema link copied",
        description: "Share this title anywhere.",
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast({
        title: "Share unavailable",
        description: "Your browser could not open or copy the Cinema link.",
        variant: "destructive",
      });
    }
  };

  const profileSelectionRequired = Boolean(
    signedInUser && profileResolved && !activeProfile,
  );
  const maturityBlocked = Boolean(
    title &&
    activeProfile &&
    maturityRank[activeProfile.maturityLevel] <
      maturityRank[title.maturityLevel],
  );

  if (signedInUser && !profileResolved)
    return (
      <div
        className="flex h-[calc(100vh-4rem)] items-center justify-center bg-black"
        role="status"
        aria-label="Loading active Cinema profile"
      >
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="sr-only">Loading active Cinema profile</span>
      </div>
    );
  if (profileSelectionRequired)
    return (
      <div className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center gap-3 bg-black px-6 text-center">
        <LockKeyhole className="h-8 w-8 text-primary" />
        <p className="text-xl font-bold text-white">Choose a viewer profile</p>
        <p className="max-w-sm text-sm leading-relaxed text-white/50">
          Cinema playback is connected to the active profile&apos;s maturity
          setting and lock status.
        </p>
        <Link href="/cinema">
          <Button type="button" variant="secondary">
            Choose profile
          </Button>
        </Link>
      </div>
    );
  if (isLoading)
    return (
      <div
        className="flex h-[calc(100vh-4rem)] items-center justify-center bg-black"
        role="status"
        aria-label="Loading Cinema title"
      >
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="sr-only">Loading Cinema title</span>
      </div>
    );
  if (!title)
    return (
      <div className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center gap-3 bg-black px-6 text-center">
        <Clapperboard className="h-8 w-8 text-primary/70" />
        <p className="text-xl font-bold text-white">
          This Cinema title is unavailable
        </p>
        <p className="max-w-sm text-sm text-white/45">
          It may be outside its publication or viewing window.
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => refetchTitle()}
          >
            Retry
          </Button>
          <Link href="/cinema">
            <Button variant="secondary">Return to Cinema</Button>
          </Link>
        </div>
      </div>
    );

  return (
    <div className="relative z-10 min-h-screen overflow-hidden bg-black text-white">
      <section className="relative overflow-hidden border-b border-white/[0.06]">
        {title.backdropUrl ? (
          <img
            src={title.backdropUrl}
            alt=""
            decoding="async"
            fetchPriority="high"
            className="absolute inset-0 h-full w-full object-cover opacity-35"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/35 via-black to-primary/20" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/75 to-black/35" />
        <div className="absolute left-4 top-5 z-20 flex gap-2 sm:left-6 sm:top-7">
          <Link href="/cinema" aria-label="Return to Cinema">
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/40 text-white/75 backdrop-blur transition-colors hover:bg-white/15 hover:text-white">
              <ArrowLeft className="h-5 w-5" />
            </span>
          </Link>
          <button
            type="button"
            onClick={shareCinemaTitle}
            aria-label="Share Cinema title"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/40 text-white/75 backdrop-blur transition-colors hover:bg-white/15 hover:text-primary"
          >
            <Share2 className="h-4 w-4" />
          </button>
        </div>
        <div className="relative mx-auto flex min-h-[310px] max-w-[1200px] items-end px-4 pb-8 pt-24 sm:min-h-[400px] sm:px-6 sm:pb-12 lg:px-8">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/35 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <ShieldCheck className="h-3.5 w-3.5" />{" "}
              {entitlementLabel(title.entitlementType)}
            </div>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
              {title.title}
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-medium text-white/70">
              <span>{formatRuntime(title.runtimeSeconds)}</span>
              <span>{title.maturityLevel} audience</span>
              {title.genres.map((genre) => (
                <span
                  key={genre}
                  className="rounded border border-white/20 px-2 py-0.5 text-xs text-white/60"
                >
                  {genre}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
        {maturityBlocked ? (
          <div className="relative flex aspect-video flex-col items-center justify-center overflow-hidden rounded-2xl border border-amber-300/20 bg-[#050505] px-5 text-center shadow-2xl sm:rounded-3xl">
            <LockKeyhole className="h-8 w-8 text-amber-100/80" />
            <p className="mt-4 text-lg font-bold text-white">
              This title is outside this profile&apos;s maturity setting
            </p>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-white/55">
              Switch to an eligible viewer profile to continue. Kryv does not
              expose feature or trailer playback to a profile below the
              title&apos;s selected maturity level.
            </p>
            <Link href="/cinema" className="mt-5">
              <Button type="button" variant="secondary">
                Switch profile
              </Button>
            </Link>
          </div>
        ) : title.playbackAvailable && title.featurePlaybackId ? (
          <div className="relative aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl sm:rounded-3xl">
            <KryvPlayer
              src={`https://stream.fastpix.com/${title.featurePlaybackId}.m3u8`}
              poster={title.backdropUrl || title.posterUrl || undefined}
              className="h-full w-full object-contain"
              ariaLabel={`${title.title} feature player`}
            />
          </div>
        ) : (
          <div className="relative flex aspect-video flex-col items-center justify-center overflow-hidden rounded-2xl border border-amber-300/20 bg-[#050505] px-5 text-center shadow-2xl sm:rounded-3xl">
            <LockKeyhole className="h-8 w-8 text-amber-100/80" />
            <p className="mt-4 text-lg font-bold text-white">
              Viewing access is not available yet
            </p>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-white/55">
              {title.playbackBlockedReason ||
                "This title is visible in the owner-published catalog, but playback is not currently available."}
            </p>
            <span className="mt-5 inline-flex rounded-full border border-white/[0.12] bg-black/25 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-white/60">
              {entitlementLabel(title.entitlementType)}
            </span>
          </div>
        )}
        <div className="mt-7 grid gap-8 lg:grid-cols-[minmax(0,1fr)_260px]">
          <article>
            <div className="flex items-center gap-2 text-primary">
              <Info className="h-4 w-4" />
              <span className="text-xs font-semibold">About this title</span>
            </div>
            <p className="mt-3 text-base leading-relaxed text-white/75">
              {title.synopsis ||
                "Title details will be added by the Cinema publishing team."}
            </p>
            {title.trailerPlaybackId && !maturityBlocked && (
              <div className="mt-6 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Play className="h-4 w-4 fill-current" />
                    </span>
                    <div>
                      <p className="text-sm font-black text-white">
                        Trailer available
                      </p>
                      <p className="text-xs text-white/45">
                        This preview is an owner-approved Cinema asset.
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowTrailer((value) => !value)}
                    aria-expanded={showTrailer}
                    aria-controls="cinema-title-trailer"
                  >
                    {showTrailer ? "Hide trailer" : "Watch trailer"}
                  </Button>
                </div>
                {showTrailer && (
                  <div
                    id="cinema-title-trailer"
                    className="mt-4 aspect-video overflow-hidden rounded-xl border border-white/[0.08] bg-black"
                  >
                    <KryvPlayer
                      src={`https://stream.fastpix.com/${title.trailerPlaybackId}.m3u8`}
                      poster={title.backdropUrl || title.posterUrl || undefined}
                      className="h-full w-full object-contain"
                      ariaLabel={`${title.title} trailer player`}
                    />
                  </div>
                )}
              </div>
            )}
            {title.credits.length > 0 && (
              <section className="mt-8 border-t border-white/[0.08] pt-7">
                <div className="flex items-center gap-2 text-primary">
                  <Users className="h-4 w-4" />
                  <span className="text-xs font-semibold">Creator credits</span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-white/45">
                  These profiles are credited by the owner publishing desk for
                  this production.
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {title.credits.map((credit) => (
                    <Link
                      key={`${credit.channelId}-${credit.role}`}
                      href={`/profile/${credit.channelSlug}`}
                      className="group flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-3.5 transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/[0.06]"
                    >
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-white/[0.1] bg-primary/15">
                        {credit.channelAvatarUrl ? (
                          <img
                            src={credit.channelAvatarUrl}
                            alt={credit.channelDisplayName}
                            loading="lazy"
                            decoding="async"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-sm font-black text-primary">
                            {credit.channelDisplayName[0]}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-white transition group-hover:text-primary">
                          {credit.channelDisplayName}
                        </p>
                        <p className="mt-0.5 text-xs text-white/45">
                          {credit.role}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}
            <CinemaDiscussion cinemaTitleId={title.id} title={title.title} />
          </article>
          <aside className="h-fit rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
            <p className="text-xs font-semibold text-white/45">
              Viewing access
            </p>
            <p className="mt-3 text-sm font-bold text-white">
              {entitlementLabel(title.entitlementType)}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-white/45">
              {title.playbackAvailable
                ? "Availability is controlled by the title’s active publishing and rights settings."
                : title.playbackBlockedReason ||
                  "This title’s current entitlement cannot be fulfilled in Kryv yet."}
            </p>
            <div className="mt-5 border-t border-white/[0.08] pt-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-200">
                <LockKeyhole className="h-3.5 w-3.5" /> Rights-cleared release
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-white/35">
                Cinema playback remains separate from live chat and broadcast
                controls. Title discussion is a bounded, moderated comment space
                below.
              </p>
            </div>
            <div className="mt-5 border-t border-white/[0.08] pt-4">
              <Link
                href="/cinema"
                className="inline-flex items-center gap-2 text-xs font-black text-primary hover:text-white"
              >
                <Film className="h-3.5 w-3.5" /> Continue browsing Cinema
              </Link>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
