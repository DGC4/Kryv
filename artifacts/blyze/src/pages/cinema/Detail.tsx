import { useParams, Link } from 'wouter';
import { useGetVideo } from '@workspace/api-client-react';
import { ArrowLeft, Clapperboard, Eye, Info, Loader2, LockKeyhole } from 'lucide-react';

export default function CinemaDetail() {
  const { id } = useParams<{ id: string }>();
  const videoId = parseInt(id || '0', 10);
  const { data: video, isLoading } = useGetVideo(videoId, { query: { enabled: !!videoId } });

  if (isLoading) {
    return <div className="flex h-[calc(100vh-4rem)] items-center justify-center bg-black"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!video) {
    return <div className="flex h-[calc(100vh-4rem)] items-center justify-center bg-black"><p className="text-xl text-muted-foreground">Title not found</p></div>;
  }

  return (
    <div className="relative z-10 min-h-screen overflow-hidden bg-black text-white">
      <section className="relative min-h-[56vw] max-h-[720px] min-h-[340px] overflow-hidden border-b border-white/[0.06]">
        {video.backdropUrl ? <img src={video.backdropUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-45" /> : <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/40 via-black to-primary/20" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-black/20" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/15 to-transparent" />
        <Link href="/cinema" className="absolute left-4 top-5 z-20 sm:left-6 sm:top-7">
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/40 text-white/75 backdrop-blur transition-colors hover:bg-white/15 hover:text-white"><ArrowLeft className="h-5 w-5" /></span>
        </Link>
        <div className="relative z-10 mx-auto flex min-h-[340px] max-w-[1200px] items-end px-4 pb-8 pt-24 sm:min-h-[440px] sm:px-6 sm:pb-12 lg:px-8">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/35 bg-primary/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-primary"><LockKeyhole className="h-3.5 w-3.5" /> Preview only</div>
            <h1 className="mt-4 text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">{video.title}</h1>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-medium text-white/70">
              {video.categoryName && <span className="font-bold uppercase tracking-wider text-primary">{video.categoryName}</span>}
              {video.durationSeconds && <span>{Math.floor(video.durationSeconds / 60)}m {video.durationSeconds % 60}s</span>}
              <span className="inline-flex items-center gap-1.5"><Eye className="h-3.5 w-3.5" /> {video.viewCount.toLocaleString()} preview views</span>
              <span className="rounded border border-white/20 px-2 py-0.5 text-xs text-white/60">HD</span>
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_260px]">
          <article>
            <div className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/[0.12] to-white/[0.03] p-5 sm:p-6">
              <div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/15 text-primary"><Clapperboard className="h-5 w-5" /></div><div><h2 className="font-black text-white">Playback is not open yet</h2><p className="mt-1 text-sm leading-relaxed text-white/55">This page is a catalog preview. Artwork, title details, and collection metadata are visible, but video playback is intentionally unavailable until Kryv Cinema launches viewing access.</p></div></div>
            </div>
            <div className="mt-8 space-y-3"><div className="flex items-center gap-2 text-primary"><Info className="h-4 w-4" /><span className="text-[11px] font-black uppercase tracking-[0.18em]">About this title</span></div><p className="text-base leading-relaxed text-white/75">{video.description || 'Additional details for this title will appear when the Cinema catalog is published.'}</p></div>
          </article>

          <aside className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">Creator</p>
            <div className="mt-3 flex items-center gap-3">
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-primary/20">
                {video.channelAvatarUrl ? <img src={video.channelAvatarUrl} alt={video.channelName} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-sm font-bold text-primary">{video.channelName?.[0]}</div>}
              </div>
              <span className="truncate font-bold text-white">{video.channelName}</span>
            </div>
            <div className="mt-6 border-t border-white/[0.08] pt-5"><p className="text-xs leading-relaxed text-white/45">Kryv Cinema will announce availability through the catalog when secure viewing opens.</p></div>
          </aside>
        </div>
      </main>
    </div>
  );
}
