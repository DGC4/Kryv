import { useListCategories, useListVideos } from "@workspace/api-client-react";
import {
  ArrowUpRight,
  Clock3,
  Film,
  Flame,
  Play,
  Search,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { VideoCard } from "@/components/VideoCard";
import { MediaRail, MediaRailSkeleton } from "@/components/media/MediaRail";
import { AdSlot } from "@/components/ads/AdSlot";

function RailHeading({
  eyebrow,
  title,
  detail,
  icon: Icon,
}: {
  eyebrow: string;
  title: string;
  detail?: string;
  icon: typeof Sparkles;
}) {
  return (
    <div className="mb-4 sm:mb-5">
      <div className="flex items-center gap-2 text-primary">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-semibold">{eyebrow}</span>
      </div>
      <h2 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">
        {title}
      </h2>
      {detail && <p className="mt-1 text-sm text-white/45">{detail}</p>}
    </div>
  );
}

export default function WatchHome() {
  const [location, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [activeCategoryId, setActiveCategoryId] = useState<
    number | undefined
  >();

  const { data: categories = [] } = useListCategories({ kind: "genre" });
  const activeCategory = useMemo(
    () => categories.find((category) => category.id === activeCategoryId),
    [activeCategoryId, categories],
  );
  const creatorChannelId = useMemo(() => {
    const candidate = Number(
      new URLSearchParams(location.split("?")[1] ?? "").get("channelId"),
    );
    return Number.isSafeInteger(candidate) && candidate > 0
      ? candidate
      : undefined;
  }, [location]);
  const {
    data: videoPage,
    isLoading,
    isError,
    refetch: refetchVideos,
  } = useListVideos({
    channelId: creatorChannelId,
    contentType: "upload",
    search: search || undefined,
    categorySlug: activeCategory?.slug,
  });
  const videos = videoPage?.items ?? [];

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setSearch(inputValue.trim());
  };
  const clearFilters = () => {
    setSearch("");
    setInputValue("");
    setActiveCategoryId(undefined);
    if (creatorChannelId !== undefined) navigate("/watch");
  };
  const isFiltered = Boolean(
    search || activeCategoryId !== undefined || creatorChannelId !== undefined,
  );
  const featuredVideo = videos[0];
  const categoryRails = useMemo(
    () =>
      categories
        .map((category) => ({
          category,
          videos: videos.filter((video) => video.categoryId === category.id),
        }))
        .filter((group) => group.videos.length > 0),
    [categories, videos],
  );

  return (
    <div className="relative z-10 mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <section className="rounded-2xl border border-white/[0.08] bg-[#0b0e14] px-5 py-7 sm:rounded-3xl sm:px-8 sm:py-10 lg:px-10">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.75fr)] lg:items-end lg:gap-10">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Film className="h-3.5 w-3.5" /> Kryv Watch
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
              Creator video, ready to watch.
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/60 sm:text-base">
              Published releases are organized by category and available once
              processing is complete.
            </p>
          </div>
          <form
            onSubmit={submitSearch}
            className="w-full rounded-2xl border border-white/[0.1] bg-black/30 p-2 backdrop-blur-sm"
          >
            <label htmlFor="watch-search" className="sr-only">
              Search Kryv Watch
            </label>
            <div className="flex items-center gap-2">
              <Search className="ml-2 h-4 w-4 shrink-0 text-white/40" />
              <input
                id="watch-search"
                type="search"
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                placeholder="Search published Watch releases"
                maxLength={64}
                className="h-11 min-w-0 flex-1 bg-transparent px-1 text-sm text-white outline-none placeholder:text-white/35"
              />
              <button
                type="submit"
                className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-primary px-3 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90 sm:px-4"
              >
                <Search className="h-3.5 w-3.5" />{" "}
                <span className="hidden sm:inline">Search</span>
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* Presentation-only future placement. The component fails closed and renders nothing until both delivery gates are separately enabled. */}
      <AdSlot surface="watch" />

      {creatorChannelId !== undefined && (
        <section className="mt-6 flex flex-col gap-3 rounded-2xl border border-primary/20 bg-primary/[0.055] px-4 py-3 sm:mt-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-white">Creator library filter</p>
            <p className="mt-1 text-xs leading-relaxed text-white/55">
              Showing ready releases from this creator. Category and title search remain available.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/watch")}
            className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl border border-primary/35 bg-black/20 px-4 text-sm font-bold text-primary transition hover:bg-primary hover:text-primary-foreground"
          >
            Show all Watch
          </button>
        </section>
      )}

      <div
        className="-mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:mt-8 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="Watch categories"
      >
        <button
          onClick={() => setActiveCategoryId(undefined)}
          className={`inline-flex min-h-10 shrink-0 items-center rounded-full px-4 text-sm font-bold transition-all ${activeCategoryId === undefined ? "bg-primary text-primary-foreground" : "border border-white/[0.09] bg-white/[0.045] text-white/65 hover:border-white/20 hover:bg-white/[0.08] hover:text-white"}`}
        >
          All releases
        </button>
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => {
              setActiveCategoryId(category.id);
              setSearch("");
              setInputValue("");
            }}
            className={`inline-flex min-h-10 shrink-0 items-center rounded-full px-4 text-sm font-bold transition-all ${activeCategoryId === category.id ? "bg-primary text-primary-foreground" : "border border-white/[0.09] bg-white/[0.045] text-white/65 hover:border-white/20 hover:bg-white/[0.08] hover:text-white"}`}
          >
            {category.name}
          </button>
        ))}
      </div>

      {isLoading ? (
        <section className="mt-8" aria-label="Loading Watch releases">
          <div className="mb-4 h-7 w-52 animate-pulse rounded bg-white/[0.07]" />
          <MediaRailSkeleton label="Loading creator releases" />
        </section>
      ) : isError ? (
        <section className="mt-6 rounded-2xl border border-red-300/20 bg-red-400/[0.05] p-6 text-center sm:mt-8 sm:p-10">
          <h2 className="text-xl font-bold text-red-100">
            Watch is temporarily unavailable
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-red-100/70">
            Kryv cannot safely show a partial or fabricated Watch library while
            the ready-upload inventory is unavailable.
          </p>
          <button
            type="button"
            onClick={() => refetchVideos()}
            className="mt-5 inline-flex min-h-10 items-center rounded-xl border border-red-200/25 bg-red-200/[0.08] px-4 text-sm font-bold text-red-50 transition hover:bg-red-200/[0.14]"
          >
            Retry Watch
          </button>
        </section>
      ) : videos.length === 0 ? (
        <section className="mt-6 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-6 sm:mt-8 sm:p-10">
          <div className="max-w-md">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10">
              <Play className="h-5 w-5 fill-primary text-primary" />
            </div>
            <h2 className="mt-5 text-xl font-bold text-white">
              {isFiltered ? "No releases matched." : "No ready releases yet."}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-white/50">
              {isFiltered
                ? "Try another title or clear the current filters."
                : "Published creator releases appear here after processing completes."}
            </p>
            {isFiltered ? (
              <button
                onClick={clearFilters}
                className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-xl border border-primary/35 bg-primary/10 px-4 text-sm font-bold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
              >
                <SlidersHorizontal className="h-4 w-4" /> Clear filters
              </button>
            ) : (
              <Link
                href="/dashboard/watch"
                className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-xl border border-primary/35 bg-primary/10 px-4 text-sm font-bold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
              >
                <Play className="h-4 w-4" /> Publish your first release
              </Link>
            )}
          </div>
        </section>
      ) : isFiltered ? (
        <section className="mt-8">
          <div className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-primary">
                <Search className="h-4 w-4" />
                <span className="text-xs font-semibold">Search results</span>
              </div>
              <h2 className="mt-1 text-2xl font-bold text-white sm:text-3xl">
                {search ? `Results for “${search}”` : activeCategory?.name}
              </h2>
            </div>
            <button
              onClick={clearFilters}
              className="text-left text-xs font-semibold text-primary hover:text-white"
            >
              Clear filters
            </button>
          </div>
          <div className="grid grid-cols-1 gap-x-4 gap-y-7 sm:grid-cols-2 sm:gap-x-5 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {videos.map((video) => (
              <VideoCard key={video.id} video={video} />
            ))}
          </div>
        </section>
      ) : (
        <div className="mt-8 space-y-12 sm:mt-10 sm:space-y-14">
          {featuredVideo && (
            <section className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0b0e14]">
              <div className="absolute inset-0">
                {featuredVideo.thumbnailUrl && (
                  <img
                    src={featuredVideo.thumbnailUrl}
                    alt=""
                    className="h-full w-full object-cover opacity-30"
                  />
                )}
              </div>
              <div className="relative flex min-h-[320px] max-w-2xl flex-col justify-end p-6 sm:min-h-[410px] sm:p-9">
                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  <Flame className="h-3.5 w-3.5" /> Featured release
                </div>
                <h2 className="mt-4 text-2xl font-bold tracking-tight text-white sm:text-4xl">
                  {featuredVideo.title}
                </h2>
                <p className="mt-2 text-sm text-white/60">
                  From {featuredVideo.channelName}
                  {featuredVideo.categoryName
                    ? ` · ${featuredVideo.categoryName}`
                    : ""}
                </p>
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <Link href={`/watch/${featuredVideo.id}`}>
                    <span className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-black transition-transform hover:-translate-y-0.5">
                      <Play className="h-4 w-4 fill-current" /> Play
                    </span>
                  </Link>
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-white/55">
                    <Clock3 className="h-3.5 w-3.5" />{" "}
                    {featuredVideo.viewCount.toLocaleString()} views
                  </span>
                </div>
              </div>
            </section>
          )}

          <section>
            <RailHeading
              eyebrow="Available now"
              title="Watch releases"
              detail="Published creator video, ready to watch."
              icon={Clock3}
            />
            <MediaRail label="Available Kryv Watch releases">
              {videos.slice(featuredVideo ? 1 : 0).map((video) => (
                <div
                  key={video.id}
                  className="w-[78vw] shrink-0 snap-start sm:w-72"
                >
                  <VideoCard video={video} />
                </div>
              ))}
            </MediaRail>
          </section>

          {categoryRails.map(({ category, videos: categoryVideos }) => (
            <section key={category.id}>
              <div className="mb-4 flex items-end justify-between gap-4">
                <RailHeading
                  eyebrow="Category"
                  title={category.name}
                  detail={`${categoryVideos.length} available ${categoryVideos.length === 1 ? "release" : "releases"}`}
                  icon={Sparkles}
                />
                <button
                  onClick={() => setActiveCategoryId(category.id)}
                  className="mb-1 inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary hover:text-white"
                >
                  Explore <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              </div>
              <MediaRail label={`${category.name} Watch releases`}>
                {categoryVideos.map((video) => (
                  <div
                    key={video.id}
                    className="w-[78vw] shrink-0 snap-start sm:w-72"
                  >
                    <VideoCard video={video} />
                  </div>
                ))}
              </MediaRail>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
