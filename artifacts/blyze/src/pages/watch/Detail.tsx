import { useMemo, useState } from 'react';
import { useParams, Link } from 'wouter';
import {
  getGetChannelEngagementQueryKey,
  getListVideoCommentsQueryKey,
  useCreateChannelEngagementAction,
  useCreateClip,
  useCreateVideoComment,
  useCreateVideoSafetyReport,
  useDeleteVideoComment,
  useGetChannelEngagement,
  useGetVideo,
  useListVideoComments,
  useListVideos,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import HlsPlayer from '@/components/video/HlsPlayer';
import {
  Award,
  Check,
  ChevronRight,
  Clapperboard,
  Eye,
  ExternalLink,
  Film,
  Loader2,
  MessageSquareText,
  Play,
  Radio,
  Share2,
  ShieldAlert,
  Sparkles,
  Users,
  Reply,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { usePageMetadata } from '@/hooks/use-page-metadata';
import { useAuthStore } from '@/lib/auth-store';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

function formatDuration(value: number | null) {
  if (!value) return null;
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  return minutes ? `${minutes}:${String(seconds).padStart(2, '0')}` : `0:${String(seconds).padStart(2, '0')}`;
}

type WatchCommentNode = {
  id: number;
  videoId: number;
  parentCommentId: number | null;
  userId: number;
  username: string;
  avatarUrl: string | null;
  message: string;
  createdAt: Date | string;
  replies: WatchCommentNode[];
};

export default function WatchDetail() {
  const { id } = useParams<{ id: string }>();
  const videoId = parseInt(id || '0', 10);
  const { data: video, isLoading, refetch: refetchVideo } = useGetVideo(videoId, { query: { enabled: !!videoId } });
  const { data: allUploads = [] } = useListVideos({ contentType: 'upload' }, { query: { enabled: !!videoId } });
  const { data: comments = [], isLoading: commentsLoading } = useListVideoComments(videoId, { query: { enabled: Boolean(videoId && video?.uploadStatus === 'ready') } });
  const channelEngagement = useGetChannelEngagement(video?.channelId ?? 0, {
    query: { enabled: Boolean(video?.channelId), refetchInterval: 15000 },
  });
  const engagementAction = useCreateChannelEngagementAction();
  const createClip = useCreateClip();
  const createVideoComment = useCreateVideoComment();
  const deleteVideoComment = useDeleteVideoComment();
  const createVideoSafetyReport = useCreateVideoSafetyReport();
  const signedInUser = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [clipTitle, setClipTitle] = useState('');
  const [clipStart, setClipStart] = useState(0);
  const [clipEnd, setClipEnd] = useState(30);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('harassment');
  const [reportDetails, setReportDetails] = useState('');
  const [commentDraft, setCommentDraft] = useState('');
  const [replyTargetId, setReplyTargetId] = useState<number | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  usePageMetadata({
    title: video?.title ?? 'Watch video',
    description: video?.description?.trim() || 'Watch a creator release on Kryv Watch.',
    imageUrl: video?.thumbnailUrl,
    type: 'video.other',
  });

  const recommendations = useMemo(() => {
    if (!video) return [];
    return allUploads
      .filter((candidate) => candidate.id !== video.id && candidate.uploadStatus === 'ready' && (candidate.playbackSource === 'youtube' ? Boolean(candidate.youtubeVideoId) : Boolean(candidate.playbackId)))
      .sort((left, right) => {
        const leftScore = (left.channelId === video.channelId ? 2 : 0) + (left.categoryId === video.categoryId ? 1 : 0);
        const rightScore = (right.channelId === video.channelId ? 2 : 0) + (right.categoryId === video.categoryId ? 1 : 0);
        return rightScore - leftScore || right.viewCount - left.viewCount;
      })
      .slice(0, 6);
  }, [allUploads, video]);

  const requestClip = (event: React.FormEvent) => {
    event.preventDefault();
    if (!video || !clipTitle.trim()) return;
    createClip.mutate(
      { data: { videoId: video.id, startTime: clipStart, endTime: clipEnd, title: clipTitle.trim() } },
      {
        onSuccess: () => {
          setClipTitle('');
          toast({ title: 'Clip is processing', description: 'Kryv is preparing your clip. It will appear in Clips when ready.' });
        },
        onError: (err: any) => toast({ title: 'Unable to create clip', description: err?.body?.error || err?.message || 'Please try again.', variant: 'destructive' }),
      },
    );
  };

  const submitSafetyReport = (event: React.FormEvent) => {
    event.preventDefault();
    if (!video) return;
    createVideoSafetyReport.mutate({ id: video.id, data: { reason: reportReason as 'harassment' | 'hate_or_harm' | 'spam_or_scam' | 'sexual_content' | 'violence_or_threat' | 'impersonation' | 'other', ...(reportDetails.trim() ? { details: reportDetails.trim() } : {}) } }, {
      onSuccess: () => { setReportOpen(false); setReportDetails(''); toast({ title: 'Report received', description: 'Kryv recorded this Watch report for owner safety review.' }); },
      onError: (error: any) => toast({ title: 'Report could not be sent', description: error?.body?.error || error?.message || 'Please try again.', variant: 'destructive' }),
    });
  };

  const shareVideo = async () => {
    if (!video) return;
    const url = new URL(`/watch/${video.id}`, window.location.origin).toString();
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: 'Watch link copied', description: 'Share it with someone who should see this release.' });
    } catch {
      toast({ title: 'Copy unavailable', description: url, variant: 'destructive' });
    }
  };

  const refreshEngagement = () => {
    if (!video) return;
    queryClient.invalidateQueries({ queryKey: getGetChannelEngagementQueryKey(video.channelId) });
  };

  const refreshComments = () => {
    if (!video) return;
    queryClient.invalidateQueries({ queryKey: getListVideoCommentsQueryKey(video.id) });
  };

  const submitComment = (event: React.FormEvent, parentCommentId?: number) => {
    event.preventDefault();
    if (!video) return;
    if (!signedInUser) {
      toast({ title: 'Sign in to comment', description: 'You need a Kryv account to join this Watch discussion.' });
      return;
    }
    const message = (parentCommentId ? replyDraft : commentDraft).trim();
    if (!message) return;
    createVideoComment.mutate({ id: video.id, data: { message, ...(parentCommentId ? { parentCommentId } : {}) } }, {
      onSuccess: () => {
        if (parentCommentId) {
          setReplyTargetId(null);
          setReplyDraft('');
        } else {
          setCommentDraft('');
        }
        refreshComments();
      },
      onError: (error: any) => toast({ title: 'Comment was not posted', description: error?.body?.error || error?.message || 'Try again in a moment.', variant: 'destructive' }),
    });
  };

  const removeComment = (commentId: number) => {
    if (!video || !confirm('Remove this comment and any replies beneath it?')) return;
    deleteVideoComment.mutate({ id: video.id, commentId }, {
      onSuccess: () => { refreshComments(); toast({ title: 'Comment removed' }); },
      onError: (error: any) => toast({ title: 'Could not remove comment', description: error?.body?.error || error?.message || 'Try again in a moment.', variant: 'destructive' }),
    });
  };

  const claimPoints = () => {
    if (!video) return;
    engagementAction.mutate({ id: video.channelId, data: { action: 'claim_points' } }, {
      onSuccess: (result) => {
        refreshEngagement();
        toast({ title: result.awarded ? `+${result.awarded} channel points` : 'Points checked in', description: result.awarded ? 'Your channel point balance is updated.' : 'No points are available to claim right now.' });
      },
      onError: (err: any) => toast({ title: 'Point claim unavailable', description: err?.body?.error || err?.message || 'Sign in and try again when this channel is eligible.', variant: 'destructive' }),
    });
  };

  const votePoll = (pollId: number, choiceId: number) => {
    if (!video) return;
    engagementAction.mutate({ id: video.channelId, data: { action: 'vote_poll', pollId, choiceId } }, {
      onSuccess: () => { refreshEngagement(); toast({ title: 'Vote recorded' }); },
      onError: (err: any) => toast({ title: 'Vote unavailable', description: err?.body?.error || err?.message || 'Sign in and try again while the poll is open.', variant: 'destructive' }),
    });
  };

  if (isLoading) {
    return <div className="flex h-[calc(100vh-4rem)] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!video) {
    return <div className="flex h-[calc(100vh-4rem)] items-center justify-center px-4"><div className="text-center"><Film className="mx-auto h-8 w-8 text-white/20" /><p className="mt-6 text-xl font-bold text-white">Video unavailable</p><p className="mt-2 text-sm leading-relaxed text-white/45">The release may be processing, unpublished, or temporarily unavailable.</p><div className="mt-4 flex flex-wrap justify-center gap-3"><button type="button" onClick={() => refetchVideo()} className="inline-flex min-h-10 items-center rounded-xl border border-white/[0.14] bg-white/[0.04] px-4 text-sm font-bold text-white transition hover:border-primary/45 hover:text-primary">Retry</button><Link href="/watch" className="inline-flex min-h-10 items-center text-sm font-bold text-primary hover:text-white">Return to Watch <ChevronRight className="ml-1 h-4 w-4" /></Link></div></div></div>;
  }

  const engagement = channelEngagement.data;
  const activePoll = engagement?.activePoll;
  const duration = formatDuration(video.durationSeconds);
  const discussion = comments as unknown as WatchCommentNode[];
  const discussionCount = discussion.reduce((count, comment) => count + 1 + comment.replies.length, 0);

  return (
    <div className="relative z-10 mx-auto max-w-[1600px] px-4 py-5 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:gap-8">
        <div className="min-w-0">
          <div className="relative aspect-video overflow-hidden rounded-2xl border border-white/[0.1] bg-black shadow-2xl sm:rounded-3xl">
            {video.playbackSource === 'youtube' && video.youtubeVideoId ? <iframe src={`https://www.youtube-nocookie.com/embed/${video.youtubeVideoId}?rel=0&modestbranding=1`} title={`${video.title} on YouTube`} className="h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /> : video.playbackId ? <HlsPlayer src={`https://stream.fastpix.com/${video.playbackId}.m3u8`} poster={video.thumbnailUrl || undefined} className="h-full w-full" /> : <div className="flex h-full w-full flex-col items-center justify-center bg-[#050609] px-5 text-center"><Loader2 className="h-10 w-10 animate-spin text-primary" /><h3 className="mt-4 text-xl font-bold text-white">Video is processing</h3><p className="mt-2 max-w-md text-sm leading-relaxed text-white/50">This upload does not have a playable source yet. Kryv will make it available after media processing is complete.</p></div>}
          </div>
          {video.playbackSource === 'youtube' && video.youtubeVideoId && <div className="mt-3 flex flex-col gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 text-xs leading-relaxed text-white/45 sm:flex-row sm:items-center sm:justify-between"><span>This rights-cleared release plays through YouTube&apos;s privacy-enhanced embed. If the publisher blocks embedding, use the official source.</span><a href={`https://www.youtube.com/watch?v=${video.youtubeVideoId}`} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1.5 font-black text-primary hover:text-white">Open on YouTube <ExternalLink className="h-3.5 w-3.5" /></a></div>}

          <div className="mt-4 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 sm:mt-5 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2 text-primary"><span className="inline-flex items-center gap-1.5 text-xs font-semibold"><Play className="h-3.5 w-3.5 fill-current" /> Kryv Watch</span>{video.categoryName && <span className="rounded-full border border-white/[0.1] bg-black/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/55">{video.categoryName}</span>}</div><h1 className="mt-2 text-xl font-bold leading-tight text-white sm:text-3xl">{video.title}</h1><div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-bold text-white/45"><span className="inline-flex items-center gap-1.5"><Eye className="h-3.5 w-3.5 text-primary" />{video.viewCount.toLocaleString()} views</span><span>{formatDistanceToNow(new Date(video.createdAt), { addSuffix: true })}</span>{duration && <span>{duration}</span>}</div></div><div className="flex flex-wrap gap-2"><Button type="button" variant="secondary" onClick={shareVideo} aria-label="Copy Watch link" className="h-10 gap-2 rounded-xl px-3 sm:px-4"><Share2 className="h-4 w-4" /><span>Share</span></Button>{!video.isOwner && (signedInUser ? <Button type="button" variant="ghost" onClick={() => setReportOpen(true)} className="h-10 rounded-xl px-3 text-white/45 hover:bg-red-400/10 hover:text-red-200 sm:px-4"><ShieldAlert className="mr-2 h-4 w-4" /><span>Report</span></Button> : <Link href="/sign-in" className="inline-flex h-10 items-center rounded-xl px-3 text-sm font-bold text-white/45 transition hover:bg-red-400/10 hover:text-red-200 sm:px-4"><ShieldAlert className="mr-2 h-4 w-4" />Report</Link>)}{video.isOwner && video.playbackSource === 'fastpix' && video.playbackId && <Button type="button" variant="secondary" aria-label="Create a native clip" className="h-10 gap-2 rounded-xl border border-primary/30 px-3 text-primary hover:text-primary sm:px-4" onClick={() => { setClipTitle(`${video.title} · Clip`); setClipStart(0); setClipEnd(Math.min(video.durationSeconds || 30, 30)); }}><Clapperboard className="h-4 w-4" /><span className="hidden sm:inline">Make Clip</span></Button>}</div></div>
          </div>

          {!video.isOwner && signedInUser && <Dialog open={reportOpen} onOpenChange={setReportOpen}><DialogContent className="border-white/[0.12] bg-[#0b0e14] text-white sm:max-w-md"><DialogHeader><DialogTitle className="text-white">Report this Watch video</DialogTitle><DialogDescription className="leading-relaxed text-white/50">Reports are recorded for owner safety review. Provide only information relevant to this published Watch release.</DialogDescription></DialogHeader><form onSubmit={submitSafetyReport} className="space-y-4"><label className="block text-xs font-black uppercase tracking-wider text-white/55">Reason<select value={reportReason} onChange={(event) => setReportReason(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-white/[0.1] bg-black/35 px-3 text-sm font-semibold text-white outline-none focus:border-primary/60"><option value="harassment">Harassment</option><option value="hate_or_harm">Hate or harm</option><option value="spam_or_scam">Spam or scam</option><option value="sexual_content">Sexual content</option><option value="violence_or_threat">Violence or threat</option><option value="impersonation">Impersonation</option><option value="other">Other</option></select></label><label className="block text-xs font-black uppercase tracking-wider text-white/55">Optional details<Textarea value={reportDetails} onChange={(event) => setReportDetails(event.target.value)} maxLength={500} placeholder="What should the safety reviewer know?" className="mt-2 min-h-28 border-white/[0.1] bg-black/35 text-white placeholder:text-white/30 focus-visible:ring-primary" /></label><p className="text-right text-[10px] text-white/30">{reportDetails.length}/500</p><DialogFooter><Button type="button" variant="ghost" onClick={() => setReportOpen(false)} disabled={createVideoSafetyReport.isPending} className="text-white/60">Cancel</Button><Button type="submit" disabled={createVideoSafetyReport.isPending} className="font-black">{createVideoSafetyReport.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldAlert className="mr-2 h-4 w-4" />}Send report</Button></DialogFooter></form></DialogContent></Dialog>}

          <section className="mt-5 rounded-2xl border border-white/[0.08] bg-black/20 p-4 sm:p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><Link href={`/profile/${video.channelSlug}`} className="group flex min-w-0 items-center gap-3"><div className="h-12 w-12 shrink-0 overflow-hidden rounded-2xl border border-white/[0.1] bg-primary/15">{video.channelAvatarUrl ? <img src={video.channelAvatarUrl} alt={video.channelName} className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center text-lg font-black text-primary">{video.channelName?.[0]}</span>}</div><div className="min-w-0"><p className="truncate text-base font-bold text-white transition group-hover:text-primary">{video.channelName}</p><p className="mt-0.5 text-xs text-white/40">Creator profile · releases, live room, and curated credits</p></div></Link><Link href={`/live/${video.channelSlug}`} className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-primary/35 bg-primary/10 px-3 text-sm font-bold text-primary transition hover:bg-primary hover:text-primary-foreground"><Radio className="h-4 w-4" /> Visit live room</Link></div>{video.description && <p className="mt-5 border-t border-white/[0.07] pt-5 text-sm leading-relaxed text-white/70 whitespace-pre-wrap">{video.description}</p>}</section>

          <section className="mt-5 rounded-2xl border border-white/[0.08] bg-[#0a0c11]/[0.72] p-4 sm:mt-6 sm:p-5" aria-labelledby="watch-discussion">
            <div className="flex items-end justify-between gap-4"><div><div className="flex items-center gap-2 text-primary"><MessageSquareText className="h-4 w-4" /><span className="text-xs font-semibold">Watch discussion</span></div><h2 id="watch-discussion" className="mt-1 text-lg font-bold text-white">{discussionCount.toLocaleString()} {discussionCount === 1 ? 'comment' : 'comments'}</h2></div><span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[10px] font-bold text-white/45">Newest first</span></div>

            <div className="mt-5">
              {signedInUser ? <form onSubmit={(event) => submitComment(event)} className="flex gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/[0.1] bg-primary/10 text-xs font-black text-primary">{signedInUser.avatarUrl ? <img src={signedInUser.avatarUrl} alt="" className="h-full w-full object-cover" /> : signedInUser.username.slice(0, 1).toUpperCase()}</div><div className="min-w-0 flex-1"><Textarea value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} maxLength={1000} placeholder="Join the discussion" className="min-h-20 resize-y border-white/[0.1] bg-black/25 text-sm text-white placeholder:text-white/30 focus-visible:ring-primary" /><div className="mt-2 flex items-center justify-between gap-3"><span className="text-[10px] text-white/30">{commentDraft.length}/1000</span><Button type="submit" size="sm" disabled={!commentDraft.trim() || createVideoComment.isPending} className="h-9 rounded-lg px-3 text-xs font-black">{createVideoComment.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Comment'}</Button></div></div></form> : <div className="flex flex-col gap-3 rounded-xl border border-white/[0.08] bg-white/[0.025] p-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-white/55">Sign in to join the conversation around this release.</p><Link href="/sign-in" className="inline-flex min-h-9 items-center justify-center rounded-lg bg-primary px-3 text-xs font-black text-primary-foreground transition hover:brightness-110">Sign in to comment</Link></div>}
            </div>

            {commentsLoading ? <div className="mt-6 space-y-4" aria-label="Loading comments"><div className="h-12 animate-pulse rounded-xl bg-white/[0.04]" /><div className="h-12 animate-pulse rounded-xl bg-white/[0.03]" /></div> : discussion.length ? <div className="mt-6 space-y-5">{discussion.map((comment) => <article key={comment.id} className="flex gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/[0.1] bg-primary/10 text-xs font-black text-primary">{comment.avatarUrl ? <img src={comment.avatarUrl} alt="" className="h-full w-full object-cover" /> : comment.username.slice(0, 1).toUpperCase()}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-2 gap-y-1"><span className="text-sm font-black text-white">{comment.username}</span><time dateTime={new Date(comment.createdAt).toISOString()} className="text-[10px] text-white/35">{formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}</time></div><p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-white/75">{comment.message}</p><div className="mt-2 flex items-center gap-2"><button type="button" onClick={() => { setReplyTargetId(replyTargetId === comment.id ? null : comment.id); setReplyDraft(''); }} className="inline-flex min-h-8 items-center gap-1 rounded-lg px-2 text-[11px] font-black text-white/50 transition hover:bg-white/[0.06] hover:text-primary"><Reply className="h-3.5 w-3.5" />Reply</button>{(signedInUser?.id === comment.userId || video.isOwner) && <button type="button" onClick={() => removeComment(comment.id)} disabled={deleteVideoComment.isPending} className="inline-flex min-h-8 items-center gap-1 rounded-lg px-2 text-[11px] font-black text-white/40 transition hover:bg-red-400/10 hover:text-red-200 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" />Remove</button>}</div>{replyTargetId === comment.id && <form onSubmit={(event) => submitComment(event, comment.id)} className="mt-3 flex gap-2 rounded-xl border border-white/[0.08] bg-black/20 p-2"><Textarea value={replyDraft} onChange={(event) => setReplyDraft(event.target.value)} maxLength={1000} placeholder={`Reply to ${comment.username}`} className="min-h-16 flex-1 resize-y border-white/[0.08] bg-white/[0.03] text-xs text-white placeholder:text-white/30 focus-visible:ring-primary" /><div className="flex flex-col gap-1"><Button type="submit" size="sm" disabled={!replyDraft.trim() || createVideoComment.isPending} className="h-8 px-2 text-[10px] font-black">Post</Button><button type="button" onClick={() => { setReplyTargetId(null); setReplyDraft(''); }} className="h-8 rounded-md px-2 text-[10px] font-bold text-white/45 hover:text-white">Cancel</button></div></form>}{comment.replies.length > 0 && <div className="mt-4 space-y-4 border-l border-white/[0.08] pl-3 sm:pl-4">{comment.replies.map((reply) => <article key={reply.id} className="flex gap-2.5"><div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/[0.08] bg-white/[0.04] text-[10px] font-black text-white/55">{reply.avatarUrl ? <img src={reply.avatarUrl} alt="" className="h-full w-full object-cover" /> : reply.username.slice(0, 1).toUpperCase()}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-2 gap-y-1"><span className="text-xs font-black text-white/85">{reply.username}</span><time dateTime={new Date(reply.createdAt).toISOString()} className="text-[10px] text-white/30">{formatDistanceToNow(new Date(reply.createdAt), { addSuffix: true })}</time>{(signedInUser?.id === reply.userId || video.isOwner) && <button type="button" onClick={() => removeComment(reply.id)} disabled={deleteVideoComment.isPending} className="ml-auto inline-flex items-center gap-1 text-[10px] font-bold text-white/35 transition hover:text-red-200 disabled:opacity-50"><Trash2 className="h-3 w-3" />Remove</button>}</div><p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-white/65">{reply.message}</p></div></article>)}</div>}</div></article>)}</div> : <div className="mt-6 rounded-xl border border-dashed border-white/[0.12] bg-white/[0.02] px-4 py-8 text-center"><MessageSquareText className="mx-auto h-5 w-5 text-white/25" /><p className="mt-3 text-sm font-semibold text-white/65">No comments yet.</p><p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-white/40">Be the first to comment on this release. Kryv does not manufacture activity or placeholder discussion.</p></div>}
          </section>

          {video.isOwner && clipTitle && <form onSubmit={requestClip} className="mt-5 space-y-4 rounded-2xl border border-primary/20 bg-primary/[0.06] p-4 sm:p-5"><div className="flex items-center gap-2"><Clapperboard className="h-4 w-4 text-primary" /><h3 className="text-sm font-black text-white">Create a native clip</h3></div><p className="text-xs leading-relaxed text-white/45">Select a segment up to three minutes. Kryv prepares it as a new playable asset before publishing it.</p><input value={clipTitle} onChange={event => setClipTitle(event.target.value)} maxLength={100} placeholder="Clip title" className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-primary/60" /><div className="grid grid-cols-2 gap-3"><label className="text-xs font-bold text-white/55">Start (seconds)<input type="number" min={0} max={Math.max(0, (video.durationSeconds || 0) - 1)} value={clipStart} onChange={event => setClipStart(Number(event.target.value))} className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-primary/60" /></label><label className="text-xs font-bold text-white/55">End (seconds)<input type="number" min={1} max={video.durationSeconds || undefined} value={clipEnd} onChange={event => setClipEnd(Number(event.target.value))} className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-primary/60" /></label></div><div className="flex flex-wrap gap-2"><Button type="submit" disabled={createClip.isPending || clipEnd <= clipStart} className="font-bold">{createClip.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing…</> : <><Clapperboard className="mr-2 h-4 w-4" /> Create Clip</>}</Button><Button type="button" variant="ghost" onClick={() => setClipTitle('')} className="text-white/50">Cancel</Button></div></form>}
        </div>

        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start"><section className="rounded-2xl border border-primary/18 bg-primary/[0.045] p-4"><div className="flex items-center justify-between gap-3"><div><div className="flex items-center gap-2 text-primary"><Sparkles className="h-4 w-4" /><span className="text-xs font-semibold">Channel engagement</span></div><p className="mt-2 text-sm font-bold text-white">{engagement?.pointsEnabled ? `${engagement.pointsBalance?.toLocaleString() ?? 0} channel points` : 'No active point program'}</p></div>{engagement?.pointsEnabled && <Button type="button" size="sm" onClick={claimPoints} disabled={engagementAction.isPending} className="h-9 shrink-0 text-xs font-black">{engagementAction.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Award className="mr-1.5 h-3.5 w-3.5" /> Claim</>}</Button>}</div><p className="mt-2 text-xs leading-relaxed text-white/45">Channel-level participation carries across live broadcasts and on-demand viewing when the creator has enabled it.</p></section>

          {activePoll && <section className="rounded-2xl border border-white/[0.08] bg-black/25 p-4"><div className="flex items-center gap-2"><MessageSquareText className="h-4 w-4 text-primary" /><h2 className="text-sm font-black text-white">Live community poll</h2></div><p className="mt-3 text-sm font-bold text-white/80">{activePoll.title}</p><div className="mt-3 space-y-2">{activePoll.choices.map(choice => <button key={choice.id} type="button" onClick={() => votePoll(activePoll.id, choice.id)} disabled={engagementAction.isPending} className="flex min-h-10 w-full items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 text-left text-xs font-bold text-white/70 transition hover:border-primary/45 hover:bg-primary/[0.07] hover:text-white"><span>{choice.title}</span><span className="text-white/35">{choice.votes} votes</span></button>)}</div></section>}

          <section className="rounded-2xl border border-white/[0.08] bg-black/25 p-4"><div className="flex items-center justify-between gap-3"><div><div className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" /><h2 className="text-sm font-black text-white">More to watch</h2></div><p className="mt-1 text-xs text-white/40">Ready creator uploads from Kryv Watch.</p></div><Link href="/watch" className="text-xs font-black text-primary hover:text-white">Browse</Link></div><div className="mt-4 space-y-3">{recommendations.map(candidate => <Link key={candidate.id} href={`/watch/${candidate.id}`} className="group flex gap-3"><div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.04]">{candidate.thumbnailUrl ? <img src={candidate.thumbnailUrl} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" /> : <Film className="absolute inset-0 m-auto h-5 w-5 text-white/20" />}{formatDuration(candidate.durationSeconds) && <span className="absolute bottom-1 right-1 rounded bg-black/75 px-1 py-0.5 text-[9px] font-bold text-white">{formatDuration(candidate.durationSeconds)}</span>}</div><div className="min-w-0"><p className="line-clamp-2 text-xs font-black leading-snug text-white transition group-hover:text-primary">{candidate.title}</p><p className="mt-1 truncate text-[10px] text-white/42">{candidate.channelName} · {candidate.viewCount.toLocaleString()} views</p></div></Link>)}{recommendations.length === 0 && <div className="rounded-xl border border-dashed border-white/[0.12] p-4 text-center text-xs leading-relaxed text-white/40">More ready uploads will appear here as creators publish them.</div>}</div></section></aside>
      </section>
    </div>
  );
}
