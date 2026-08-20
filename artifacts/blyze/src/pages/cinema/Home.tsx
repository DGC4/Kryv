import { Link } from "wouter";
import type { CinemaTitle, ViewerProfile } from "@workspace/api-client-react";
import {
  useCreateViewerProfile,
  useGetCinemaHome,
  useListCategories,
  useListViewerProfiles,
} from "@workspace/api-client-react";
import {
  Clapperboard,
  Info,
  LockKeyhole,
  Play,
  Plus,
  Sparkles,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { type FormEvent, useEffect, useState } from "react";
import { useAuthStore } from "@/lib/auth-store";
import { getApiUrl } from "@/lib/api";
import { MediaRail, MediaRailSkeleton } from "@/components/media/MediaRail";
import { AdSlot } from "@/components/ads/AdSlot";

const GENRE_THEMES = [
  "from-red-500/80 via-orange-500/30 to-black",
  "from-violet-500/80 via-fuchsia-500/30 to-black",
  "from-sky-500/80 via-cyan-500/30 to-black",
  "from-emerald-500/80 via-teal-500/30 to-black",
  "from-amber-400/80 via-yellow-500/30 to-black",
  "from-indigo-500/80 via-blue-500/30 to-black",
];

function formatRuntime(seconds: number | null) {
  if (!seconds) return "Runtime pending";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function CinemaTitleCard({
  video,
  index,
}: {
  video: CinemaTitle;
  index: number;
}) {
  const playbackAvailable = video.playbackAvailable;
  return (
    <Link
      href={`/cinema/${video.id}`}
      className="group relative w-[142px] shrink-0 snap-start sm:w-[174px] lg:w-[196px]"
    >
      <article className="relative aspect-[2/3] overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.04] shadow-lg transition-all duration-300 group-hover:z-10 group-hover:-translate-y-2 group-hover:scale-[1.04] group-hover:border-primary/55 group-hover:shadow-2xl group-focus-visible:z-10 group-focus-visible:-translate-y-2 group-focus-visible:scale-[1.04]">
        {video.posterUrl ? (
          <img
            src={video.posterUrl}
            alt={video.title}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div
            className={`absolute inset-0 flex items-end bg-gradient-to-br ${GENRE_THEMES[index % GENRE_THEMES.length]} p-3`}
          >
            <span className="text-sm font-black text-white/90">
              {video.title}
            </span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/15 to-transparent" />
        <div className="absolute left-2.5 top-2.5">
          <span
            className={`rounded-full border px-2 py-1 text-[8px] font-black uppercase tracking-[0.12em] backdrop-blur ${playbackAvailable ? "border-emerald-300/30 bg-emerald-400/15 text-emerald-100" : "border-white/15 bg-black/35 text-white/75"}`}
          >
            {playbackAvailable ? "Watch now" : "Catalog preview"}
          </span>
        </div>
        <div className="absolute inset-x-0 bottom-0 p-3 transition-transform duration-300 group-hover:translate-y-0 sm:translate-y-6">
          <h3 className="truncate text-sm font-black text-white">
            {video.title}
          </h3>
          <p className="mt-1 truncate text-[10px] font-semibold text-white/65">
            {video.genres[0] || "Kryv Cinema"} ·{" "}
            {formatRuntime(video.runtimeSeconds)}
          </p>
          <div className="mt-3 flex items-center gap-2 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white text-black">
              <Play className="h-3.5 w-3.5 fill-current" />
            </span>
            <span className="text-[10px] font-black text-white">
              View title
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}

function CinemaProfileGate({
  profiles,
  onSelect,
  onCreate,
  isCreating,
  isSelecting,
  selectionError,
}: {
  profiles: ViewerProfile[];
  onSelect: (profile: ViewerProfile, pin?: string) => Promise<boolean>;
  onCreate: (name: string) => void;
  isCreating: boolean;
  isSelecting: boolean;
  selectionError: string | null;
}) {
  const [name, setName] = useState("");
  const [lockedProfile, setLockedProfile] = useState<ViewerProfile | null>(
    null,
  );
  const [pin, setPin] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreate(trimmed);
    setName("");
  };

  const chooseProfile = (profile: ViewerProfile) => {
    if (profile.isLocked) {
      setLockedProfile(profile);
      setPin("");
      return;
    }
    void onSelect(profile);
  };

  const unlockProfile = async (event: FormEvent) => {
    event.preventDefault();
    if (!lockedProfile || !pin) return;
    const selected = await onSelect(lockedProfile, pin);
    if (selected) {
      setLockedProfile(null);
      setPin("");
    }
  };

  return (
    <div className="relative z-10 flex min-h-[calc(100vh-3.5rem)] items-center justify-center overflow-hidden bg-[#08090d] px-4 py-10 text-white">
      <div className="pointer-events-none absolute -left-24 top-8 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 right-0 h-96 w-96 rounded-full bg-indigo-500/15 blur-3xl" />
      <main className="relative w-full max-w-3xl text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary">
          <UserRound className="h-5 w-5" />
        </div>
        <p className="mt-5 text-[11px] font-black uppercase tracking-[0.2em] text-primary">
          Kryv Cinema
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">
          Who&apos;s watching?
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-white/55">
          Choose a profile for a personal Cinema session. Profile selection is
          private to this signed-in browser session and keeps maturity settings
          separate.
        </p>
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {profiles.map((profile) => (
            <button
              key={profile.id}
              type="button"
              onClick={() => chooseProfile(profile)}
              disabled={isSelecting}
              className="group rounded-2xl p-2 text-center transition-transform hover:-translate-y-1 disabled:cursor-wait disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <div className="relative mx-auto aspect-square w-full max-w-32 overflow-hidden rounded-2xl border border-white/[0.12] bg-gradient-to-br from-primary/25 to-indigo-500/25 shadow-lg transition-colors group-hover:border-primary/70">
                {profile.avatarUrl ? (
                  <img
                    src={profile.avatarUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-4xl font-black text-white/80">
                    {profile.name.slice(0, 1).toUpperCase()}
                  </div>
                )}
                {profile.isKidsProfile && (
                  <span className="absolute bottom-2 left-2 rounded-full bg-black/65 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-white backdrop-blur">
                    Kids
                  </span>
                )}
                {profile.isLocked && (
                  <span className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-black/65 text-white backdrop-blur">
                    <LockKeyhole className="h-3.5 w-3.5" />
                    <span className="sr-only">Locked profile</span>
                  </span>
                )}
              </div>
              <span className="mt-3 block truncate text-sm font-black text-white group-hover:text-primary">
                {profile.name}
              </span>
              <span className="mt-1 block text-[10px] font-semibold text-white/45">
                {profile.isLocked
                  ? "PIN protected"
                  : profile.isKidsProfile
                    ? "Kids profile"
                    : "Select profile"}
              </span>
            </button>
          ))}
        </div>
        <form
          onSubmit={submit}
          className="mx-auto mt-7 flex max-w-sm gap-2 rounded-2xl border border-white/[0.1] bg-white/[0.035] p-2"
        >
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={40}
            placeholder="Add a profile"
            className="min-w-0 flex-1 bg-transparent px-3 text-sm text-white outline-none placeholder:text-white/35"
          />
          <Button
            type="submit"
            disabled={isCreating || !name.trim()}
            className="h-10 rounded-xl px-4 font-black"
          >
            <Plus className="mr-1.5 h-4 w-4" /> Add
          </Button>
        </form>
        <p className="mt-4 text-xs text-white/30">
          Profile PIN changes require your account password again. Selecting a
          profile never stores its ID or PIN in browser storage.
        </p>
      </main>

      {lockedProfile && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm"
          role="presentation"
        >
          <form
            onSubmit={unlockProfile}
            className="w-full max-w-sm rounded-3xl border border-white/[0.12] bg-[#0c1017] p-6 text-left shadow-2xl"
            aria-labelledby="profile-pin-heading"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/35 bg-primary/10 text-primary">
              <LockKeyhole className="h-5 w-5" />
            </div>
            <h2
              id="profile-pin-heading"
              className="mt-4 text-xl font-black text-white"
            >
              Enter {lockedProfile.name}&apos;s PIN
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-white/55">
              This profile is protected. Attempts are rate limited for your
              account.
            </p>
            <label htmlFor="viewer-profile-pin" className="sr-only">
              Profile PIN
            </label>
            <input
              id="viewer-profile-pin"
              value={pin}
              onChange={(event) =>
                setPin(event.target.value.replace(/\D/g, "").slice(0, 8))
              }
              inputMode="numeric"
              autoComplete="off"
              pattern="[0-9]*"
              maxLength={8}
              autoFocus
              className="mt-5 h-12 w-full rounded-xl border border-white/[0.14] bg-black/30 px-4 text-center font-mono text-lg tracking-[0.35em] text-white outline-none placeholder:tracking-normal placeholder:text-white/30 focus:border-primary focus:ring-2 focus:ring-primary/35"
              placeholder="PIN"
            />
            {selectionError && (
              <p
                className="mt-3 text-xs font-semibold text-red-200"
                role="alert"
              >
                {selectionError}
              </p>
            )}
            <div className="mt-5 flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setLockedProfile(null);
                  setPin("");
                }}
                className="flex-1 border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSelecting || pin.length < 4}
                className="flex-1 font-black"
              >
                {isSelecting ? "Checking…" : "Continue"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default function CinemaHome() {
  const { user } = useAuthStore();
  const {
    data: home,
    isLoading: homeLoading,
    isError: homeError,
    refetch: refetchHome,
  } = useGetCinemaHome();
  const {
    data: genres,
    isLoading: genresLoading,
    isError: genresError,
    refetch: refetchGenres,
  } = useListCategories({ kind: "genre" });
  const profilesQuery = useListViewerProfiles({
    query: { enabled: Boolean(user) },
  });
  const createViewerProfile = useCreateViewerProfile();
  const [activeProfileId, setActiveProfileId] = useState<number | null>(null);
  const [activeGenre, setActiveGenre] = useState<string | null>(null);
  const [profileGrantResolved, setProfileGrantResolved] = useState(false);
  const [isSelectingProfile, setIsSelectingProfile] = useState(false);
  const [profileSelectionError, setProfileSelectionError] = useState<
    string | null
  >(null);

  useEffect(() => {
    let active = true;
    if (!user) {
      setActiveProfileId(null);
      setProfileGrantResolved(true);
      return () => {
        active = false;
      };
    }
    if (!profilesQuery.data) {
      setProfileGrantResolved(false);
      return () => {
        active = false;
      };
    }

    setProfileGrantResolved(false);
    void fetch(getApiUrl("/api/me/profiles/active"), { credentials: "include" })
      .then(async (response) => {
        if (!response.ok)
          throw new Error("Unable to restore profile selection");
        return response.json() as Promise<{ profile: ViewerProfile | null }>;
      })
      .then(({ profile }) => {
        if (!active) return;
        setActiveProfileId(profile?.id ?? null);
      })
      .catch(() => {
        if (active) setActiveProfileId(null);
      })
      .finally(() => {
        if (active) setProfileGrantResolved(true);
      });

    return () => {
      active = false;
    };
  }, [profilesQuery.data, user?.id]);

  const selectProfile = async (
    profile: ViewerProfile,
    pin?: string,
  ): Promise<boolean> => {
    setIsSelectingProfile(true);
    setProfileSelectionError(null);
    try {
      const response = await fetch(
        getApiUrl(`/api/me/profiles/${profile.id}/select`),
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(pin ? { pin } : {}),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        profile?: ViewerProfile;
      };
      if (!response.ok || !payload.profile) {
        throw new Error(payload.error || "Unable to select this profile.");
      }
      setActiveProfileId(payload.profile.id);
      return true;
    } catch (error) {
      setProfileSelectionError(
        error instanceof Error
          ? error.message
          : "Unable to select this profile.",
      );
      return false;
    } finally {
      setIsSelectingProfile(false);
    }
  };

  const createProfile = (name: string) => {
    createViewerProfile.mutate(
      { data: { name } },
      {
        onSuccess: async (profile) => {
          await profilesQuery.refetch();
          await selectProfile(profile);
        },
      },
    );
  };

  if (
    homeLoading ||
    genresLoading ||
    (user && (profilesQuery.isLoading || !profileGrantResolved))
  )
    return (
      <div className="mx-auto w-full max-w-[1600px] space-y-8 px-4 py-10 sm:px-6 lg:px-8">
        <div className="h-[48vh] animate-pulse rounded-3xl border border-white/[0.06] bg-white/[0.035]" />
        <div>
          <div className="mb-4 h-7 w-56 animate-pulse rounded bg-white/[0.07]" />
          <MediaRailSkeleton portrait label="Loading Kryv Cinema catalog" />
        </div>
      </div>
    );
  if (homeError || genresError)
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4 text-center">
        <div>
          <Clapperboard className="mx-auto h-8 w-8 text-red-200/70" />
          <h1 className="mt-4 text-2xl font-bold text-red-100">
            Cinema catalog is temporarily unavailable
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-red-100/70">
            Kryv cannot safely present a partial catalog while owner-published
            titles or their genre metadata are unavailable.
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              void Promise.all([refetchHome(), refetchGenres()]);
            }}
            className="mt-5 border-red-200/25 bg-red-200/[0.08] font-black text-red-50 hover:bg-red-200/[0.14] hover:text-red-50"
          >
            Retry Cinema
          </Button>
        </div>
      </div>
    );
  const activeProfile =
    profilesQuery.data?.find((profile) => profile.id === activeProfileId) ??
    null;
  if (user && !activeProfile)
    return (
      <CinemaProfileGate
        profiles={profilesQuery.data ?? []}
        onSelect={selectProfile}
        onCreate={createProfile}
        isCreating={createViewerProfile.isPending}
        isSelecting={isSelectingProfile}
        selectionError={profileSelectionError}
      />
    );

  const { hero, rows } = home || { hero: null, rows: [] };
  const visibleRows = activeGenre
    ? rows
        .map((row) => ({
          ...row,
          items: row.items.filter((title) =>
            title.genres.some(
              (genre) =>
                genre.toLocaleLowerCase() === activeGenre.toLocaleLowerCase(),
            ),
          ),
        }))
        .filter((row) => row.items.length > 0)
    : rows;
  const hasVisibleTitles = activeGenre
    ? visibleRows.some((row) => row.items.length > 0)
    : Boolean(hero) || visibleRows.some((row) => row.items.length > 0);
  const heroReady = Boolean(hero?.playbackAvailable);

  return (
    <div className="relative z-10 overflow-hidden pb-16 sm:pb-24">
      <section className="relative overflow-hidden border-b border-white/[0.06] bg-[#090b11]">
        {hero?.backdropUrl && (
          <>
            <img
              src={hero.backdropUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-45"
            />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(6,7,12,0.96)_0%,rgba(6,7,12,0.8)_39%,rgba(6,7,12,0.18)_100%)]" />
          </>
        )}
        <div className="relative mx-auto flex min-h-[350px] max-w-[1600px] flex-col justify-end px-4 py-10 sm:min-h-[500px] sm:px-6 sm:py-14 lg:px-8">
          <div className="absolute right-4 top-5 z-10 sm:right-6 sm:top-7 lg:right-8">
            {activeProfile && (
              <button
                type="button"
                onClick={() => setActiveProfileId(null)}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/35 px-3 py-1.5 text-xs font-bold text-white/80 backdrop-blur transition-colors hover:bg-white/15"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-[10px] text-primary">
                  {activeProfile.name.slice(0, 1).toUpperCase()}
                </span>
                {activeProfile.name}
              </button>
            )}
          </div>
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/35 px-3 py-1 text-xs font-semibold text-white/80 backdrop-blur">
              <Clapperboard className="h-3.5 w-3.5 text-primary" /> Kryv Cinema
            </div>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
              {hero?.title || "Kryv Cinema"}
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/65 sm:text-base">
              {hero?.synopsis ||
                "A carefully governed catalog for original and licensed stories, with title access tied to publishing and rights status."}
            </p>
            {hero && (
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-bold text-white/65">
                <span>{hero.genres[0] || "Kryv Cinema"}</span>
                <span>{formatRuntime(hero.runtimeSeconds)}</span>
                <span
                  className={`inline-flex items-center gap-1.5 ${heroReady ? "text-emerald-200" : "text-white/55"}`}
                >
                  <LockKeyhole className="h-3.5 w-3.5" />{" "}
                  {heroReady ? "Watch now" : "Catalog preview"}
                </span>
              </div>
            )}
            <div className="mt-6 flex flex-wrap gap-3">
              {hero && (
                <Link href={`/cinema/${hero.id}`}>
                  <Button className="h-11 rounded-xl bg-white px-5 text-sm font-black text-black hover:bg-white/90">
                    <Info className="mr-2 h-4 w-4" /> Title details
                  </Button>
                </Link>
              )}
              <span className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/20 bg-black/25 px-4 text-xs font-bold text-white/70 backdrop-blur">
                <LockKeyhole className="h-3.5 w-3.5 text-primary" />{" "}
                Rights-aware catalog
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Presentation-only future placement. It remains empty while both client and server advertising gates are disabled. */}
      <AdSlot surface="cinema" />

      <div className="mx-auto max-w-[1600px] space-y-10 px-4 py-8 sm:space-y-14 sm:px-6 sm:py-10 lg:px-8">
        {hasVisibleTitles ? (
          visibleRows.map((row, index) => (
            <section key={`${row.title}-${index}`}>
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-primary">
                    <Sparkles className="h-4 w-4" />
                    <span className="text-xs font-semibold">
                      {activeGenre
                        ? `${activeGenre} collection`
                        : "Cinema collection"}
                    </span>
                  </div>
                  <h2 className="mt-1 text-xl font-bold text-white sm:text-2xl">
                    {activeGenre ? `${row.title} · ${activeGenre}` : row.title}
                  </h2>
                  <p className="mt-1 text-xs text-white/40">
                    Hover or focus a title for its real catalog metadata.
                    Trailer playback only appears after a rights-cleared trailer
                    asset is published.
                  </p>
                </div>
              </div>
              <MediaRail
                label={`Cinema titles: ${activeGenre ? `${row.title}, ${activeGenre}` : row.title}`}
              >
                {row.items.map((video, itemIndex) => (
                  <CinemaTitleCard
                    key={video.id}
                    video={video}
                    index={itemIndex}
                  />
                ))}
              </MediaRail>
            </section>
          ))
        ) : activeGenre ? (
          <section className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-primary/20 bg-primary/[0.04] p-6 sm:flex-row sm:items-center sm:p-8">
            <div>
              <p className="text-xs font-semibold text-primary">
                {activeGenre} collection
              </p>
              <h2 className="mt-2 text-2xl font-bold text-white">
                No approved {activeGenre} titles yet.
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/55">
                Cinema only shows titles that have been owner-published and are
                currently eligible for catalog display.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => setActiveGenre(null)}
              className="shrink-0 border-primary/35 bg-primary/10 font-black text-primary hover:bg-primary hover:text-primary-foreground"
            >
              Show all titles
            </Button>
          </section>
        ) : (
          <section className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-6 sm:p-8">
            <div className="flex max-w-2xl flex-col gap-3">
              <div className="flex items-center gap-2 text-primary">
                <Clapperboard className="h-5 w-5" />
                <span className="text-xs font-semibold">Cinema catalog</span>
              </div>
              <h2 className="text-2xl font-bold text-white">
                No approved titles yet.
              </h2>
              <p className="text-sm leading-relaxed text-white/55">
                Titles appear after an owner publishes their artwork, runtime,
                playback source, and rights information. An image alone never
                makes a title playable.
              </p>
            </div>
          </section>
        )}

        <section aria-labelledby="cinema-genres">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-primary">
                <Clapperboard className="h-4 w-4" />
                <span className="text-xs font-semibold">Browse by genre</span>
              </div>
              <h2
                id="cinema-genres"
                className="mt-1 text-2xl font-bold text-white sm:text-3xl"
              >
                Explore the catalog by genre
              </h2>
              <p className="mt-1 text-sm text-white/45">
                Select a genre to filter the approved Cinema catalog by real
                title metadata.
              </p>
            </div>
            {activeGenre && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setActiveGenre(null)}
                className="w-fit font-black text-primary hover:bg-primary/10 hover:text-primary"
              >
                Clear {activeGenre}
              </Button>
            )}
          </div>
          {genres && genres.length > 0 ? (
            <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 sm:mx-0 sm:grid sm:snap-none sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0 lg:grid-cols-6">
              {genres.map((genre, index) => (
                <button
                  key={genre.id}
                  type="button"
                  onClick={() =>
                    setActiveGenre((current) =>
                      current === genre.name ? null : genre.name,
                    )
                  }
                  aria-pressed={activeGenre === genre.name}
                  className={`group relative aspect-[4/5] w-[42vw] shrink-0 snap-start overflow-hidden rounded-2xl border bg-white/[0.04] p-3 text-left transition sm:w-auto sm:shrink sm:p-4 ${activeGenre === genre.name ? "border-primary ring-2 ring-primary/35" : "border-white/[0.08] hover:-translate-y-1 hover:border-primary/50"}`}
                >
                  {genre.imageUrl ? (
                    <img
                      src={genre.imageUrl}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover opacity-70 transition group-hover:scale-105"
                    />
                  ) : (
                    <div
                      className={`absolute inset-0 bg-gradient-to-br ${GENRE_THEMES[index % GENRE_THEMES.length]}`}
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                  <div className="relative flex h-full flex-col justify-between">
                    <span
                      className={`w-fit rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] backdrop-blur ${activeGenre === genre.name ? "border-primary/50 bg-primary/25 text-primary" : "border-white/20 bg-black/25 text-white/80"}`}
                    >
                      {activeGenre === genre.name ? "Selected" : "Catalog"}
                    </span>
                    <div>
                      <Clapperboard className="mb-2 h-5 w-5 text-white/75" />
                      <h3 className="text-sm font-black text-white sm:text-base">
                        {genre.name}
                      </h3>
                      <p className="mt-1 text-[11px] text-white/65">
                        Filter titles
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-sm text-white/45">
              Genre collections are being organized.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
