import { useEffect, useRef, useState } from 'react';
import { useParams } from 'wouter';
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
  useCreateWalletTip,
  useCreateClip,
} from '@workspace/api-client-react';
import { useAuthStore } from '@/lib/auth-store';
import { useToast } from '@/hooks/use-toast';
import HlsPlayer from '@/components/video/HlsPlayer';
import { Loader2, Users, Heart, Share2, Send, Shield, Clock3, Ban, Trash2, Trophy, Vote, Sparkles, Wallet, Scissors, Copy, X } from 'lucide-react';
import { GoldenDBadge } from '@/components/brand/BrandIdentity';
import { Button } from '@/components/ui/button';

export default function LiveChannel() {
  const { channelSlugOrId } = useParams<{ channelSlugOrId: string }>();
  const { user } = useAuthStore();
  const isSignedIn = !!user;

  const { data: channel, isLoading, refetch: refetchChannel } = useGetChannelBySlug(channelSlugOrId || '', {
    query: { enabled: !!channelSlugOrId, refetchInterval: 15000 },
  });

  const channelId = channel?.id;

  const { data: messages, refetch: refetchMessages } = useListChannelMessages(channelId!, {
    query: { enabled: !!channelId, refetchInterval: 15000 },
  });
  const { data: chatSettings } = useGetChannelChatSettings(channelId!, {
    query: { enabled: !!channelId, refetchInterval: 10000 },
  });
  const { data: engagement, refetch: refetchEngagement } = useGetChannelEngagement(channelId!, {
    query: { enabled: !!channelId, refetchInterval: 10000 },
  });

  const { toast } = useToast();
  const createMessage = useCreateChannelMessage();
  const follow = useFollowChannel();
  const unfollow = useUnfollowChannel();
  const heartbeat = useChannelHeartbeat();
  const moderateMessage = useCreateChannelModerationAction();
  const engagementAction = useCreateChannelEngagementAction();
  const createCryptoTip = useCreateCryptoTip();
  const createWalletTip = useCreateWalletTip();
  const createClip = useCreateClip();
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [chatInput, setChatInput] = useState('');
  const [liveViewerCount, setLiveViewerCount] = useState<number>(0);
  const [supportOpen, setSupportOpen] = useState(false);
  const [supportAmount, setSupportAmount] = useState('5');
  const [supportCoin, setSupportCoin] = useState<'BTC' | 'LTC' | 'ETH' | 'DOGE'>('BTC');
  const [supportMessage, setSupportMessage] = useState('');
  const [supportSource, setSupportSource] = useState<'invoice' | 'wallet'>('invoice');
  const [cryptoCheckout, setCryptoCheckout] = useState<any | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Event-driven chat and live-state refresh. The websocket only carries server
  // events; REST remains the authority for messages, moderation, and channel state.
  useEffect(() => {
    if (!channelId || typeof window === 'undefined') return;
    const configuredUrl = import.meta.env.VITE_REALTIME_URL?.trim();
    const fallbackUrl = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`;
    const websocketUrl = configuredUrl || fallbackUrl;
    let closed = false;
    let socket: WebSocket | null = null;

    try {
      socket = new WebSocket(websocketUrl, ['kryv.v1']);
      socket.onopen = () => socket?.send(JSON.stringify({ type: 'subscribe', channelId }));
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as { type?: string; channelId?: number };
          if (message.channelId !== channelId) return;
          if (message.type === 'chat.message.created' || message.type === 'chat.message.deleted') refetchMessages();
          if (message.type === 'channel.moderation.updated') refetchMessages();
          if (message.type === 'live.state.updated') refetchChannel();
        } catch {
          // Ignore malformed transport events; the REST fallback keeps state current.
        }
      };
    } catch {
      // Browser WebSocket construction can fail under restrictive network policies.
    }

    return () => {
      closed = true;
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'unsubscribe', channelId }));
      }
      if (!closed || socket) socket?.close();
    };
  }, [channelId, refetchChannel, refetchMessages]);

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
        window.location.assign(checkout.invoiceUrl);
      },
      onError: (err: any) => toast({ title: 'Crypto support is unavailable', description: err?.body?.error || err?.message || 'The creator invoice could not be started. Please try again later.', variant: 'destructive' }),
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

  const handleFollowToggle = () => {
    if (!isSignedIn) {
      // Prompt user to sign in
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

  return (
    <div className="flex flex-1 min-h-0 flex-col lg:flex-row overflow-hidden bg-background relative z-10">
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Video Player - Responsive */}
        <div className="w-full bg-black aspect-video sm:aspect-video lg:flex-1 relative">
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
        </div>

        <div className="p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="flex gap-4">
              <div className="w-16 h-16 rounded-full bg-white/10 overflow-hidden shrink-0 border border-white/10">
                {channel.avatarUrl ? (
                  <img
                    src={channel.avatarUrl}
                    alt={channel.displayName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-primary/20 text-primary text-2xl font-bold">
                    {channel.displayName[0]}
                  </div>
                )}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white leading-tight mb-1">
                  {channel.streamTitle || `${channel.displayName}'s stream`}
                </h1>
                <div className="flex items-center gap-2 mb-2 text-primary font-medium">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-bold">{channel.displayName}</span>
                    {channel.ownerUserId === '1' && <GoldenDBadge />}
                  </div>
                  {channel.categoryName && (
                    <>
                      <span className="text-muted-foreground font-normal">playing</span>
                      <span>{channel.categoryName}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant={channel.isFollowing ? 'secondary' : 'default'}
                onClick={handleFollowToggle}
                disabled={!isSignedIn || follow.isPending || unfollow.isPending}
                className="font-bold"
              >
                <Heart className={`w-4 h-4 mr-2 ${channel.isFollowing ? 'fill-current' : ''}`} />
                {channel.isFollowing ? 'Following' : 'Follow'}
              </Button>
              {channel.isLive && (
                <Button variant="secondary" onClick={handleLiveClip} disabled={createClip.isPending} className="font-bold border border-white/10 text-white hover:text-white">
                  {createClip.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Scissors className="w-4 h-4 mr-2" />}
                  Clip
                </Button>
              )}
              <Button variant="secondary" onClick={() => setSupportOpen(open => !open)} className="font-bold border border-primary/25 text-primary hover:text-primary">
                <Wallet className="w-4 h-4 mr-2" />
                Support
              </Button>
              <Button variant="secondary" size="icon" aria-label="Share this channel">
                <Share2 className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {supportOpen && (
            <section className="mt-6 rounded-2xl border border-primary/25 bg-primary/[0.055] p-4 sm:p-5">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-2 text-primary"><Wallet className="h-4 w-4" /><h3 className="text-sm font-black">Crypto support</h3></div><p className="mt-1 text-xs leading-relaxed text-white/50">Choose BTC, LTC, ETH, or DOGE. Kryv opens a secure crypto invoice; the USD amount is only a price quote, never a card or fiat checkout.</p></div><span className="rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-white/50">Crypto only</span></div>
              <div className="mt-4 flex rounded-xl border border-white/[0.1] bg-black/25 p-1 text-xs font-bold"><button type="button" onClick={() => setSupportSource('invoice')} className={`flex-1 rounded-lg px-3 py-2 transition ${supportSource === 'invoice' ? 'bg-primary text-primary-foreground' : 'text-white/55 hover:text-white'}`}>Direct crypto</button><button type="button" onClick={() => setSupportSource('wallet')} className={`flex-1 rounded-lg px-3 py-2 transition ${supportSource === 'wallet' ? 'bg-primary text-primary-foreground' : 'text-white/55 hover:text-white'}`}>Kryv Wallet</button></div>
              <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]"><label className="text-xs font-bold text-white/55">{supportSource === 'wallet' ? `Support amount (${supportCoin})` : 'Support amount (USD quote)'}<input type="number" min={supportSource === 'wallet' ? '0.00000001' : '0.01'} step={supportSource === 'wallet' ? '0.00000001' : '0.01'} value={supportAmount} onChange={event => setSupportAmount(event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-white/[0.1] bg-black/30 px-3 text-sm text-white outline-none focus:border-primary/60" /></label><label className="text-xs font-bold text-white/55">Pay with<select value={supportCoin} onChange={event => setSupportCoin(event.target.value as typeof supportCoin)} className="mt-1.5 h-10 w-full rounded-xl border border-white/[0.1] bg-black/30 px-3 text-sm text-white outline-none focus:border-primary/60"><option value="BTC">Bitcoin (BTC)</option><option value="LTC">Litecoin (LTC)</option><option value="ETH">Ethereum (ETH)</option><option value="DOGE">Dogecoin (DOGE)</option></select></label><div className="flex items-end"><Button onClick={supportSource === 'wallet' ? handleWalletSupport : handleCryptoSupport} disabled={supportSource === 'wallet' ? createWalletTip.isPending : createCryptoTip.isPending} className="h-10 w-full rounded-xl font-black">{(supportSource === 'wallet' ? createWalletTip.isPending : createCryptoTip.isPending) ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Wallet className="mr-2 h-4 w-4" /> {supportSource === 'wallet' ? 'Support now' : 'Continue'}</>}</Button></div></div>
              <label className="mt-3 block text-xs font-bold text-white/55">Optional message<input value={supportMessage} onChange={event => setSupportMessage(event.target.value)} maxLength={500} placeholder="Send a note with your support" className="mt-1.5 h-10 w-full rounded-xl border border-white/[0.1] bg-black/30 px-3 text-sm text-white outline-none focus:border-primary/60" /></label>
              <p className="mt-3 text-[11px] leading-relaxed text-white/42">{supportSource === 'wallet' ? 'Kryv Wallet support debits only your confirmed crypto balance and writes matching customer, creator, and platform ledger movements in one completed transaction.' : 'A creator balance changes only after Kryv verifies a signed settlement confirmation. No wallet private key or seed phrase is requested by Kryv.'}</p>
              {cryptoCheckout && (
                <section className="mt-4 overflow-hidden rounded-2xl border border-primary/30 bg-black/35 p-4 sm:p-5" aria-label="Crypto payment instructions">
                  <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-black text-white">Complete your crypto support</p><p className="mt-1 text-xs leading-relaxed text-white/45">Scan the QR code or send the exact amount below. Kryv confirms payment only after network confirmation.</p></div><button type="button" onClick={() => setCryptoCheckout(null)} className="rounded-lg p-1 text-white/35 transition hover:bg-white/[0.08] hover:text-white" aria-label="Close payment instructions"><X className="h-4 w-4" /></button></div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)]"><div className="mx-auto rounded-xl bg-white p-2"><img src={cryptoCheckout.qrCodeDataUrl} alt="Crypto payment QR code" className="h-40 w-40 sm:h-44 sm:w-44" /></div><div className="min-w-0 space-y-3"><div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3"><p className="text-[10px] font-black uppercase tracking-wider text-white/35">Send exactly</p><p className="mt-1 break-all font-mono text-sm font-bold text-primary">{cryptoCheckout.invoiceTotal} {cryptoCheckout.selectedCurrency || supportCoin}</p>{cryptoCheckout.invoiceCommission && <p className="mt-1 text-[11px] text-white/40">Includes the provider&apos;s client-borne checkout fee of {cryptoCheckout.invoiceCommission} {cryptoCheckout.selectedCurrency || supportCoin}.</p>}</div><div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3"><p className="text-[10px] font-black uppercase tracking-wider text-white/35">Payment address</p><p className="mt-1 break-all font-mono text-xs text-white/75">{cryptoCheckout.paymentAddress}</p><button type="button" onClick={() => { navigator.clipboard.writeText(cryptoCheckout.paymentAddress); toast({ title: 'Payment address copied' }); }} className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:text-white"><Copy className="h-3.5 w-3.5" /> Copy address</button></div><Button type="button" variant="secondary" onClick={() => window.location.assign(cryptoCheckout.invoiceUrl)} className="w-full border border-white/10 text-white hover:text-white">Open secure checkout</Button></div></div>
                </section>
              )}
            </section>
          )}

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

          {channel.description && (
            <div className="mt-8 p-6 bg-white/5 border border-white/5 rounded-xl">
              <h3 className="font-bold text-white mb-2">About {channel.displayName}</h3>
              <p className="text-muted-foreground whitespace-pre-wrap">{channel.description}</p>
            </div>
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
          {channel.isOwner ? <Shield className="w-4 h-4 text-primary shrink-0" /> : <Users className="w-4 h-4 text-muted-foreground shrink-0" />}
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
              </div>
              <span className="text-white/90 break-words text-xs sm:text-sm">{msg.message}</span>
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
