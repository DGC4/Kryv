import { Link, useParams } from 'wouter';
import { useCreateClipSafetyReport, useGetClip, useListClips } from '@workspace/api-client-react';
import { ArrowLeft, CalendarDays, Clapperboard, Eye, Loader2, Radio, Share2, ShieldAlert, Users } from 'lucide-react';
import HlsPlayer from '@/components/video/HlsPlayer';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/lib/auth-store';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useState } from 'react';

function formatDuration(seconds: number | null) {
  const total = Math.max(0, seconds ?? 0);
  return `${Math.floor(total / 60)}:${(total % 60).toString().padStart(2, '0')}`;
}

export default function ClipDetail() {
  const { id } = useParams<{ id: string }>();
  const clipId = Number(id);
  const { data: clip, isLoading } = useGetClip(clipId, { query: { enabled: Number.isSafeInteger(clipId) && clipId > 0 } });
  const { data: channelClips } = useListClips(
    clip?.channelId ? { channelId: clip.channelId } : undefined,
    { query: { enabled: Boolean(clip?.channelId) } },
  );
  const { toast } = useToast();
  const signedInUser = useAuthStore((state) => state.user);
  const createClipSafetyReport = useCreateClipSafetyReport();
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('harassment');
  const [reportDetails, setReportDetails] = useState('');

  const submitSafetyReport = (event: React.FormEvent) => {
    event.preventDefault();
    if (!clip) return;
    createClipSafetyReport.mutate({ id: clip.id, data: { reason: reportReason as 'harassment' | 'hate_or_harm' | 'spam_or_scam' | 'sexual_content' | 'violence_or_threat' | 'impersonation' | 'other', ...(reportDetails.trim() ? { details: reportDetails.trim() } : {}) } }, {
      onSuccess: () => { setReportOpen(false); setReportDetails(''); toast({ title: 'Report received', description: 'Kryv recorded this Clip report for owner safety review.' }); },
      onError: (error: any) => toast({ title: 'Report could not be sent', description: error?.body?.error || error?.message || 'Please try again.', variant: 'destructive' }),
    });
  };

  const copyLink = async () => {
    const shareData = { title: clip?.title || 'Kryv clip', text: 'Watch this moment on Kryv.', url: window.location.href };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
      await navigator.clipboard.writeText(shareData.url);
      toast({ title: 'Clip link copied', description: 'Share the moment anywhere.' });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      toast({ title: 'Share unavailable', description: 'Your browser could not open or copy the share link.', variant: 'destructive' });
    }
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
  const recommendations = (channelClips ?? []).filter(candidate => candidate.id !== clip.id).slice(0, 4);
  return (
    <main className="min-h-screen bg-[#080808] text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-8">
        <Link href="/clips" className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-white/55 hover:text-white transition-colors"><ArrowLeft className="w-4 h-4" /> All clips</Link>
        <div className="mt-5 sm:mt-7 overflow-hidden rounded-2xl border border-white/[0.08] bg-black shadow-2xl shadow-black/40"><div className="aspect-video"><HlsPlayer src={src} autoPlay muted={false} className="w-full h-full object-contain" /></div></div>
        <div className="mt-5 sm:mt-6 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0"><h1 className="text-xl font-black tracking-tight break-words sm:text-3xl">{clip.title}</h1><div className="mt-3 flex flex-wrap items-center gap-2"><Link href={`/profile/${clip.channelSlug}`} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 text-sm font-black text-primary transition hover:bg-primary hover:text-primary-foreground"><Users className="h-4 w-4" /> {clip.channelName}</Link><Link href={`/live/${clip.channelSlug}`} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 text-sm font-black text-white/70 transition hover:border-primary/40 hover:text-white"><Radio className="h-4 w-4 text-primary" /> Channel</Link></div><div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-white/40 sm:text-sm"><span className="inline-flex items-center gap-1.5"><Eye className="h-3.5 w-3.5" />{clip.viewCount.toLocaleString()} views</span><span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />{new Date(clip.createdAt).toLocaleDateString()}</span><span>{formatDuration(clip.durationSeconds)}</span></div></div>
          <div className="flex shrink-0 flex-wrap gap-2"><Button onClick={copyLink} variant="secondary" className="border border-white/[0.1] bg-white/[0.06] text-white hover:bg-white/[0.1]"><Share2 className="mr-2 h-4 w-4" /> Share</Button>{signedInUser ? <Button type="button" variant="ghost" onClick={() => setReportOpen(true)} className="text-white/45 hover:bg-red-400/10 hover:text-red-200"><ShieldAlert className="mr-2 h-4 w-4" /> Report</Button> : <Link href="/sign-in" className="inline-flex min-h-10 items-center gap-2 rounded-md px-3 text-sm font-medium text-white/45 transition hover:bg-red-400/10 hover:text-red-200"><ShieldAlert className="h-4 w-4" /> Report</Link>}</div>
        </div>
        {signedInUser && <Dialog open={reportOpen} onOpenChange={setReportOpen}><DialogContent className="border-white/[0.12] bg-[#0b0e14] text-white sm:max-w-md"><DialogHeader><DialogTitle className="text-white">Report this Clip</DialogTitle><DialogDescription className="leading-relaxed text-white/50">Reports are recorded for owner safety review. Provide only information relevant to this published Clip.</DialogDescription></DialogHeader><form onSubmit={submitSafetyReport} className="space-y-4"><label className="block text-xs font-black uppercase tracking-wider text-white/55">Reason<select value={reportReason} onChange={(event) => setReportReason(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-white/[0.1] bg-black/35 px-3 text-sm font-semibold text-white outline-none focus:border-primary/60"><option value="harassment">Harassment</option><option value="hate_or_harm">Hate or harm</option><option value="spam_or_scam">Spam or scam</option><option value="sexual_content">Sexual content</option><option value="violence_or_threat">Violence or threat</option><option value="impersonation">Impersonation</option><option value="other">Other</option></select></label><label className="block text-xs font-black uppercase tracking-wider text-white/55">Optional details<Textarea value={reportDetails} onChange={(event) => setReportDetails(event.target.value)} maxLength={500} placeholder="What should the safety reviewer know?" className="mt-2 min-h-28 border-white/[0.1] bg-black/35 text-white placeholder:text-white/30 focus-visible:ring-primary" /></label><p className="text-right text-[10px] text-white/30">{reportDetails.length}/500</p><DialogFooter><Button type="button" variant="ghost" onClick={() => setReportOpen(false)} disabled={createClipSafetyReport.isPending} className="text-white/60">Cancel</Button><Button type="submit" disabled={createClipSafetyReport.isPending} className="font-black">{createClipSafetyReport.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldAlert className="mr-2 h-4 w-4" />}Send report</Button></DialogFooter></form></DialogContent></Dialog>}
        <section className="mt-10 border-t border-white/[0.08] pt-7" aria-labelledby="more-clips"><div className="mb-5 flex items-end justify-between gap-4"><div><p className="text-[11px] font-black uppercase tracking-[0.18em] text-primary">Keep watching</p><h2 id="more-clips" className="mt-1 text-xl font-black tracking-tight text-white sm:text-2xl">More from {clip.channelName}</h2></div><Link href={`/profile/${clip.channelSlug}`} className="shrink-0 text-sm font-black text-primary hover:text-white">Creator hub</Link></div>{recommendations.length ? <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">{recommendations.map(recommendation => <Link key={recommendation.id} href={`/clips/${recommendation.id}`} className="group overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.02] transition hover:-translate-y-0.5 hover:border-primary/45"><div className="relative aspect-video overflow-hidden bg-black/50">{recommendation.thumbnailUrl ? <img src={recommendation.thumbnailUrl} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : <div className="flex h-full items-center justify-center"><Clapperboard className="h-7 w-7 text-white/20" /></div>}<span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-black text-white">{formatDuration(recommendation.durationSeconds)}</span></div><div className="p-3"><p className="line-clamp-2 text-sm font-black leading-snug text-white">{recommendation.title}</p><p className="mt-1 text-xs text-white/40">{recommendation.viewCount.toLocaleString()} views</p></div></Link>)}</div> : <div className="rounded-2xl border border-dashed border-white/[0.12] bg-white/[0.015] p-6 text-sm text-white/45">No other published clips from this creator yet.</div>}</section>
      </div>
    </main>
  );
}
