import { useCreateCinemaComment, useDeleteCinemaComment, useGetMe, useListCinemaComments } from '@workspace/api-client-react';
import { formatDistanceToNow } from 'date-fns';
import { Loader2, MessageSquareText, Reply, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { UserChip } from '@/components/identity/UserChip';

type CinemaCommentNode = {
  id: number;
  cinemaTitleId: number;
  parentCommentId: number | null;
  userId: number;
  username: string;
  avatarUrl: string | null;
  message: string;
  createdAt: string | Date;
  replies: CinemaCommentNode[];
};

export function CinemaDiscussion({ cinemaTitleId, title }: { cinemaTitleId: number; title: string }) {
  const { toast } = useToast();
  const { data: signedInUser } = useGetMe();
  const { data: comments = [], isLoading, refetch } = useListCinemaComments(cinemaTitleId, { query: { enabled: cinemaTitleId > 0, staleTime: 10_000 } as any });
  const createComment = useCreateCinemaComment();
  const deleteComment = useDeleteCinemaComment();
  const [draft, setDraft] = useState('');
  const [replyTargetId, setReplyTargetId] = useState<number | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const typedComments = comments as unknown as CinemaCommentNode[];
  const commentCount = typedComments.reduce((total, comment) => total + 1 + comment.replies.length, 0);

  const submitComment = (event: React.FormEvent, parentCommentId?: number) => {
    event.preventDefault();
    const message = (parentCommentId ? replyDraft : draft).trim();
    if (!message) return;
    createComment.mutate({ id: cinemaTitleId, data: { message, ...(parentCommentId ? { parentCommentId } : {}) } }, {
      onSuccess: () => {
        if (parentCommentId) {
          setReplyTargetId(null);
          setReplyDraft('');
        } else {
          setDraft('');
        }
        void refetch();
      },
      onError: (error: any) => toast({ title: 'Comment unavailable', description: error?.body?.error || error?.message || 'Try again in a moment.', variant: 'destructive' }),
    });
  };

  const removeComment = (commentId: number) => {
    deleteComment.mutate({ id: cinemaTitleId, commentId }, {
      onSuccess: () => {
        void refetch();
        toast({ title: 'Comment removed' });
      },
      onError: (error: any) => toast({ title: 'Could not remove comment', description: error?.body?.error || error?.message || 'Try again in a moment.', variant: 'destructive' }),
    });
  };

  const canRemove = (comment: CinemaCommentNode) => signedInUser?.id === comment.userId || signedInUser?.role === 'owner';

  return (
    <section className="mt-8 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 sm:mt-10 sm:p-6" aria-labelledby="cinema-discussion">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary"><MessageSquareText className="h-4 w-4" /><span className="text-xs font-semibold">Cinema discussion</span></div>
          <h2 id="cinema-discussion" className="mt-1 text-lg font-bold text-white">{commentCount.toLocaleString()} {commentCount === 1 ? 'comment' : 'comments'}</h2>
        </div>
        <span className="rounded-full border border-white/[0.08] bg-black/20 px-2.5 py-1 text-[10px] font-semibold text-white/45">Newest first</span>
      </div>

      <div className="mt-5">
        {signedInUser ? <form onSubmit={(event) => submitComment(event)} className="flex gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/[0.1] bg-primary/10 text-xs font-semibold text-primary">{signedInUser.avatarUrl ? <img src={signedInUser.avatarUrl} alt="" className="h-full w-full object-cover" /> : signedInUser.username.slice(0, 1).toUpperCase()}</span><div className="min-w-0 flex-1"><Textarea value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={1000} placeholder={`Discuss ${title}`} className="min-h-20 resize-y border-white/[0.1] bg-black/25 text-sm text-white placeholder:text-white/30 focus-visible:ring-primary" /><div className="mt-2 flex items-center justify-between gap-3"><span className="text-[10px] text-white/30">{draft.length}/1000</span><Button type="submit" size="sm" disabled={!draft.trim() || createComment.isPending} className="h-9 rounded-lg px-3 text-xs font-semibold">{createComment.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Comment'}</Button></div></div></form> : <div className="flex flex-col gap-3 rounded-xl border border-white/[0.08] bg-black/20 p-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-white/55">Sign in to join the conversation around this title.</p><Link href="/sign-in" className="inline-flex min-h-9 items-center justify-center rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:brightness-110">Sign in to comment</Link></div>}
      </div>

      {isLoading ? <div className="mt-6 space-y-4" aria-label="Loading Cinema discussion"><div className="h-12 animate-pulse rounded-xl bg-white/[0.04]" /><div className="h-12 animate-pulse rounded-xl bg-white/[0.03]" /></div> : typedComments.length ? <div className="mt-6 space-y-5">{typedComments.map((comment) => <article key={comment.id} className="flex gap-3"><UserChip username={comment.username} avatarUrl={comment.avatarUrl} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-2 gap-y-1"><time dateTime={new Date(comment.createdAt).toISOString()} className="text-[10px] text-white/35">{formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}</time></div><p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-white/75">{comment.message}</p><div className="mt-2 flex items-center gap-2"><button type="button" onClick={() => { setReplyTargetId(replyTargetId === comment.id ? null : comment.id); setReplyDraft(''); }} className="inline-flex min-h-8 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold text-white/50 transition hover:bg-white/[0.06] hover:text-primary"><Reply className="h-3.5 w-3.5" />Reply</button>{canRemove(comment) && <button type="button" onClick={() => removeComment(comment.id)} disabled={deleteComment.isPending} className="inline-flex min-h-8 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold text-white/40 transition hover:bg-red-400/10 hover:text-red-200 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" />Remove</button>}</div>{replyTargetId === comment.id && <form onSubmit={(event) => submitComment(event, comment.id)} className="mt-3 flex gap-2 rounded-xl border border-white/[0.08] bg-black/20 p-2"><Textarea value={replyDraft} onChange={(event) => setReplyDraft(event.target.value)} maxLength={1000} placeholder={`Reply to ${comment.username}`} className="min-h-16 flex-1 resize-y border-white/[0.08] bg-white/[0.03] text-xs text-white placeholder:text-white/30 focus-visible:ring-primary" /><div className="flex flex-col gap-1"><Button type="submit" size="sm" disabled={!replyDraft.trim() || createComment.isPending} className="h-8 px-2 text-[10px] font-semibold">Post</Button><button type="button" onClick={() => { setReplyTargetId(null); setReplyDraft(''); }} className="h-8 rounded-md px-2 text-[10px] font-semibold text-white/45 hover:text-white">Cancel</button></div></form>}{comment.replies.length > 0 && <div className="mt-4 space-y-4 border-l border-white/[0.08] pl-3 sm:pl-4">{comment.replies.map((reply) => <article key={reply.id} className="flex gap-2.5"><UserChip username={reply.username} avatarUrl={reply.avatarUrl} size="sm" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-2 gap-y-1"><time dateTime={new Date(reply.createdAt).toISOString()} className="text-[10px] text-white/30">{formatDistanceToNow(new Date(reply.createdAt), { addSuffix: true })}</time>{canRemove(reply) && <button type="button" onClick={() => removeComment(reply.id)} disabled={deleteComment.isPending} className="ml-auto inline-flex items-center gap-1 text-[10px] font-semibold text-white/35 transition hover:text-red-200 disabled:opacity-50"><Trash2 className="h-3 w-3" />Remove</button>}</div><p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-white/65">{reply.message}</p></div></article>)}</div>}</div></article>)}</div> : <div className="mt-6 rounded-xl border border-dashed border-white/[0.12] bg-black/15 px-4 py-8 text-center"><MessageSquareText className="mx-auto h-5 w-5 text-white/25" /><p className="mt-3 text-sm font-semibold text-white/65">No comments yet.</p><p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-white/40">Be the first to comment on this owner-published title. Kryv does not manufacture activity or placeholder discussion.</p></div>}
    </section>
  );
}
