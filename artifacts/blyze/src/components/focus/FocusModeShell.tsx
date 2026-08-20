import { useState } from 'react';
import { Link } from 'wouter';
import {
  useCreateChannelMessage,
  useGetChannel,
  useGetChannelChatSettings,
  useGetCinemaTitle,
  useListChannelMessages,
} from '@workspace/api-client-react';
import { Clapperboard, Eye, Loader2, MessageCircleMore, Radio, Send, Users } from 'lucide-react';
import { useAuthStore } from '@/lib/auth-store';
import KryvPlayer from '@/components/video/KryvPlayer';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

type FocusSourceType = 'live' | 'cinema';

export interface FocusModeShellProps {
  sourceType: FocusSourceType;
  sourceId: number;
  chatEnabled: boolean;
  announcementText: string | null;
}

function FocusFallback({ announcementText }: Pick<FocusModeShellProps, 'announcementText'>) {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-1 items-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full rounded-3xl border border-white/[0.1] bg-black/35 p-6 text-center shadow-2xl sm:p-8">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/25 bg-primary/[0.08] text-primary"><Eye className="h-5 w-5" /></div>
        <h1 className="mt-5 text-xl font-bold text-white">Kryv Focus is temporarily unavailable</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-white/55">The selected presentation source cannot be shown right now. Kryv will not substitute a different stream or title.</p>
        {announcementText && <p className="mx-auto mt-4 max-w-xl rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 py-3 text-sm leading-relaxed text-white/70">{announcementText}</p>}
        <div className="mt-6"><Link href="/live" className="inline-flex min-h-11 items-center rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition hover:brightness-110">Return to Live</Link></div>
      </div>
    </section>
  );
}

function FocusChat({ channelId, channelName, requiresFollow }: { channelId: number; channelName: string; requiresFollow: boolean }) {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const [draft, setDraft] = useState('');
  const messagesQuery = useListChannelMessages(channelId, { query: { enabled: channelId > 0, refetchInterval: 15000 } });
  const createMessage = useCreateChannelMessage();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.trim()) return;
    if (!user) {
      toast({ title: 'Sign in to chat', description: 'You need a Kryv account to send a message.' });
      return;
    }
    if (requiresFollow) {
      toast({ title: 'Follow to chat', description: 'This creator has enabled follower-only chat. Follow the channel, then return to Kryv Focus.' });
      return;
    }
    createMessage.mutate({ id: channelId, data: { message: draft.trim() } }, {
      onSuccess: () => {
        setDraft('');
        void messagesQuery.refetch();
      },
      onError: (error: any) => toast({ title: 'Message was not sent', description: error?.body?.error || error?.message || 'Your draft remains available. Try again in a moment.', variant: 'destructive' }),
    });
  };

  return (
    <aside aria-label="Focus stream chat" className="flex min-h-[26rem] flex-col overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0a0c12]/90 shadow-xl lg:min-h-0">
      <div className="flex items-start justify-between gap-3 border-b border-white/[0.08] px-4 py-3.5"><div className="flex min-w-0 items-center gap-2.5"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/[0.1] text-primary"><MessageCircleMore className="h-4 w-4" /></span><div className="min-w-0"><h2 className="truncate text-sm font-bold text-white">Stream chat</h2><p className="mt-0.5 text-[10px] text-white/45">REST updates every 15 seconds</p></div></div><span className="rounded-full border border-white/[0.08] px-2 py-1 text-[9px] font-semibold text-white/45">{messagesQuery.data?.length ?? 0}</span></div>
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
        {messagesQuery.isLoading ? <div className="flex h-full items-center justify-center" role="status" aria-label="Loading stream chat"><Loader2 className="h-5 w-5 animate-spin text-primary" /><span className="sr-only">Loading stream chat</span></div> : messagesQuery.data?.length ? messagesQuery.data.map((message) => <article key={message.id} className="flex gap-2.5 rounded-xl px-1 py-2 text-xs hover:bg-white/[0.025]"><span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/[0.1] bg-primary/10 text-[10px] font-bold text-primary">{message.avatarUrl ? <img src={message.avatarUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" /> : message.username.slice(0, 1).toUpperCase()}</span><div className="min-w-0 flex-1"><div className="flex min-w-0 items-center gap-1.5"><span className="truncate font-semibold text-primary">{message.username}</span><time dateTime={new Date(message.createdAt).toISOString()} className="shrink-0 text-[9px] text-white/30">{new Date(message.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time></div><p className="mt-0.5 break-words leading-relaxed text-white/80">{message.message}</p></div></article>) : <div className="flex h-full flex-col items-center justify-center px-6 text-center"><MessageCircleMore className="h-5 w-5 text-primary/70" /><p className="mt-3 text-sm font-semibold text-white/70">No messages yet</p><p className="mt-1 text-xs leading-relaxed text-white/40">This room will show recorded chat messages when people participate.</p></div>}
      </div>
      <div className="border-t border-white/[0.08] p-3">
        {user && requiresFollow ? <div className="rounded-xl border border-primary/20 bg-primary/[0.06] p-3 text-center"><p className="text-xs font-bold text-white">This creator uses follower-only chat</p><p className="mt-1 text-[11px] leading-relaxed text-white/50">Follow {channelName} from its Live room, then return to Kryv Focus to participate.</p></div> : user ? <form onSubmit={submit} className="flex items-center gap-2"><input value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={500} aria-label="Send a Focus Mode chat message" placeholder={`Message ${channelName}`} className="min-h-11 min-w-0 flex-1 rounded-xl border border-white/[0.12] bg-white/[0.05] px-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-primary/60 focus:ring-2 focus:ring-primary/15" /><Button type="submit" size="icon" disabled={!draft.trim() || createMessage.isPending} className="h-11 w-11 shrink-0 rounded-xl" aria-label="Send message">{createMessage.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</Button></form> : <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3 text-center"><p className="text-xs font-semibold text-white/65">Sign in to join chat</p><div className="mt-2 flex justify-center gap-2"><Link href="/sign-in" className="inline-flex min-h-9 items-center rounded-lg bg-primary px-3 text-[11px] font-bold text-primary-foreground">Sign in</Link><Link href="/sign-up" className="inline-flex min-h-9 items-center rounded-lg border border-white/[0.12] px-3 text-[11px] font-bold text-white/70 hover:text-white">Create account</Link></div></div>}
      </div>
    </aside>
  );
}

function LiveFocus({ sourceId, chatEnabled, announcementText }: Omit<FocusModeShellProps, 'sourceType'>) {
  const channelQuery = useGetChannel(sourceId, { query: { enabled: sourceId > 0 } });
  const channel = channelQuery.data;
  const chatSettingsQuery = useGetChannelChatSettings(sourceId, { query: { enabled: chatEnabled && sourceId > 0, refetchInterval: 10000 } });
  const playbackId = channel?.fastpixPlaybackId || channel?.playbackId;
  const chatRequiresFollow = Boolean(chatSettingsQuery.data?.followersOnly && !channel?.isFollowing && !channel?.isOwner);

  if (channelQuery.isLoading) return <div className="flex flex-1 items-center justify-center" role="status" aria-label="Loading Kryv Focus live source"><Loader2 className="h-7 w-7 animate-spin text-primary" /><span className="sr-only">Loading Kryv Focus live source</span></div>;
  if (!channel) return <FocusFallback announcementText={announcementText} />;

  return (
    <section className="mx-auto w-full max-w-[1500px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
      {announcementText && <div className="mb-4 rounded-2xl border border-primary/20 bg-primary/[0.06] px-4 py-3 text-sm leading-relaxed text-white/75">{announcementText}</div>}
      <div className={`grid gap-5 ${chatEnabled ? 'xl:grid-cols-[minmax(0,1fr)_22rem]' : ''}`}>
        <div className="min-w-0"><div className="overflow-hidden rounded-2xl border border-white/[0.1] bg-black shadow-2xl sm:rounded-3xl"><div className="relative aspect-video">{channel.isLive && playbackId ? <KryvPlayer src={`https://stream.fastpix.com/${playbackId}.m3u8`} autoPlay muted live className="h-full w-full object-contain" ariaLabel={`${channel.displayName} Focus Mode live broadcast`} /> : <div className="flex h-full flex-col items-center justify-center px-6 text-center"><Radio className="h-7 w-7 text-primary/75" /><p className="mt-4 text-xl font-bold text-white">{channel.displayName} is offline</p><p className="mt-2 max-w-md text-sm leading-relaxed text-white/50">The owner-selected channel is not broadcasting right now. Kryv is not substituting a different live room.</p></div>}<div className="pointer-events-none absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-white/[0.14] bg-black/65 px-3 py-1.5 text-[10px] font-semibold text-white/85 backdrop-blur"><span className={`h-2 w-2 rounded-full ${channel.isLive ? 'bg-primary shadow-[0_0_10px_hsl(var(--primary)/0.9)]' : 'bg-white/35'}`} />Kryv Focus</div></div></div><div className="mt-4 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 sm:p-5"><div className="flex min-w-0 items-start gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/[0.1] bg-primary/15 text-lg font-bold text-primary">{channel.avatarUrl ? <img src={channel.avatarUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" /> : channel.displayName.slice(0, 1).toUpperCase()}</div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h1 className="truncate text-xl font-bold text-white">{channel.streamTitle || `${channel.displayName} on Kryv`}</h1>{channel.isLive && <span className="inline-flex items-center gap-1 rounded-full border border-primary/35 bg-primary/10 px-2 py-0.5 text-[9px] font-semibold text-primary"><span className="h-1.5 w-1.5 rounded-full bg-primary" />Live</span>}</div><p className="mt-1 text-sm text-white/55">{channel.displayName}{channel.categoryName ? ` · ${channel.categoryName}` : ''}</p><p className="mt-2 inline-flex items-center gap-1.5 text-xs text-white/45"><Users className="h-3.5 w-3.5 text-primary" />{channel.viewerCount.toLocaleString()} watching</p></div></div></div></div>
        {chatEnabled && <FocusChat channelId={channel.id} channelName={channel.displayName} requiresFollow={chatRequiresFollow} />}
      </div>
    </section>
  );
}

function CinemaFocus({ sourceId, announcementText }: Omit<FocusModeShellProps, 'sourceType' | 'chatEnabled'>) {
  const titleQuery = useGetCinemaTitle(sourceId, { query: { enabled: sourceId > 0 } as any });
  const title = titleQuery.data;

  if (titleQuery.isLoading) return <div className="flex flex-1 items-center justify-center" role="status" aria-label="Loading Kryv Focus Cinema source"><Loader2 className="h-7 w-7 animate-spin text-primary" /><span className="sr-only">Loading Kryv Focus Cinema source</span></div>;
  if (!title) return <FocusFallback announcementText={announcementText} />;

  return (
    <section className="mx-auto w-full max-w-[1320px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
      {announcementText && <div className="mb-4 rounded-2xl border border-primary/20 bg-primary/[0.06] px-4 py-3 text-sm leading-relaxed text-white/75">{announcementText}</div>}
      <div className="overflow-hidden rounded-2xl border border-white/[0.1] bg-black shadow-2xl sm:rounded-3xl"><div className="relative aspect-video">{title.playbackAvailable && title.featurePlaybackId ? <KryvPlayer src={`https://stream.fastpix.com/${title.featurePlaybackId}.m3u8`} poster={title.backdropUrl || title.posterUrl || undefined} className="h-full w-full object-contain" ariaLabel={`${title.title} Focus Mode feature`} /> : <div className="flex h-full flex-col items-center justify-center px-6 text-center"><Clapperboard className="h-7 w-7 text-primary/75" /><p className="mt-4 text-xl font-bold text-white">Viewing access is not available yet</p><p className="mt-2 max-w-md text-sm leading-relaxed text-white/50">{title.playbackBlockedReason || 'This owner-selected Cinema title does not currently have a playable source.'}</p></div>}<div className="pointer-events-none absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-white/[0.14] bg-black/65 px-3 py-1.5 text-[10px] font-semibold text-white/85 backdrop-blur"><Clapperboard className="h-3.5 w-3.5 text-primary" />Kryv Focus</div></div></div><div className="mt-4 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 sm:p-5"><h1 className="text-xl font-bold text-white sm:text-2xl">{title.title}</h1><p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/60">{title.synopsis || 'Details for this owner-published Cinema title will be added by the production team.'}</p></div>
    </section>
  );
}

export function FocusModeShell({ sourceType, sourceId, chatEnabled, announcementText }: FocusModeShellProps) {
  return sourceType === 'live'
    ? <LiveFocus sourceId={sourceId} chatEnabled={chatEnabled} announcementText={announcementText} />
    : <CinemaFocus sourceId={sourceId} announcementText={announcementText} />;
}
