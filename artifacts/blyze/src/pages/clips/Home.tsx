import { Link } from 'wouter';
import { useListClips } from '@workspace/api-client-react';
import { Clock3, Clapperboard, Loader2, Play, Sparkles, Users } from 'lucide-react';

function formatDuration(seconds: number | null) {
  const total = Math.max(0, seconds ?? 0);
  const minutes = Math.floor(total / 60);
  const remainder = total % 60;
  return `${minutes}:${remainder.toString().padStart(2, '0')}`;
}

export default function ClipsHome() {
  const { data: clips, isLoading } = useListClips();

  return (
    <main className="min-h-screen bg-[#080808] text-white">
      <section className="relative overflow-hidden border-b border-white/[0.07] bg-gradient-to-b from-primary/[0.12] via-[#101010] to-[#080808]">
        <div className="absolute -top-24 right-[-5rem] h-80 w-80 rounded-full bg-primary/20 blur-[100px]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-primary">
            <Sparkles className="w-3.5 h-3.5" /> Kryv Clips
          </div>
          <div className="mt-5 max-w-2xl">
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight">The moments worth replaying.</h1>
            <p className="mt-3 text-sm sm:text-base leading-relaxed text-white/55">Short highlights created natively from Kryv broadcasts and on-demand videos. Watch the best moments without missing the live stream.</p>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="flex items-center justify-between gap-4 mb-5 sm:mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-black">Latest clips</h2>
            <p className="text-xs sm:text-sm text-white/40 mt-1">Published moments from the Kryv community.</p>
          </div>
          <span className="shrink-0 rounded-full bg-white/[0.06] border border-white/[0.08] px-3 py-1.5 text-xs font-bold text-white/50">{clips?.length ?? 0} available</span>
        </div>

        {isLoading ? (
          <div className="min-h-64 flex items-center justify-center"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>
        ) : clips?.length ? (
          <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
            {clips.map((clip) => (
              <Link key={clip.id} href={`/clips/${clip.id}`} className="group min-w-0 rounded-2xl overflow-hidden border border-white/[0.08] bg-white/[0.025] hover:border-primary/40 hover:bg-white/[0.045] transition-all">
                <div className="relative aspect-video overflow-hidden bg-white/[0.04]">
                  {clip.thumbnailUrl ? (
                    <img src={clip.thumbnailUrl} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-white/[0.03]"><Clapperboard className="w-10 h-10 text-white/25" /></div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                  <span className="absolute top-2 right-2 rounded-md bg-black/70 px-1.5 py-1 text-[10px] font-black text-white"><Clock3 className="inline w-3 h-3 mr-1 -mt-px" />{formatDuration(clip.durationSeconds)}</span>
                  <span className="absolute left-3 bottom-3 w-9 h-9 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-black/40 group-hover:scale-110 transition-transform"><Play className="w-4 h-4 fill-current text-primary-foreground ml-0.5" /></span>
                </div>
                <div className="p-3.5 sm:p-4 min-w-0">
                  <h3 className="font-black text-sm sm:text-base truncate group-hover:text-primary transition-colors">{clip.title}</h3>
                  <p className="mt-1 text-xs font-medium text-white/45 truncate">{clip.channelName}</p>
                  <div className="mt-3 flex items-center gap-3 text-[11px] font-bold text-white/35"><span className="inline-flex items-center gap-1"><Users className="w-3 h-3" />{clip.viewCount.toLocaleString()}</span><span>{new Date(clip.createdAt).toLocaleDateString()}</span></div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="min-h-72 rounded-2xl border border-dashed border-white/[0.12] bg-white/[0.02] flex flex-col items-center justify-center text-center px-6">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4"><Clapperboard className="w-6 h-6 text-primary" /></div>
            <h3 className="font-black text-white">Clips are on their way</h3>
            <p className="max-w-sm mt-2 text-sm leading-relaxed text-white/40">Creators can turn ready Kryv videos and recorded broadcasts into shareable highlights. Published clips will appear here.</p>
          </div>
        )}
      </section>
    </main>
  );
}
