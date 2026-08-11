import { Link, useParams } from 'wouter';
import { useGetClip } from '@workspace/api-client-react';
import { ArrowLeft, CalendarDays, Clapperboard, Copy, Eye, Loader2, Share2 } from 'lucide-react';
import HlsPlayer from '@/components/video/HlsPlayer';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

function formatDuration(seconds: number | null) {
  const total = Math.max(0, seconds ?? 0);
  return `${Math.floor(total / 60)}:${(total % 60).toString().padStart(2, '0')}`;
}

export default function ClipDetail() {
  const { id } = useParams<{ id: string }>();
  const clipId = Number(id);
  const { data: clip, isLoading } = useGetClip(clipId, { query: { enabled: Number.isSafeInteger(clipId) && clipId > 0 } });
  const { toast } = useToast();

  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    toast({ title: 'Clip link copied', description: 'Share the moment anywhere.' });
  };

  if (isLoading) {
    return <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-[#080808]"><Loader2 className="w-7 h-7 text-primary animate-spin" /></div>;
  }

  if (!clip || !clip.playbackId) {
    return (
      <main className="min-h-[calc(100vh-4rem)] bg-[#080808] flex items-center justify-center px-4 text-center text-white">
        <div className="max-w-md"><div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-white/[0.06] flex items-center justify-center"><Clapperboard className="w-7 h-7 text-white/35" /></div><h1 className="text-xl font-black">This clip is unavailable</h1><p className="mt-2 text-sm leading-relaxed text-white/45">It may still be processing, unpublished, or no longer available.</p><Link href="/clips" className="inline-flex mt-5 text-sm font-bold text-primary hover:underline">Browse clips</Link></div>
      </main>
    );
  }

  const src = `https://stream.fastpix.com/${clip.playbackId}.m3u8`;
  return (
    <main className="min-h-screen bg-[#080808] text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-8">
        <Link href="/clips" className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-white/55 hover:text-white transition-colors"><ArrowLeft className="w-4 h-4" /> All clips</Link>
        <div className="mt-5 sm:mt-7 overflow-hidden rounded-2xl border border-white/[0.08] bg-black shadow-2xl shadow-black/40"><div className="aspect-video"><HlsPlayer src={src} autoPlay muted={false} className="w-full h-full object-contain" /></div></div>
        <div className="mt-5 sm:mt-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5">
          <div className="min-w-0"><h1 className="text-xl sm:text-3xl font-black tracking-tight break-words">{clip.title}</h1><Link href={`/live/${clip.channelSlug}`} className="inline-block mt-2 text-sm sm:text-base font-bold text-primary hover:underline">{clip.channelName}</Link><div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs sm:text-sm text-white/40"><span className="inline-flex items-center gap-1.5"><Eye className="w-3.5 h-3.5" />{clip.viewCount.toLocaleString()} views</span><span className="inline-flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" />{new Date(clip.createdAt).toLocaleDateString()}</span><span>{formatDuration(clip.durationSeconds)}</span></div></div>
          <Button onClick={copyLink} variant="secondary" className="shrink-0 border border-white/[0.1] bg-white/[0.06] hover:bg-white/[0.1] text-white"><Share2 className="w-4 h-4 mr-2" /> Share</Button>
        </div>
      </div>
    </main>
  );
}
