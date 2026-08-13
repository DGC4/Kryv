import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'wouter';
import {
  useGetChannelBySlug,
  useListChannelMessages,
  useCreateChannelMessage,
  useFollowChannel,
  useUnfollowChannel,
  useChannelHeartbeat,
  useCreateChannelModerationAction,
  useGetChannelChatSettings,
  useGetChannelEngagement,
  useCreateChannelEngagementAction,
  useCreateCryptoTip,
  useCreateCryptoSubscription,
  useCreateWalletTip,
  useCreateClip,
  useCreateChannelChatReport,
  useGetNotificationPreferences,
  useUpdateNotificationPreferences,
  useListChannels,
  useListFollowedLiveChannels,
} from '@workspace/api-client-react';
import { useAuthStore } from '@/lib/auth-store';
import { getApiUrl } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import HlsPlayer from '@/components/video/HlsPlayer';
import { Loader2, Users, Heart, Share2, Send, Shield, Clock3, Ban, Trash2, Trophy, Vote, Sparkles, Wallet, Scissors, Copy, X, Flag, Maximize2, Minimize2, Globe2, Youtube, Instagram, ExternalLink, Bell, BellOff, Languages, Tag, Megaphone, Radio, ChevronRight, CircleDot } from 'lucide-react';
import { GoldenDBadge } from '@/components/brand/BrandIdentity';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

export default function LiveChannel() {
  const { channelSlugOrId } = useParams<{ channelSlugOrId: string }>();
  const { user, token } = useAuthStore();
  const isSignedIn = !!user;
  const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'connected' | 'rest'>('rest');
  const [theaterMode, setTheaterMode] = useState(false);

  const { data: channel, isLoading, refetch: refetchChannel } = useGetChannelBySlug(channelSlugOrId || '', {
    query: { enabled: !!channelSlugOrId, refetchInterval: realtimeStatus === 'connected' ? false : 15000 },
  });

  const channelId = channel?.id;

  const { data: messages, refetch: refetchMessages } = useListChannelMessages(channelId!, {
    query: { enabled: !!channelId, refetchInterval: realtimeStatus === 'connected' ? false : 15000 },
  });
  const { data: chatSettings } = useGetChannelChatSettings(channelId!, {
    query: { enabled: !!channelId, refetchInterval: realtimeStatus === 'connected' ? false : 10000 },
  });
  const { data: engagement, refetch: refetchEngagement } = useGetChannelEngagement(channelId!, {
    query: { enabled: !!channelId, refetchInterval: realtimeStatus === 'connected' ? false : 10000 },
  });
  const { data: liveRailChannels } = useListChannels({ live: true }, {
    query: { refetchInterval: realtimeStatus === 'connected' ? false : 15000 },
  });
  const { data: followedLiveChannels } = useListFollowedLiveChannels({
    query: { enabled: isSignedIn, refetchInterval: realtimeStatus === 'connected' ? false : 15000 },
  });
  const { data: notificationPreferences } = useGetNotificationPreferences({
    query: { enabled: isSignedIn },
  });

  const { toast } = useToast();
  const createMessage = useCreateChannelMessage();
  const follow = useFollowChannel();
  const unfollow = useUnfollowChannel();
  const heartbeat = useChannelHeartbeat();
  const moderateMessage = useCreateChannelModerationAction();
  const engagementAction = useCreateChannelEngagementAction();
  const createCryptoTip = useCreateCryptoTip();
  const createCryptoSubscription = useCreateCryptoSubscription();
  const createWalletTip = useCreateWalletTip();
  const createClip = useCreateClip();
  const createChatReport = useCreateChannelChatReport();
  const updateNotificationPreferences = useUpdateNotificationPreferences();
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [chatInput, setChatInput] = useState('');
  const [liveViewerCount, setLiveViewerCount] = useState<number>(0);
  const [supportOpen, setSupportOpen] = useState(false);
  const [supportAmount, setSupportAmount] = useState('5');
  const [supportCoin, setSupportCoin] = useState<'BTC' | 'LTC' | 'ETH' | 'DOGE'>('BTC');
  const [supportMessage, setSupportMessage] = useState('');
  const [supportSource, setSupportSource] = useState<'invoice' | 'wallet'>('invoice');
  const [subscriptionTier, setSubscriptionTier] = useState<1 | 2 | 3>(1);
  const [cryptoCheckout, setCryptoCheckout] = useState<any | null>(null);
  const [reportTarget, setReportTarget] = useState<{ id: number; username: string } | null>(null);
  const [channelReportOpen, setChannelReportOpen] = useState(false);
  const [channelReportReason, setChannelReportReason] = useState<'harassment' | 'hate_or_harm' | 'spam_or_scam' | 'sexual_content' | 'violence_or_threat' | 'other'>('other');
  const [channelReportDetails, setChannelReportDetails] = useState('');
  const [isSubmittingChannelReport, setIsSubmittingChannelReport] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Event-driven chat and live-state refresh. REST stays authoritative for writes,
  // moderation, and fallback reads; the socket only accelerates refreshes. A configured
  // gateway reconnects with bounded backoff rather than leaving viewers on a stale pane.
  useEffect(() => {
    if (!channelId || typeof window === 'undefined') return;
    const websocketUrl = import.meta.env.VITE_REALTIME_URL?.trim();
    if (!websocketUrl) {
      setRealtimeStatus('rest');
      return;
    }

    let disposed = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;

    const scheduleReconnect = () => {
      if (disposed) return;
      setRealtimeStatus('rest');
      const delay = Math.min(30000, 1000 * 2 ** Math.min(attempts++, 5));
      reconnectTimer = setTimeout(connect, delay);
    };

    const connect = () => {
      if (disposed) return;
      setRealtimeStatus('connecting');
      try {
        socket = new WebSocket(websocketUrl, ['kryv.v1']);
        socket.onopen = () => {
          attempts = 0;
          setRealtimeStatus('connected');
          socket?.send(JSON.stringify({ type: 'subscribe', channelId }));
        };
        socket.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data) as { type?: string; channelId?: number };
            if (message.channelId !== channelId) return;
            if (message.type === 'chat.message.created' || message.type === 'chat.message.deleted' || message.type === 'channel.moderation.updated') refetchMessages();
            if (message.type === 'engagement.updated') refetchEngagement();
            if (message.type === 'live.state.updated') refetchChannel();
          } catch {
            // Malformed relay events never bypass REST authority.
          }
        };
        socket.onclose = scheduleReconnect;
        socket.onerror = () => socket?.close();
      } catch {
        scheduleReconnect();
      }
    };

    connect();
    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'unsubscribe', channelId }));
      socket?.close();
    };
  }, [channelId, refetchChannel, refetchEngagement, refetchMessages]);

  // Theater mode is entirely client-side; Escape always returns the viewer to the standard live layout.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setTheaterMode(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Auto-scroll chat to bottom on new messages
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Sync viewer count from channel data
  useEffect(() => {
    if (channel?.viewerCount !== undefined) {
      setLiveViewerCount(channel.viewerCount);
    }
  }, [channel?.viewerCount]);

  // Viewer heartbeat — send every 30s while the channel is live
  // This is how Kick/Twitch track concurrent viewers in real time
  useEffect(() => {
    if (!channelId || !channel?.isLive) {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      return;
    }
    // Fire immediately on mount, then every 30s
    heartbeat.mutate({ id: channelId }, {
      onSuccess: (data: any) => {
        if (typeof data?.viewerCount === 'number') {
          setLiveViewerCount(data.viewerCount);
        }
      }
    });
    heartbeatRef.current = setInterval(() => {
      heartbeat.mutate({ id: channelId }, {
        onSuccess: (data: any) => {
          if (typeof data?.viewerCount === 'number') {
            setLiveViewerCount(data.viewerCount);
          }
        }
      });
    }, 30000);
    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId, channel?.isLive]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !channelId) return;
    if (!isSignedIn) {
      toast({
        title: "Sign in to chat",
        description: "You need to be signed in to send messages.",
      });
      return;
    }
    createMessage.mutate(
      { id: channelId, data: { message: chatInput } },
      {
        onSuccess: () => {
          setChatInput('');
          refetchMessages();
        },
      },
    );
  };

  const handleModerationAction = (
    action: 'delete_message' | 'timeout' | 'ban',
    message: { id: number; userId: string; username: string },
  ) => {
    if (!channelId || !channel?.isOwner) return;
    const targetUserId = Number(message.userId);
    const data = action === 'delete_message'
      ? { action, messageId: message.id }
      : action === 'timeout'
        ? { action, targetUserId, durationSeconds: 600 }
        : { action, targetUserId };

    moderateMessage.mutate(
      { id: channelId, data },
      {
        onSuccess: () => {
          refetchMessages();
          const labels = { delete_message: 'Message removed', timeout: `${message.username} timed out for 10 minutes`, ban: `${message.username} banned from chat` };
          toast({ title: labels[action] });
        },
        onError: (err: any) => toast({ title: 'Moderation action failed', description: err?.body?.error || err?.message || 'Please try again.', variant: 'destructive' }),
      },
    );
  };

  const handleEngagementAction = (data: any) => {
    if (!channelId) return;
    if (!isSignedIn) {
      toast({ title: 'Sign in to participate', description: 'You need to be signed in to use channel points, polls, and predictions.' });
      return;
    }
    engagementAction.mutate(
      { id: channelId, data },
      {
        onSuccess: (result: any) => {
          if (result?.awarded) toast({ title: `+${result.awarded} channel points`, description: 'Keep watching live to earn more.' });
          else toast({ title: 'Participation recorded' });
          refetchEngagement();
        },
        onError: (err: any) => toast({ title: 'Unable to complete action', description: err?.body?.error || err?.message || 'Please try again.', variant: 'destructive' }),
      },
    );
  };

  const handleCryptoSupport = () => {
    if (!channelId) return;
    if (!isSignedIn) {
      toast({ title: 'Sign in to support this creator', description: 'You need to be signed in before starting a crypto invoice.' });
      return;
    }
    const amount = Number(supportAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast({ title: 'Enter a valid support amount', description: 'Choose a positive USD price quote for your selected crypto invoice.', variant: 'destructive' });
      return;
    }
    createCryptoTip.mutate({ id: channelId, data: { amount, cryptoCurrency: supportCoin, ...(supportMessage.trim() ? { message: supportMessage.trim() } : {}) } }, {
      onSuccess: (checkout) => {
        if (checkout.qrCodeDataUrl && checkout.paymentAddress && checkout.invoiceTotal) {
          setCryptoCheckout(checkout);
          return;
        }
        toast({
          title: 'Secure payment instructions are unavailable',
          description: 'Kryv will not navigate you away from the live stream. Please try again when the provider can return the exact crypto payment details.',
          variant: 'destructive',
        });
      },
      onError: (err: any) => toast({ title: 'Crypto support is unavailable', description: err?.body?.error || err?.message || 'The creator invoice could not be started. Please try again later.', variant: 'destructive' }),
    });
  };

  const handleCryptoSubscription = () => {
    if (!channelId) return;
    if (!isSignedIn) {
      toast({ title: 'Sign in to subscribe', description: 'You need to be signed in before starting a crypto subscription invoice.' });
      return;
    }
    createCryptoSubscription.mutate({ id: channelId, data: { tier: subscriptionTier, cryptoCurrency: supportCoin } }, {
      onSuccess: (checkout) => {
        if (checkout.qrCodeDataUrl && checkout.paymentAddress && checkout.invoiceTotal) {
          setCryptoCheckout(checkout);
          return;
        }
        toast({
          title: 'Secure payment instructions are unavailable',
          description: 'Kryv will not navigate you away from the live stream. Please try again when the provider can return the exact crypto payment details.',
          variant: 'destructive',
        });
      },
      onError: (err: any) => toast({ title: 'Crypto subscription is unavailable', description: err?.body?.error || err?.message || 'The subscription invoice could not be started. Please try again later.', variant: 'destructive' }),
    });
  };

  const handleWalletSupport = () => {
    if (!channelId) return;
    if (!isSignedIn) {
      toast({ title: 'Sign in to support this creator', description: 'You need to be signed in before using your Kryv Wallet.' });
      return;
    }
    if (!/^\d+(\.\d{1,8})?$/.test(supportAmount) || Number(supportAmount) <= 0) {
      toast({ title: 'Enter an exact crypto amount', description: 'Use up to eight decimal places for the selected crypto asset.', variant: 'destructive' });
      return;
    }
    createWalletTip.mutate({ id: channelId, data: { currency: supportCoin, amount: supportAmount, ...(supportMessage.trim() ? { message: supportMessage.trim() } : {}) } }, {
      onSuccess: (payment) => {
        setSupportMessage('');
        toast({ title: 'Creator supported', description: `${payment.creatorNetAmount} ${payment.currency} settled to the creator balance.` });
      },
      onError: (err: any) => toast({ title: 'Kryv Wallet support is unavailable', description: err?.body?.error || err?.message || 'Your wallet payment could not be completed.', variant: 'destructive' }),
    });
  };

  const handleLiveClip = () => {
    if (!channelId || !channel?.isLive) return;
    if (!isSignedIn) {
      toast({ title: 'Sign in to clip a moment', description: 'You need to be signed in before requesting a live clip.' });
      return;
    }
    const startedAt = channel.lastStreamAt ? new Date(channel.lastStreamAt).getTime() : Date.now();
    const endTime = Math.floor((Date.now() - startedAt) / 1000);
    const startTime = Math.max(0, endTime - 30);
    if (endTime <= startTime) {
      toast({ title: 'Live clip is not ready', description: 'Give the broadcast a few more seconds, then try again.' });
      return;
    }
    createClip.mutate({
      data: {
        channelId,
        startTime,
        endTime,
        title: `${channel.displayName} · Live moment`,
      },
    }, {
      onSuccess: () => toast({ title: 'Clip processing', description: 'Your 30-second live moment will appear when processing finishes.' }),
      onError: (err: any) => toast({ title: 'Could not create clip', description: err?.body?.error || err?.message || 'Try another moment in a few seconds.', variant: 'destructive' }),
    });
  };

  const handleReportMessage = (reason: 'harassment' | 'hate_or_harm' | 'spam_or_scam' | 'sexual_content' | 'violence_or_threat' | 'other') => {
    if (!channelId || !reportTarget) return;
    if (!isSignedIn) {
      toast({ title: 'Sign in to report', description: 'You need to be signed in before reporting a chat message.' });
      return;
    }
    createChatReport.mutate({ id: channelId, data: { messageId: reportTarget.id, reason } }, {
      onSuccess: () => {
        setReportTarget(null);
        toast({ title: 'Report received', description: 'Kryv recorded this message for channel and platform safety review.' });
      },
      onError: (err: any) => toast({ title: 'Report could not be sent', description: err?.body?.error || err?.message || 'Try again in a moment.', variant: 'destructive' }),
    });
  };

  const handleFollowToggle = () => {
    if (!isSignedIn) {
      toast({
        title: "Sign in to follow",
        description: "You need to be signed in to follow channels.",
      });
      return;
    }
    if (!channelId) return;
    if (channel?.isFollowing) {
      unfollow.mutate({ id: channelId });
    } else {
      follow.mutate({ id: channelId });
    }
  };

  const handleShareChannel = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${channel?.displayName || 'Kryv'} on Kryv`, text: channel?.streamTitle || 'Watch on Kryv', url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast({ title: 'Channel link copied', description: 'Share this Kryv channel anywhere.' });
    } catch (error) {
      if ((error as DOMException | undefined)?.name !== 'AbortError') {
        toast({ title: 'Unable to share', description: 'Please copy the link from your browser.', variant: 'destructive' });
      }
    }
  };

  const handleLiveAlertToggle = () => {
    if (!isSignedIn) {
      toast({ title: 'Sign in to manage alerts', description: 'Sign in to choose when Kryv alerts you about followed creators.' });
      return;
    }
    if (!notificationPreferences) {
      toast({ title: 'Alerts are loading', description: 'Please try again in a moment.' });
      return;
    }
    updateNotificationPreferences.mutate(
      {
        data: {
          ...notificationPreferences,
          notifyOnLive: !notificationPreferences.notifyOnLive,
        },
      },
      {
        onSuccess: () => toast({ title: notificationPreferences.notifyOnLive ? 'Live alerts paused' : 'Live alerts enabled', description: 'This controls Kryv in-app alerts for followed creators.' }),
        onError: (err: any) => toast({ title: 'Could not update alerts', description: err?.body?.error || err?.message || 'Please try again.', variant: 'destructive' }),
      },
    );
  };

  const handleChannelReport = async () => {
    if (!isSignedIn || !token) {
      toast({ title: 'Sign in to report', description: 'You need to be signed in before reporting a channel.' });
      return;
    }
    if (!channelId) return;
    setIsSubmittingChannelReport(true);
    try {
      const response = await fetch(getApiUrl(`/api/channels/${channelId}/channel-reports`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: channelReportReason, ...(channelReportDetails.trim() ? { details: channelReportDetails.trim() } : {}) }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'The report could not be submitted.');
      setChannelReportOpen(false);
      setChannelReportDetails('');
      toast({ title: 'Report received', description: 'Kryv recorded this channel for safety review.' });
    } catch (error) {
      toast({ title: 'Report could not be sent', description: error instanceof Error ? error.message : 'Please try again in a moment.', variant: 'destructive' });
    } finally {
      setIsSubmittingChannelReport(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!channel) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <p className="text-xl text-muted-foreground">Channel not found</p>
      </div>
    );
  }

  // Build the correct HLS playback URL
  // FastPix format: https://stream.fastpix.com/{playbackId}.m3u8
  const hlsSrc = (channel.fastpixPlaybackId || channel.playbackId)
    ? `https://stream.fastpix.com/${channel.fastpixPlaybackId || channel.playbackId}.m3u8`
    : null;
  const railChannels = Array.from(
    new Map([...(followedLiveChannels ?? []), ...(liveRailChannels ?? [])].map((item) => [item.id, item])).values(),
  ).filter((item) => item.id !== channel.id).slice(0, 8);
  const promotionLinks = [
    { label: 'Website', detail: 'Official destination', href: channel.websiteUrl, Icon: Globe2 },
    { label: 'YouTube', detail: 'Watch more from this creator', href: channel.youtubeUrl, Icon: Youtube },
    { label: 'Instagram', detail: 'Follow the creator', href: channel.instagramUrl, Icon: Instagram },
    { label: 'X', detail: 'Join the conversation', href: channel.xUrl, Icon: ExternalLink },
  ].filter((link): link is { label: string; detail: string; href: string; Icon: typeof Globe2 } => Boolean(link.href));

  return (
    <div className={`relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden bg-background ${theaterMode ? 'xl:block' : 'xl:flex-row'}`}>
      {!theaterMode && (
        <aside className="hidden w-56 shrink-0 flex-col border-r border-white/[0.08] bg-[#090b11] xl:flex" aria-label="Live discovery">
          <nav className="border-b border-white/[0.08] p-3" aria-label="Live navigation">
            <p className="px-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/35">Discover</p>
            <div className="mt-2 space-y-1">
              <Link href="/live" className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-bold text-white/65 transition hover:bg-white/[0.06] hover:text-white"><Radio className="h-3.5 w-3.5 text-primary" />Live now</Link>
              <Link href="/live/categories" className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-bold text-white/65 transition hover:bg-white/[0.06] hover:text-white"><Tag className="h-3.5 w-3.5 text-primary" />Browse categories</Link>
            </div>
          </nav>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
            {isSignedIn && (
              <section aria-labelledby="followed-live-rail">
                <div className="mb-2 flex items-center justify-between gap-2 px-2"><p id="followed-live-rail" className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">Following</p><span className="text-[10px] font-bold text-primary">{followedLiveChannels?.length ?? 0} live</span></div>
                {followedLiveChannels?.length ? (
                  <div className="space-y-1">{followedLiveChannels.slice(0, 5).map((item) => <Link key={item.id} href={`/live/${item.slug || item.id}`} className="group flex items-center gap-2 rounded-lg p-2 transition hover:bg-white/[0.06]"><div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full border border-white/[0.1] bg-primary/15">{item.avatarUrl ? <img src={item.avatarUrl} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center text-xs font-black text-primary">{item.displayName[0]}</span>}<span className="absolute bottom-0 right-0 h-2 w-2 rounded-full border border-[#090b11] bg-emerald-400" /></div><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-white/80 group-hover:text-white">{item.displayName}</p><p className="truncate text-[10px] text-white/40">{item.categoryName || 'Live on Kryv'}</p></div><span className="text-[10px] font-bold text-white/45">{item.viewerCount.toLocaleString()}</span></Link>)}</div>
                ) : <p className="rounded-lg border border-dashed border-white/[0.08] px-2.5 py-3 text-[11px] leading-relaxed text-white/35">Follow creators to see their live rooms here.</p>}
              </section>
            )}
            <section className={isSignedIn ? 'mt-5 border-t border-white/[0.08] pt-4' : ''} aria-labelledby="live-rooms-rail">
              <div className="mb-2 flex items-center justify-between gap-2 px-2"><p id="live-rooms-rail" className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">Live rooms</p><CircleDot className="h-3.5 w-3.5 text-red-400" /></div>
              {railChannels.length ? <div className="space-y-1">{railChannels.map((item) => <Link key={item.id} href={`/live/${item.slug || item.id}`} className="group flex items-center gap-2 rounded-lg p-2 transition hover:bg-white/[0.06]"><div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full border border-white/[0.1] bg-primary/15">{item.avatarUrl ? <img src={item.avatarUrl} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center text-xs font-black text-primary">{item.displayName[0]}</span>}<span className="absolute bottom-0 right-0 h-2 w-2 rounded-full border border-[#090b11] bg-red-400" /></div><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-white/80 group-hover:text-white">{item.displayName}</p><p className="truncate text-[10px] text-white/40">{item.categoryName || item.streamTitle || 'Live on Kryv'}</p></div><span className="text-[10px] font-bold text-white/45">{item.viewerCount.toLocaleString()}</span></Link>)}</div> : <p className="rounded-lg border border-dashed border-white/[0.08] px-2.5 py-3 text-[11px] leading-relaxed text-white/35">Live rooms will appear here as creators go on air.</p>}
            </section>
          </div>
          <div className="border-t border-white/[0.08] p-3"><Link href="/live/categories" className="flex items-center justify-between rounded-lg px-2.5 py-2 text-xs font-black text-primary transition hover:bg-primary/10 hover:text-white">Explore live <ChevronRight className="h-4 w-4" /></Link></div>
        </aside>
      )}
      {/* Main Content: the player and action strip stay above secondary channel information. */}
      <div className={`flex min-w-0 flex-col ${theaterMode ? 'h-full w-full shrink-0 overflow-hidden' : 'flex-1 overflow-y-auto'}`}>
        {/* Video Player - Responsive */}
        <div className={`w-full bg-black relative ${theaterMode ? 'h-full' : 'aspect-video sm:aspect-video lg:flex-1'}`}>
          {channel.isLive && hlsSrc ? (
            <HlsPlayer
              src={hlsSrc}
              autoPlay
              muted
              live
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center">
              {channel.bannerUrl && (
                <img
                  src={channel.bannerUrl}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover opacity-20 blur-md"
                />
              )}
              <div className="relative z-10 text-center">
                <div className="w-24 h-24 rounded-full bg-white/10 mx-auto mb-4 overflow-hidden border-2 border-white/10">
                  {channel.avatarUrl ? (
                    <img src={channel.avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-primary/20 text-primary text-4xl font-bold">
                      {channel.displayName[0]}
                    </div>
                  )}
                </div>
                <h2 className="text-2xl font-display font-bold text-white mb-2">
                  {channel.displayName} is offline
                </h2>
                <p className="text-muted-foreground">Check back later when they go live.</p>
              </div>
            </div>
          )}

          {channel.isLive && (
            <div className="absolute top-4 left-4 flex gap-2">
              <span className="bg-destructive text-white text-xs font-bold px-2 py-1 rounded uppercase tracking-wider animate-pulse">
                Live
              </span>
              <span className="bg-black/60 backdrop-blur text-white text-xs font-medium px-2 py-1 rounded flex items-center gap-1">
                <Users className="w-3 h-3" />
                {liveViewerCount.toLocaleString()} {liveViewerCount === 1 ? 'viewer' : 'viewers'}
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={() => setTheaterMode((current) => !current)}
            className="absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-xl border border-white/15 bg-black/70 px-3 py-2 text-xs font-black text-white shadow-lg backdrop-blur transition hover:border-primary/60 hover:bg-black/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-pressed={theaterMode}
            aria-label={theaterMode ? 'Exit theater mode' : 'Enter theater mode'}
          >
            {theaterMode ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            {theaterMode ? 'Exit theater' : 'Theater mode'}
          </button>
        </div>

        <section className="border-b border-white/[0.08] bg-[#0b0d13] px-4 py-4 sm:px-6 lg:px-7" aria-label="Channel actions">
          <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-center 2xl:justify-between">
            <div className="flex min-w-0 gap-3">
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full border border-white/[0.12] bg-primary/15 sm:h-14 sm:w-14">
                {channel.avatarUrl ? <img src={channel.avatarUrl} alt={channel.displayName} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-xl font-black text-primary">{channel.displayName[0]}</div>}
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-lg font-black tracking-tight text-white sm:text-xl">{channel.streamTitle || `${channel.displayName}'s stream`}</h1>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs"><span className="font-bold text-white">{channel.displayName}</span>{Number(channel.ownerUserId) === 1 && <GoldenDBadge />}{channel.isLive ? <span className="inline-flex items-center gap-1 font-black uppercase tracking-[0.14em] text-red-300"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />Live</span> : <span className="font-bold text-white/40">Offline</span>}</div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] font-bold text-white/50"><span className="inline-flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-primary" />{liveViewerCount.toLocaleString()} watching</span><span className="inline-flex items-center gap-1.5"><Tag className="h-3.5 w-3.5 text-primary" />{channel.categoryName || 'Uncategorized'}</span><span className="inline-flex items-center gap-1.5"><Languages className="h-3.5 w-3.5 text-primary" />English</span><span>{typeof channel.followerCount === 'number' ? `${channel.followerCount.toLocaleString()} followers` : 'Kryv creator channel'}</span></div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant={channel.isFollowing ? 'secondary' : 'default'} onClick={handleFollowToggle} disabled={follow.isPending || unfollow.isPending} className="h-9 rounded-lg px-3 text-xs font-black"><Heart className={`mr-1.5 h-3.5 w-3.5 ${channel.isFollowing ? 'fill-current' : ''}`} />{channel.isFollowing ? 'Following' : 'Follow'}</Button>
              <Button variant="secondary" onClick={handleLiveAlertToggle} disabled={updateNotificationPreferences.isPending} className="h-9 rounded-lg border border-white/[0.1] px-3 text-xs font-black text-white/80 hover:text-white" aria-label={notificationPreferences?.notifyOnLive ? 'Pause live alerts' : 'Enable live alerts'}>{notificationPreferences?.notifyOnLive ? <Bell className="mr-1.5 h-3.5 w-3.5 text-primary" /> : <BellOff className="mr-1.5 h-3.5 w-3.5" />}{notificationPreferences?.notifyOnLive ? 'Alerts on' : 'Alerts'}</Button>
              <Button variant="secondary" onClick={() => setSupportOpen(true)} className="h-9 rounded-lg border border-primary/30 bg-primary/[0.08] px-3 text-xs font-black text-primary hover:bg-primary/15 hover:text-white"><Wallet className="mr-1.5 h-3.5 w-3.5" />Gift crypto</Button>
              <Button variant="secondary" onClick={() => { setSubscriptionTier(1); setSupportOpen(true); }} className="h-9 rounded-lg border border-white/[0.1] px-3 text-xs font-black text-white/80 hover:text-white"><Heart className="mr-1.5 h-3.5 w-3.5" />Subscribe</Button>
              {channel.isLive && <Button variant="secondary" onClick={handleLiveClip} disabled={createClip.isPending} className="h-9 rounded-lg border border-white/[0.1] px-3 text-xs font-black text-white/80 hover:text-white">{createClip.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Scissors className="mr-1.5 h-3.5 w-3.5" />}Clip</Button>}
              <Button variant="secondary" size="icon" onClick={handleShareChannel} className="h-9 w-9 rounded-lg border border-white/[0.1] text-white/70 hover:text-white" aria-label="Share this channel"><Share2 className="h-4 w-4" /></Button>
              <Button variant="secondary" size="icon" onClick={() => isSignedIn ? setChannelReportOpen(true) : toast({ title: 'Sign in to report', description: 'You need to be signed in before reporting a channel.' })} className="h-9 w-9 rounded-lg border border-white/[0.1] text-white/50 hover:border-red-300/40 hover:text-red-200" aria-label="Report this channel"><Flag className="h-4 w-4" /></Button>
            </div>
          </div>
        </section>

        <div className="px-4 py-5 sm:px-6 lg:px-7">

          <Dialog open={supportOpen} onOpenChange={setSupportOpen}>
            <DialogContent
              overlayClassName="bg-black/35 backdrop-blur-[1px]"
              className="left-0 right-0 top-[30dvh] h-[70dvh] max-h-none w-full max-w-none translate-x-0 translate-y-0 gap-0 overflow-y-auto rounded-t-[1.5rem] border-white/10 bg-[#11131a]/[0.98] p-4 shadow-2xl sm:left-auto sm:right-4 sm:top-[5dvh] sm:h-[90dvh] sm:w-[min(34rem,calc(100vw-2rem))] sm:rounded-[1.5rem] sm:p-5"
            >
              <DialogTitle className="sr-only">Support {channel.displayName} with crypto</DialogTitle>
              <DialogDescription className="sr-only">Crypto-only support and subscription options. The stream remains available behind this panel.</DialogDescription>
              <section className="rounded-[1.35rem] border border-primary/25 bg-primary/[0.055] p-4 shadow-2xl sm:p-5">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-2 text-primary"><Wallet className="h-4 w-4" /><h3 className="text-sm font-black">Crypto support</h3></div><p className="mt-1 text-xs leading-relaxed text-white/50">Choose BTC, LTC, ETH, or DOGE. Kryv opens a secure crypto invoice; the USD amount is only a price quote, never a card or fiat checkout.</p></div><span className="rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-white/50">Crypto only</span></div>
              <div className="mt-4 grid gap-2 sm:grid-cols-3"><div className="rounded-xl border border-emerald-300/20 bg-emerald-300/[0.06] px-3 py-2"><p className="text-[9px] font-black uppercase tracking-widest text-emerald-200/70">Creator receives</p><p className="mt-1 text-sm font-black text-emerald-100">95%</p></div><div className="rounded-xl border border-primary/20 bg-primary/[0.06] px-3 py-2"><p className="text-[9px] font-black uppercase tracking-widest text-primary/70">Kryv retains</p><p className="mt-1 text-sm font-black text-white">5%</p></div><div className="rounded-xl border border-white/[0.1] bg-black/25 px-3 py-2"><p className="text-[9px] font-black uppercase tracking-widest text-white/35">Checkout commission</p><p className="mt-1 text-[11px] font-bold text-white/70">Paid separately by you</p></div></div>
              <p className="mt-3 text-[11px] leading-relaxed text-white/40">The 95/5 split applies to the provider-confirmed crypto subtotal for eligible subscriptions and tips. The checkout commission is shown separately before payment and never reduces the advertised creator share.</p>
              <div className="mt-4 flex rounded-xl border border-white/[0.1] bg-black/25 p-1 text-xs font-bold"><button type="button" onClick={() => setSupportSource('invoice')} className={`flex-1 rounded-lg px-3 py-2 transition ${supportSource === 'invoice' ? 'bg-primary text-primary-foreground' : 'text-white/55 hover:text-white'}`}>Direct crypto</button><button type="button" disabled title="Customer wallet custody is not active" className="flex-1 cursor-not-allowed rounded-lg px-3 py-2 text-white/25">Kryv Wallet · Coming soon</button></div>
              <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]"><label className="text-xs font-bold text-white/55">{supportSource === 'wallet' ? `Support amount (${supportCoin})` : 'Support amount (USD quote)'}<input type="number" min={supportSource === 'wallet' ? '0.00000001' : '0.01'} step={supportSource === 'wallet' ? '0.00000001' : '0.01'} value={supportAmount} onChange={event => setSupportAmount(event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-white/[0.1] bg-black/30 px-3 text-sm text-white outline-none focus:border-primary/60" /></label><label className="text-xs font-bold text-white/55">Pay with<select value={supportCoin} onChange={event => setSupportCoin(event.target.value as typeof supportCoin)} className="mt-1.5 h-10 w-full rounded-xl border border-white/[0.1] bg-black/30 px-3 text-sm text-white outline-none focus:border-primary/60"><option value="BTC">Bitcoin (BTC)</option><option value="LTC">Litecoin (LTC)</option><option value="ETH">Ethereum (ETH)</option><option value="DOGE">Dogecoin (DOGE)</option></select></label><div className="flex items-end"><Button onClick={supportSource === 'wallet' ? handleWalletSupport : handleCryptoSupport} disabled={supportSource === 'wallet' ? createWalletTip.isPending : createCryptoTip.isPending} className="h-10 w-full rounded-xl font-black">{(supportSource === 'wallet' ? createWalletTip.isPending : createCryptoTip.isPending) ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Wallet className="mr-2 h-4 w-4" /> {supportSource === 'wallet' ? 'Support now' : 'Continue'}</>}</Button></div></div>
              <section className="mt-4 rounded-xl border border-white/[0.1] bg-black/25 p-3 sm:p-4"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-black text-white">Channel subscription</p><p className="mt-1 text-[11px] leading-relaxed text-white/45">Choose a channel tier, then Kryv will show the provider-confirmed crypto amount before you pay. No fiat checkout is used.</p></div><span className="rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-primary">Crypto only</span></div><div className="mt-3 grid grid-cols-3 gap-2">{([1, 2, 3] as const).map((tier) => <button key={tier} type="button" onClick={() => setSubscriptionTier(tier)} className={`rounded-lg border px-2 py-2 text-left transition ${subscriptionTier === tier ? 'border-primary bg-primary/15 text-white' : 'border-white/[0.1] bg-white/[0.03] text-white/55 hover:border-white/25 hover:text-white'}`}><span className="block text-[10px] font-black uppercase tracking-wider">Tier {tier}</span><span className="mt-1 block text-[10px] text-white/45">Exact crypto quote</span></button>)}</div><Button type="button" onClick={handleCryptoSubscription} disabled={createCryptoSubscription.isPending} className="mt-3 h-10 w-full rounded-xl font-black">{createCryptoSubscription.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Heart className="mr-2 h-4 w-4" /> Subscribe with crypto</>}</Button></section>
              <label className="mt-3 block text-xs font-bold text-white/55">Optional message<input value={supportMessage} onChange={event => setSupportMessage(event.target.value)} maxLength={500} placeholder="Send a note with your support" className="mt-1.5 h-10 w-full rounded-xl border border-white/[0.1] bg-black/30 px-3 text-sm text-white outline-none focus:border-primary/60" /></label>
              <p className="mt-3 text-[11px] leading-relaxed text-white/42">{supportSource === 'wallet' ? 'Kryv Wallet support debits only your confirmed crypto balance and writes matching customer, creator, and platform ledger movements in one completed transaction.' : 'A creator balance changes only after Kryv verifies a signed settlement confirmation. No wallet private key or seed phrase is requested by Kryv.'}</p>
              {cryptoCheckout && (
                <section className="mt-4 overflow-hidden rounded-2xl border border-primary/30 bg-black/35 p-4 sm:p-5" aria-label="Crypto payment instructions">
                  <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-black text-white">Complete your Kryv crypto checkout</p><p className="mt-1 text-xs leading-relaxed text-white/45">Scan the QR code or send the exact amount below. Kryv confirms payment only after network confirmation.</p></div><button type="button" onClick={() => setCryptoCheckout(null)} className="rounded-lg p-1 text-white/35 transition hover:bg-white/[0.08] hover:text-white" aria-label="Close payment instructions"><X className="h-4 w-4" /></button></div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)]"><div className="mx-auto rounded-xl bg-white p-2"><img src={cryptoCheckout.qrCodeDataUrl} alt="Crypto payment QR code" className="h-40 w-40 sm:h-44 sm:w-44" /></div><div className="min-w-0 space-y-3"><div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3"><p className="text-[10px] font-black uppercase tracking-wider text-white/35">Send exactly</p><p className="mt-1 break-all font-mono text-sm font-bold text-primary">{cryptoCheckout.invoiceTotal} {cryptoCheckout.selectedCurrency || supportCoin}</p>{cryptoCheckout.invoiceCommission && <p className="mt-1 text-[11px] text-white/40">Includes the separately disclosed client-borne checkout fee of {cryptoCheckout.invoiceCommission} {cryptoCheckout.selectedCurrency || supportCoin}. The creator share is calculated from the confirmed crypto subtotal, not this fee.</p>}</div><div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3"><p className="text-[10px] font-black uppercase tracking-wider text-white/35">Payment address</p><p className="mt-1 break-all font-mono text-xs text-white/75">{cryptoCheckout.paymentAddress}</p><button type="button" onClick={() => { navigator.clipboard.writeText(cryptoCheckout.paymentAddress); toast({ title: 'Payment address copied' }); }} className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:text-white"><Copy className="h-3.5 w-3.5" /> Copy address</button></div><Button type="button" variant="secondary" onClick={() => window.open(cryptoCheckout.invoiceUrl, '_blank', 'noopener,noreferrer')} className="w-full border border-white/10 text-white hover:text-white">Open secure checkout in a new tab</Button></div></div>
                </section>
              )}
              </section>
            </DialogContent>
          </Dialog>

          <Dialog open={channelReportOpen} onOpenChange={setChannelReportOpen}>
            <DialogContent className="w-[min(30rem,calc(100vw-2rem))] border-white/10 bg-[#11131a] p-5 shadow-2xl">
              <DialogTitle className="text-base font-black text-white">Report {channel.displayName}</DialogTitle>
              <DialogDescription className="mt-1 text-xs leading-relaxed text-white/45">Reports are sent to Kryv’s safety review queue. Use chat-message flags for a specific chat message.</DialogDescription>
              <div className="mt-4 grid grid-cols-2 gap-2">{([{ key: 'harassment', label: 'Harassment' }, { key: 'hate_or_harm', label: 'Hate / harm' }, { key: 'spam_or_scam', label: 'Spam / scam' }, { key: 'sexual_content', label: 'Sexual content' }, { key: 'violence_or_threat', label: 'Violence / threat' }, { key: 'other', label: 'Other' }] as const).map((option) => <button key={option.key} type="button" onClick={() => setChannelReportReason(option.key)} className={`rounded-lg border px-3 py-2 text-left text-xs font-bold transition ${channelReportReason === option.key ? 'border-red-300/50 bg-red-400/10 text-red-100' : 'border-white/[0.1] bg-black/20 text-white/60 hover:border-white/25 hover:text-white'}`}>{option.label}</button>)}</div>
              <label className="mt-4 block text-xs font-bold text-white/60">Optional context<textarea value={channelReportDetails} onChange={(event) => setChannelReportDetails(event.target.value)} maxLength={1000} placeholder="Tell the review team what happened" className="mt-1.5 min-h-24 w-full resize-y rounded-xl border border-white/[0.1] bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-red-300/50" /></label>
              <div className="mt-4 flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setChannelReportOpen(false)} className="border border-white/[0.1] text-white/75">Cancel</Button><Button type="button" onClick={handleChannelReport} disabled={isSubmittingChannelReport} className="bg-red-500 text-white hover:bg-red-400">{isSubmittingChannelReport ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Flag className="mr-2 h-4 w-4" />Send report</>}</Button></div>
            </DialogContent>
          </Dialog>

          <section className="mt-6 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 sm:mt-7 sm:p-5" aria-labelledby="channel-about">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-2 text-primary"><Megaphone className="h-4 w-4" /><p className="text-[10px] font-black uppercase tracking-[0.18em]">Channel identity</p></div><h2 id="channel-about" className="mt-1 text-lg font-black text-white">About {channel.displayName}</h2></div><div className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.1] bg-black/20 px-2.5 py-1 text-[10px] font-bold text-white/50"><Tag className="h-3 w-3 text-primary" />{channel.categoryName || 'Kryv Live'}</div></div>
            <p className="mt-4 max-w-4xl text-sm leading-relaxed text-white/60">{channel.description || `${channel.displayName} has not added an About section yet. Creator bio, official destinations, and featured promotions can be managed from Creator Dashboard settings.`}</p>
            {promotionLinks.length > 0 && <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{promotionLinks.map(({ label, detail, href, Icon }) => <a key={label} href={href} target="_blank" rel="noreferrer" className="group flex min-h-24 flex-col justify-between rounded-xl border border-white/[0.08] bg-black/20 p-3.5 transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/[0.07]"><div className="flex items-center justify-between gap-3"><div className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary"><Icon className="h-4 w-4" /></div><ExternalLink className="h-3.5 w-3.5 text-white/30 transition group-hover:text-primary" /></div><div className="mt-4"><p className="text-sm font-black text-white">{label}</p><p className="mt-0.5 text-[11px] leading-relaxed text-white/45">{detail}</p></div></a>)}</div>}
            <div className="mt-5 rounded-xl border border-primary/20 bg-primary/[0.045] p-3.5"><div className="flex items-start gap-2.5"><Wallet className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><p className="text-xs leading-relaxed text-white/55"><span className="font-black text-white/80">Crypto support integrity.</span> Support settles only after a signed provider confirmation. Eligible creator revenue is recorded as a 95% creator balance; Kryv’s 5% platform share and any client-borne provider checkout commission remain separate, auditable movements. USD is a reference quote only.</p></div></div>
          </section>

          {(engagement?.pointsEnabled || engagement?.activePoll || engagement?.activePrediction) && (
            <section className="mt-6 grid grid-cols-1 xl:grid-cols-3 gap-3 sm:gap-4">
              {engagement.pointsEnabled && (
                <div className="rounded-xl border border-amber-300/20 bg-amber-400/[0.06] p-4">
                  <div className="flex items-center gap-2"><Trophy className="w-4 h-4 text-amber-300" /><h3 className="font-black text-sm text-white">Channel Points</h3></div>
                  <p className="mt-2 text-xs text-white/45">{isSignedIn ? `${(engagement.pointsBalance ?? 0).toLocaleString()} points available` : 'Sign in to earn points while watching live.'}</p>
                  <Button size="sm" onClick={() => handleEngagementAction({ action: 'claim_points' })} disabled={!isSignedIn || engagementAction.isPending || !channel.isLive} className="mt-3 w-full bg-amber-300 text-black hover:bg-amber-200 font-black text-xs">Claim points</Button>
                </div>
              )}
              {engagement.activePoll && (
                <div className="rounded-xl border border-primary/25 bg-primary/[0.06] p-4">
                  <div className="flex items-center gap-2"><Vote className="w-4 h-4 text-primary" /><h3 className="font-black text-sm text-white truncate">{engagement.activePoll.title}</h3></div>
                  <div className="mt-3 space-y-2">{engagement.activePoll.choices.map((choice) => <button key={choice.id} type="button" onClick={() => handleEngagementAction({ action: 'vote_poll', pollId: engagement.activePoll?.id, choiceId: choice.id })} disabled={!isSignedIn || engagementAction.isPending} className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-left text-xs font-bold text-white/75 hover:border-primary/60 hover:text-white disabled:opacity-50 flex justify-between gap-2"><span className="truncate">{choice.title}</span><span className="text-white/35">{choice.votes}</span></button>)}</div>
                </div>
              )}
              {engagement.activePrediction && (
                <div className="rounded-xl border border-fuchsia-300/20 bg-fuchsia-400/[0.05] p-4">
                  <div className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-fuchsia-300" /><h3 className="font-black text-sm text-white truncate">{engagement.activePrediction.title}</h3></div>
                  <p className="mt-2 text-[11px] text-white/40">Pick an outcome with 10 channel points.</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">{engagement.activePrediction.outcomes.map((outcome) => <button key={outcome.id} type="button" onClick={() => handleEngagementAction({ action: 'enter_prediction', predictionId: engagement.activePrediction?.id, outcomeId: outcome.id, channelPoints: 10 })} disabled={!isSignedIn || engagementAction.isPending || engagement.activePrediction.status !== 'active'} className="rounded-lg border border-white/10 bg-black/20 px-2 py-2 text-xs font-bold text-white/75 hover:border-fuchsia-300/60 hover:text-white disabled:opacity-50 truncate">{outcome.title}</button>)}</div>
                </div>
              )}
            </section>
          )}

        </div>
      </div>

      {/* Chat Sidebar - Mobile: bottom sheet, Desktop: right sidebar */}
      <div className="w-full lg:w-80 xl:w-96 border-t lg:border-t-0 lg:border-l border-white/10 bg-black/40 backdrop-blur flex flex-col h-[45dvh] sm:h-[50dvh] lg:h-auto shrink-0 overflow-hidden">
        <div className="p-2 sm:p-4 border-b border-white/10 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-display font-bold text-white text-sm sm:text-base">Stream Chat</h3>
            {(chatSettings?.slowModeSeconds || chatSettings?.followersOnly) ? (
              <p className="text-[10px] text-white/40 mt-0.5 truncate">
                {chatSettings.followersOnly ? 'Followers only' : ''}{chatSettings.followersOnly && chatSettings.slowModeSeconds ? ' · ' : ''}{chatSettings.slowModeSeconds ? `${chatSettings.slowModeSeconds}s slow mode` : ''}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-2 shrink-0"><span className={`rounded-full border px-2 py-1 text-[8px] font-black uppercase tracking-wider ${realtimeStatus === 'connected' ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200' : realtimeStatus === 'connecting' ? 'border-primary/25 bg-primary/10 text-primary' : 'border-white/[0.1] bg-white/[0.03] text-white/40'}`}>{realtimeStatus === 'connected' ? 'Live relay' : realtimeStatus === 'connecting' ? 'Connecting' : 'REST sync'}</span>{channel.isOwner ? <Shield className="w-4 h-4 text-primary" /> : <Users className="w-4 h-4 text-muted-foreground" />}</div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 sm:p-4 space-y-3 sm:space-y-4" ref={chatScrollRef}>
          {messages?.map((msg) => (
            <div key={msg.id} className="text-xs sm:text-sm flex flex-col gap-0.5 group">
              <div className="flex items-center gap-1 min-w-0">
                {msg.username.toLowerCase().includes('fano') && (
                  <GoldenDBadge className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                )}
                <span className="font-bold text-primary truncate">{msg.username}</span>
                {channel.isOwner && Number(msg.userId) !== Number(channel.ownerUserId) && (
                  <div className="ml-auto flex items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button type="button" title="Timeout for 10 minutes" onClick={() => handleModerationAction('timeout', msg)} disabled={moderateMessage.isPending} className="p-1 rounded text-white/35 hover:text-amber-300 hover:bg-amber-400/10 disabled:opacity-40">
                      <Clock3 className="w-3 h-3" />
                    </button>
                    <button type="button" title="Ban from chat" onClick={() => handleModerationAction('ban', msg)} disabled={moderateMessage.isPending} className="p-1 rounded text-white/35 hover:text-red-300 hover:bg-red-400/10 disabled:opacity-40">
                      <Ban className="w-3 h-3" />
                    </button>
                    <button type="button" title="Remove message" onClick={() => handleModerationAction('delete_message', msg)} disabled={moderateMessage.isPending} className="p-1 rounded text-white/35 hover:text-white hover:bg-white/10 disabled:opacity-40">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                )}
                {!channel.isOwner && Number(msg.userId) !== Number(user?.id) && (
                  <button type="button" title="Report message" onClick={() => setReportTarget({ id: msg.id, username: msg.username })} className="ml-auto rounded p-1 text-white/25 opacity-100 transition-colors hover:bg-red-400/10 hover:text-red-300 sm:opacity-0 sm:group-hover:opacity-100"><Flag className="h-3 w-3" /></button>
                )}
              </div>
              <span className="text-white/90 break-words text-xs sm:text-sm">{msg.message}</span>
              {reportTarget?.id === msg.id && (
                <div className="mt-2 rounded-lg border border-red-300/15 bg-red-400/[0.06] p-2.5"><div className="flex items-center justify-between gap-2"><p className="text-[10px] font-black uppercase tracking-wider text-red-100/75">Report {reportTarget.username}&apos;s message</p><button type="button" onClick={() => setReportTarget(null)} className="rounded p-0.5 text-white/35 hover:text-white"><X className="h-3 w-3" /></button></div><p className="mt-1 text-[11px] leading-relaxed text-white/45">Choose the closest reason. Reports are recorded for safety review.</p><div className="mt-2 flex flex-wrap gap-1.5">{([{ key: 'harassment', label: 'Harassment' }, { key: 'hate_or_harm', label: 'Hate / harm' }, { key: 'spam_or_scam', label: 'Spam / scam' }, { key: 'sexual_content', label: 'Sexual' }, { key: 'violence_or_threat', label: 'Threat' }, { key: 'other', label: 'Other' }] as const).map((option) => <button key={option.key} type="button" disabled={createChatReport.isPending} onClick={() => handleReportMessage(option.key)} className="rounded-md border border-white/[0.1] bg-black/20 px-2 py-1 text-[10px] font-bold text-white/70 transition-colors hover:border-red-300/35 hover:text-red-100 disabled:opacity-40">{option.label}</button>)}</div></div>
              )}
            </div>
          ))}
          {(!messages || messages.length === 0) && (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm text-center px-4">
              Welcome to the chat room!
            </div>
          )}
        </div>

        <div className="p-2 sm:p-4 border-t border-white/10 bg-black/20">
          {isSignedIn ? (
            <form onSubmit={handleSendMessage} className="flex gap-1 sm:gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Send a message…"
                maxLength={500}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              />
              <Button
                type="submit"
                size="sm"
                className="shrink-0"
                disabled={!chatInput.trim() || createMessage.isPending}
              >
                <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </Button>
            </form>
          ) : (
            <div className="text-center p-2 sm:p-3 bg-white/5 rounded-lg border border-white/5 space-y-2">
              <p className="text-xs sm:text-sm text-muted-foreground">Sign in to join the chat</p>
              <div className="flex gap-2 justify-center">
                <a href="/sign-in" className="text-[11px] sm:text-xs font-bold text-primary hover:underline">Sign In</a>
                <span className="text-white/20 text-xs">·</span>
                <a href="/sign-up" className="text-[11px] sm:text-xs font-bold text-white/50 hover:text-white hover:underline">Sign Up</a>
              </div>
              <p className="text-[10px] text-white/30">Viewers can watch without signing in</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
