import { useState } from 'react';
import { useParams, Link } from 'wouter';
import { useCreateClip, useGetVideo } from '@workspace/api-client-react';
import HlsPlayer from '@/components/video/HlsPlayer';
import { Loader2, Eye, Share2, ThumbsUp, Clapperboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

export default function WatchDetail() {
  const { id } = useParams<{ id: string }>();
  const videoId = parseInt(id || '0', 10);
  
  const { data: video, isLoading } = useGetVideo(videoId, {
    query: { enabled: !!videoId }
  });
  const createClip = useCreateClip();
  const { toast } = useToast();
  const [clipTitle, setClipTitle] = useState('');
  const [clipStart, setClipStart] = useState(0);
  const [clipEnd, setClipEnd] = useState(30);

  const requestClip = (e: React.FormEvent) => {
    e.preventDefault();
    if (!video || !clipTitle.trim()) return;
    createClip.mutate(
      { videoId: video.id, startTime: clipStart, endTime: clipEnd, title: clipTitle.trim() },
      {
        onSuccess: () => {
          setClipTitle('');
          toast({ title: 'Clip is processing', description: 'Kryv is preparing your clip. It will appear in Clips when ready.' });
        },
        onError: (err: any) => toast({ title: 'Unable to create clip', description: err?.body?.error || err?.message || 'Please try again.', variant: 'destructive' }),
      },
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!video) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <p className="text-xl text-muted-foreground">Video not found</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-6xl px-4 py-5 sm:py-8 relative z-10">
      <div className="relative mb-4 aspect-video overflow-hidden rounded-xl border border-white/10 bg-black shadow-2xl sm:mb-6 sm:rounded-2xl">
        {video.playbackId ? (
          <HlsPlayer
            src={`https://stream.fastpix.com/${video.playbackId}.m3u8`}
            poster={video.thumbnailUrl || undefined}
            className="w-full h-full"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-black/80">
            <div className="text-center space-y-4">
              <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
              <h3 className="text-xl font-bold text-white">Video is processing</h3>
              <p className="text-muted-foreground">It will be available to watch shortly.</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 min-w-0">
          <h1 className="mb-2 text-xl font-black leading-tight text-white sm:text-2xl">
            {video.title}
          </h1>
          
          <div className="flex items-center justify-between flex-wrap gap-4 pb-4 border-b border-white/10">
            <Link href={`/live/${video.channelId}`} className="flex items-center gap-3 group">
              <div className="w-12 h-12 rounded-full bg-white/10 overflow-hidden shrink-0 border border-white/10">
                {video.channelAvatarUrl ? (
                  <img src={video.channelAvatarUrl} alt={video.channelName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-primary/20 text-primary text-xl font-bold">
                    {video.channelName?.[0]}
                  </div>
                )}
              </div>
              <div>
                <h3 className="text-white font-bold text-lg group-hover:text-primary transition-colors">
                  {video.channelName}
                </h3>
              </div>
            </Link>

            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              <Button variant="secondary" aria-label="Like this video" className="h-10 gap-2 rounded-full px-3 sm:px-4">
                <ThumbsUp className="w-4 h-4" />
                <span className="hidden sm:inline">Like</span>
              </Button>
              <Button variant="secondary" aria-label="Share this video" className="h-10 gap-2 rounded-full px-3 sm:px-4">
                <Share2 className="w-4 h-4" />
                <span className="hidden sm:inline">Share</span>
              </Button>
              {video.isOwner && video.playbackId && (
                <Button variant="secondary" aria-label="Create a native clip" className="h-10 gap-2 rounded-full border border-primary/30 px-3 text-primary hover:text-primary sm:px-4" onClick={() => { setClipTitle(`${video.title} · Clip`); setClipStart(0); setClipEnd(Math.min(video.durationSeconds || 30, 30)); }}>
                  <Clapperboard className="w-4 h-4" />
                  <span className="hidden sm:inline">Make Clip</span>
                </Button>
              )}
            </div>
          </div>

          {video.isOwner && clipTitle && (
            <form onSubmit={requestClip} className="mt-6 p-4 sm:p-5 rounded-xl bg-primary/[0.06] border border-primary/20 space-y-4">
              <div className="flex items-center gap-2"><Clapperboard className="w-4 h-4 text-primary" /><h3 className="font-black text-white text-sm">Create a native clip</h3></div>
              <p className="text-xs text-white/45 leading-relaxed">Select a segment up to three minutes. Kryv prepares it as a new playable asset before publishing it.</p>
              <input value={clipTitle} onChange={e => setClipTitle(e.target.value)} maxLength={100} placeholder="Clip title" className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-primary/60" />
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs font-bold text-white/55">Start (seconds)<input type="number" min={0} max={Math.max(0, (video.durationSeconds || 0) - 1)} value={clipStart} onChange={e => setClipStart(Number(e.target.value))} className="mt-1.5 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-primary/60" /></label>
                <label className="text-xs font-bold text-white/55">End (seconds)<input type="number" min={1} max={video.durationSeconds || undefined} value={clipEnd} onChange={e => setClipEnd(Number(e.target.value))} className="mt-1.5 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-primary/60" /></label>
              </div>
              <div className="flex flex-wrap gap-2"><Button type="submit" disabled={createClip.isPending || clipEnd <= clipStart} className="font-bold">{createClip.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing…</> : <><Clapperboard className="w-4 h-4 mr-2" /> Create Clip</>}</Button><Button type="button" variant="ghost" onClick={() => setClipTitle('')} className="text-white/50">Cancel</Button></div>
            </form>
          )}

          <div className="mt-6 p-4 rounded-xl bg-white/5 border border-white/5">
            <div className="flex items-center gap-4 text-sm font-medium text-white mb-2">
              <span>{video.viewCount.toLocaleString()} views</span>
              <span>{formatDistanceToNow(new Date(video.createdAt), { addSuffix: true })}</span>
              {video.categoryName && (
                <span className="px-2 py-0.5 rounded-full bg-white/10 text-xs">{video.categoryName}</span>
              )}
            </div>
            {video.description && (
              <p className="text-white/90 whitespace-pre-wrap mt-4 text-sm leading-relaxed">
                {video.description}
              </p>
            )}
          </div>
        </div>

        {/* Up next / recommendations could go here */}
        <div className="w-full lg:w-[350px] shrink-0 space-y-4 hidden lg:block">
          <h3 className="font-bold text-white font-display">More to watch</h3>
          {/* We'd fetch more videos here, skipping for now to focus on main paths */}
          <div className="p-8 text-center text-sm text-muted-foreground border border-white/5 rounded-xl bg-white/5">
            Recommendations coming soon
          </div>
        </div>
      </div>
    </div>
  );
}
