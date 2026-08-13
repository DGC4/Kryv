import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'wouter';
import {
  useGetMe,
  useCreateChannel,
  useUpdateChannel,
  useCreateChannelStream,
  useResetChannelStream,
  useGetChannelAnalytics,
  useGetChannelChatSettings,
  useUpdateChannelChatSettings,
  useGetChannelEngagement,
  useCreateChannelEngagementAction,
  useGetNotificationPreferences,
  useUpdateNotificationPreferences,
  useGetActivityObservabilityPreferences,
  useUpdateActivityObservabilityPreferences,
  useListCategories,
  useListVideos,
  useSearchKryv,
  useListChannelMessages,
  useCreateChannelMessage,
  useCreateChannelModerationAction,
  useGetCreatorFinance,
  useSaveCreatorPayoutProfile,
  useCreateCreatorPayoutRequest,
  useGetCreatorAchievements,
} from '@workspace/api-client-react';
import HlsPlayer from '@/components/video/HlsPlayer';
import { Button } from '@/components/ui/button';
import {
  Loader2, Copy, RefreshCcw, Save, Radio, CheckCircle2,
  Monitor, ExternalLink, MapPin, Wifi,
  Settings, BarChart2, Users, MessageSquare, Eye, EyeOff,
  ChevronRight, Lock, Unlock, Globe, Signal, CreditCard,
  Zap, Shield, Crown, Trophy, Vote, Sparkles, Swords, RadioTower, Bell, Wallet,
  Clapperboard, Library, Search, X, LayoutDashboard, Send, Trash2, Clock3, Ban, Camera, Mic, Square,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// ─── Types ───────────────────────────────────────────────────────────────────

interface LocationData {
  ip: string;
  city: string | null;
  region: string | null;
  country: string | null;
  resolved: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function CopyField({ label, value, secret }: { label: string; value: string; secret?: boolean }) {
  const { toast } = useToast();
  const [show, setShow] = useState(!secret);
  const copy = () => {
    navigator.clipboard.writeText(value);
    toast({ title: 'Copied!', description: `${label} copied to clipboard.` });
  };
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">{label}</label>
      <div className="flex gap-2">
        <div className="flex-1 bg-black/60 border border-white/[0.08] rounded-lg px-3 py-2.5 font-mono text-sm text-white/80 overflow-hidden truncate">
          {show ? value : '••••••••••••••••••••••••••••••••'}
        </div>
        {secret && (
          <Button
            variant="ghost" size="icon"
            onClick={() => setShow(s => !s)}
            className="text-white/40 hover:text-white shrink-0 w-9 h-9 border border-white/[0.08] bg-white/[0.03]"
          >
            {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </Button>
        )}
        <Button
          variant="ghost" size="icon"
          onClick={copy}
          className="shrink-0 w-9 h-9 border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.08] text-white/40 hover:text-primary"
        >
          <Copy className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

function formatDuration(seconds: number | null | undefined) {
  const value = Math.max(0, seconds ?? 0);
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function StatusBadge({ live }: { live: boolean }) {
  return live ? (
    <span className="inline-flex items-center gap-1.5 bg-red-500/15 border border-red-500/30 text-red-400 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest animate-pulse">
      <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
      LIVE
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 bg-white/[0.06] border border-white/[0.08] text-white/40 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">
      <span className="w-1.5 h-1.5 rounded-full bg-white/30" />
      OFFLINE
    </span>
  );
}

function SidebarItem({
  icon: Icon, label, active, onClick,
}: { icon: any; label: string; active?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
        active
          ? 'bg-primary/10 text-primary border border-primary/20'
          : 'text-white/50 hover:text-white hover:bg-white/[0.05]'
      }`}
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span>{label}</span>
      {active && <ChevronRight className="w-3.5 h-3.5 ml-auto" />}
    </button>
  );
}

// ─── Location hook ────────────────────────────────────────────────────────────

function useIpLocation() {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [geoGranted, setGeoGranted] = useState<boolean | null>(null);

  useEffect(() => {
    // IP-based lookup from our backend
    fetch('/api/location')
      .then(r => r.json())
      .then((data: LocationData) => setLocation(data))
      .catch(() => {});

    // Browser geolocation (non-blocking, best-effort)
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        () => setGeoGranted(true),
        () => setGeoGranted(false),
        { timeout: 5000 },
      );
    }
  }, []);

  return { location, geoGranted };
}

// ─── Main component ───────────────────────────────────────────────────────────

type DashTab = 'stream' | 'content' | 'settings' | 'engagement' | 'analytics' | 'revenue' | 'achievements';
const DASH_TABS: DashTab[] = ['stream', 'content', 'settings', 'engagement', 'analytics', 'revenue', 'achievements'];

function getInitialDashboardTab(): DashTab {
  const requestedTab = new URLSearchParams(window.location.search).get('tab');
  return DASH_TABS.includes(requestedTab as DashTab) ? requestedTab as DashTab : 'stream';
}

export default function DashboardLive() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<DashTab>(getInitialDashboardTab);
  // FastPix sends stream state by webhook; keep the Stream Manager responsive while
  // avoiding the same high-frequency account request on every dashboard workspace.
  const { data: me, isLoading: meLoading, refetch: refetchMe } = useGetMe({
    query: { refetchInterval: activeTab === 'stream' ? 5000 : 30000 },
  });
  const createChannel = useCreateChannel();
  const updateChannel = useUpdateChannel();
  const createStream = useCreateChannelStream();
  const resetStream = useResetChannelStream();
  const { data: categories } = useListCategories({ kind: 'live_game' });
  const { toast } = useToast();

  const [displayName, setDisplayName] = useState('');
  const [settingsDisplayName, setSettingsDisplayName] = useState('');
  const [settingsDescription, setSettingsDescription] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');
  const [xUrl, setXUrl] = useState('');
  const [chatSlowModeSeconds, setChatSlowModeSeconds] = useState(0);
  const [chatFollowersOnly, setChatFollowersOnly] = useState(false);
  const [streamTitle, setStreamTitle] = useState('');
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined);
  const [credentials, setCredentials] = useState<{ rtmpUrl: string; streamKey: string } | null>(null);
  const [payoutCurrency, setPayoutCurrency] = useState<'BTC' | 'LTC' | 'ETH' | 'DOGE'>('BTC');
  const [payoutAddress, setPayoutAddress] = useState('');
  const [payoutAmount, setPayoutAmount] = useState('');
  const [channelCreated, setChannelCreated] = useState(false);
  const [pollTitle, setPollTitle] = useState('');
  const [pollChoices, setPollChoices] = useState('');
  const [predictionTitle, setPredictionTitle] = useState('');
  const [predictionOutcomes, setPredictionOutcomes] = useState('');
  const [rewardTitle, setRewardTitle] = useState('');
  const [rewardCost, setRewardCost] = useState(100);
  const [destinationSearch, setDestinationSearch] = useState('');
  const [selectedDestination, setSelectedDestination] = useState<{ id: number; displayName: string; isLive: boolean; categoryName: string | null } | null>(null);
  const [notificationPrefs, setNotificationPrefs] = useState({ notifyOnLive: true, notifyOnUpload: true, notifyOnClip: false, emailNotifications: false });
  const [studioChatMessage, setStudioChatMessage] = useState('');
  const [hiddenStudioMessageIds, setHiddenStudioMessageIds] = useState<Set<number>>(() => new Set());
  const browserPreviewRef = useRef<HTMLVideoElement | null>(null);
  const browserPreviewStreamRef = useRef<MediaStream | null>(null);
  const [browserPreviewState, setBrowserPreviewState] = useState<'idle' | 'requesting' | 'ready' | 'blocked'>('idle');
  const [browserPreviewError, setBrowserPreviewError] = useState<string | null>(null);
  // Location is intentionally not collected or required for broadcast setup.
  const location: LocationData | null = null;
  const { data: chatSettings } = useGetChannelChatSettings(me?.channel?.id ?? 0, {
    query: { enabled: Boolean(me?.channel) },
  });
  const updateChatSettings = useUpdateChannelChatSettings();
  const { data: engagement, refetch: refetchEngagement } = useGetChannelEngagement(me?.channel?.id ?? 0, {
    query: { enabled: Boolean(me?.channel && activeTab === 'engagement'), refetchInterval: activeTab === 'engagement' ? 10000 : false },
  });
  const engagementAction = useCreateChannelEngagementAction();
  const creatorFinanceQuery = useGetCreatorFinance({
    query: { enabled: Boolean(me?.channel && (activeTab === 'revenue' || activeTab === 'achievements')), refetchInterval: activeTab === 'revenue' ? 15000 : false },
  });
  const creatorAchievementsQuery = useGetCreatorAchievements({
    query: { enabled: Boolean(me?.channel && activeTab === 'achievements') },
  });
  const saveCreatorPayoutProfile = useSaveCreatorPayoutProfile();
  const createCreatorPayoutRequest = useCreateCreatorPayoutRequest();
  const { data: savedNotificationPrefs } = useGetNotificationPreferences({ query: { enabled: activeTab === 'settings' } });
  const updateNotificationPrefs = useUpdateNotificationPreferences();
  const { data: activityObservabilityPrefs } = useGetActivityObservabilityPreferences({ query: { enabled: activeTab === 'settings' } });
  const updateActivityObservability = useUpdateActivityObservabilityPreferences();
  const { data: analytics, isLoading: analyticsLoading } = useGetChannelAnalytics(
    me?.channel?.id ?? 0,
    {
      query: {
        enabled: Boolean(me?.channel && activeTab === 'analytics'),
        refetchInterval: activeTab === 'analytics' ? 15000 : false,
      },
    },
  );
  const { data: creatorVideos, isLoading: creatorVideosLoading } = useListVideos(
    { channelId: me?.channel?.id },
    { query: { enabled: Boolean(me?.channel && activeTab === 'content') } },
  );
  const { data: studioMessages, refetch: refetchStudioMessages } = useListChannelMessages(
    me?.channel?.id ?? 0,
    { query: { enabled: Boolean(me?.channel && activeTab === 'stream'), refetchInterval: activeTab === 'stream' ? 5000 : false } },
  );
  const createStudioMessage = useCreateChannelMessage();
  const studioModerationAction = useCreateChannelModerationAction();
  const normalizedDestinationSearch = destinationSearch.trim();
  const { data: destinationSearchResults, isFetching: isDestinationSearching } = useSearchKryv(
    { q: normalizedDestinationSearch },
    { query: { enabled: activeTab === 'engagement' && normalizedDestinationSearch.length >= 2 } },
  );

  const stopBrowserPreview = () => {
    browserPreviewStreamRef.current?.getTracks().forEach((track) => track.stop());
    browserPreviewStreamRef.current = null;
    if (browserPreviewRef.current) browserPreviewRef.current.srcObject = null;
    setBrowserPreviewState('idle');
    setBrowserPreviewError(null);
  };

  const startBrowserPreview = async () => {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setBrowserPreviewState('blocked');
      setBrowserPreviewError('Camera and microphone access requires HTTPS and a compatible browser.');
      return;
    }
    stopBrowserPreview();
    setBrowserPreviewState('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30, max: 60 } },
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      browserPreviewStreamRef.current = stream;
      if (browserPreviewRef.current) {
        browserPreviewRef.current.srcObject = stream;
        await browserPreviewRef.current.play().catch(() => undefined);
      }
      setBrowserPreviewState('ready');
    } catch (error) {
      setBrowserPreviewState('blocked');
      const message = error instanceof DOMException && error.name === 'NotAllowedError'
        ? 'Camera or microphone permission was not granted.'
        : 'Kryv could not start a local camera and microphone preview.';
      setBrowserPreviewError(message);
    }
  };

  useEffect(() => () => {
    browserPreviewStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  // Auto-fetch credentials on mount if channel exists
  useEffect(() => {
    if (me?.channel && !credentials && !createStream.isPending) {
      createStream.mutate({ id: me.channel.id }, {
        onSuccess: (data) => setCredentials(data),
        onError: (err) => console.error('Auto-fetch stream key failed:', err)
      });
    }
  }, [me?.channel?.id]);

  useEffect(() => {
    if (me?.channel) {
      setSettingsDisplayName(me.channel.displayName);
      setSettingsDescription(me.channel.description || '');
      setWebsiteUrl(me.channel.websiteUrl || '');
      setYoutubeUrl(me.channel.youtubeUrl || '');
      setInstagramUrl(me.channel.instagramUrl || '');
      setXUrl(me.channel.xUrl || '');
      setStreamTitle(me.channel.streamTitle || '');
      setCategoryId(me.channel.categoryId || undefined);
    }
  }, [me]);

  useEffect(() => {
    if (chatSettings) {
      setChatSlowModeSeconds(chatSettings.slowModeSeconds);
      setChatFollowersOnly(chatSettings.followersOnly);
    }
  }, [chatSettings]);

  useEffect(() => {
    if (savedNotificationPrefs) setNotificationPrefs(savedNotificationPrefs);
  }, [savedNotificationPrefs]);

  useEffect(() => {
    if (!creatorFinanceQuery.data?.payoutPreference) return;
    const preference = creatorFinanceQuery.data.payoutPreference;
    setPayoutCadence(preference.cadence);
    setPayoutMinimumAmount(preference.minimumAmount);
    setPayoutWeekday(preference.weekday ?? 1);
    setPayoutMonthDay(preference.monthDay ?? 1);
  }, [creatorFinanceQuery.data?.payoutPreference]);

  const handleCreateChannel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;
    createChannel.mutate(
      { data: { displayName: displayName.trim() } },
      {
        onSuccess: async (data) => {
          toast({ title: 'Channel created!', description: 'Your channel is ready. Set your stream info and get your key.' });
          setChannelCreated(true);
          // Force a fresh fetch from the server (bypasses stale cache)
          await refetchMe();
          // Navigate to dashboard to show the stream tab immediately
          navigate('/dashboard/live');
        },
        onError: (err: any) => {
          const msg = err?.body?.error || err?.message || 'Failed to create channel';
          // If channel already exists (200 response treated as error by some clients),
          // just refresh to show the dashboard
          if (msg.toLowerCase().includes('already') || (err as any)?.status === 200) {
            refetchMe();
          } else {
            toast({ title: 'Error', description: msg, variant: 'destructive' });
          }
        },
      },
    );
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!me?.channel) return;
    updateChannel.mutate(
      { id: me.channel.id, data: { streamTitle, categoryId } },
      {
        onSuccess: () => toast({ title: 'Stream info saved!' }),
        onError: (err: any) =>
          toast({ title: 'Failed', description: err?.body?.error || err.message, variant: 'destructive' }),
      },
    );
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const channel = me?.channel;
    const nextDisplayName = settingsDisplayName.trim();
    if (!channel || !nextDisplayName) return;

    updateChannel.mutate(
      {
        id: channel.id,
        data: {
          displayName: nextDisplayName,
          description: settingsDescription.trim(),
          websiteUrl: websiteUrl.trim() || null,
          youtubeUrl: youtubeUrl.trim() || null,
          instagramUrl: instagramUrl.trim() || null,
          xUrl: xUrl.trim() || null,
        },
      },
      {
        onSuccess: async () => {
          await refetchMe();
          toast({ title: 'Public profile saved!', description: 'Your channel identity, biography, and verified social links are now updated on Kryv.' });
        },
        onError: (err: any) =>
          toast({ title: 'Unable to save settings', description: err?.body?.error || err?.message || 'Please try again.', variant: 'destructive' }),
      },
    );
  };

  const handleEngagementAction = (data: any, successTitle: string) => {
    const channel = me?.channel;
    if (!channel) return;
    engagementAction.mutate(
      { id: channel.id, data },
      {
        onSuccess: () => {
          toast({ title: successTitle });
          refetchEngagement();
        },
        onError: (err: any) => toast({ title: 'Unable to update engagement', description: err?.body?.error || err?.message || 'Please try again.', variant: 'destructive' }),
      },
    );
  };

  const handleSaveNotificationPreferences = () => {
    updateNotificationPrefs.mutate(
      { data: notificationPrefs },
      {
        onSuccess: () => toast({ title: 'Notification preferences saved' }),
        onError: (err: any) => toast({ title: 'Unable to save notifications', description: err?.body?.error || err?.message || 'Please try again.', variant: 'destructive' }),
      },
    );
  };

  const handleUpdateActivityObservability = (enabled: boolean) => {
    updateActivityObservability.mutate(
      { data: { enabled } },
      {
        onSuccess: () => {
          window.dispatchEvent(new Event('kryv:activity-observability-change'));
          toast({ title: enabled ? 'Activity visibility enabled' : 'Activity visibility disabled', description: enabled ? 'Kryv may share a minimal in-app page category and device class with the owner team. No screen capture or typed content is collected.' : 'Your minimized in-app activity presence has been removed.' });
        },
        onError: (err: any) => toast({ title: 'Preference not saved', description: err?.body?.error || err?.message || 'Please try again.', variant: 'destructive' }),
      },
    );
  };

  const handleSaveChatSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const channel = me?.channel;
    if (!channel) return;

    updateChatSettings.mutate(
      {
        id: channel.id,
        data: { slowModeSeconds: chatSlowModeSeconds, followersOnly: chatFollowersOnly },
      },
      {
        onSuccess: () => toast({ title: 'Chat safety settings saved', description: 'Your chat participation rules are now active.' }),
        onError: (err: any) => toast({ title: 'Unable to update chat settings', description: err?.body?.error || err?.message || 'Please try again.', variant: 'destructive' }),
      },
    );
  };

  const handleStudioChatSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const channel = me?.channel;
    const message = studioChatMessage.trim();
    if (!channel || !message) return;
    createStudioMessage.mutate(
      { id: channel.id, data: { message } },
      {
        onSuccess: () => {
          setStudioChatMessage('');
          refetchStudioMessages();
        },
        onError: (err: any) => toast({ title: 'Unable to send message', description: err?.body?.error || err?.message || 'Please try again.', variant: 'destructive' }),
      },
    );
  };

  const handleStudioModeration = (action: 'delete_message' | 'timeout' | 'ban', message: { id: number; userId: string; username: string }) => {
    const channel = me?.channel;
    const targetUserId = Number(message.userId);
    if (!channel || !Number.isSafeInteger(targetUserId) || targetUserId < 1) return;

    // Remove the message from the creator’s immediate view before the next poll.
    // If the server rejects the audit-protected action, restore it visibly.
    if (action === 'delete_message') {
      setHiddenStudioMessageIds(current => new Set(current).add(message.id));
    }

    studioModerationAction.mutate(
      {
        id: channel.id,
        data: action === 'delete_message'
          ? { action, messageId: message.id }
          : { action, targetUserId, ...(action === 'timeout' ? { durationSeconds: 600 } : {}) },
      },
      {
        onSuccess: () => {
          refetchStudioMessages();
          toast({ title: action === 'delete_message' ? 'Message removed' : action === 'timeout' ? `${message.username} timed out for 10 minutes` : `${message.username} banned from chat` });
        },
        onError: (err: any) => {
          if (action === 'delete_message') {
            setHiddenStudioMessageIds(current => {
              const restored = new Set(current);
              restored.delete(message.id);
              return restored;
            });
          }
          toast({ title: 'Moderation action failed', description: err?.body?.error || err?.message || 'Please try again.', variant: 'destructive' });
        },
      },
    );
  };

  const handleGetKey = useCallback(() => {
    if (!me?.channel) return;
    
    createStream.mutate(
      { id: me.channel.id },
      {
        onSuccess: data => {
          setCredentials(data);
          toast({ title: 'Stream key generated!', description: 'Keep this key private.' });
        },
        onError: (err: any) => {
          const msg = err?.data?.error || err.message || 'Unknown error';
          toast({
            title: 'Stream key failed',
            description: msg,
            variant: 'destructive',
          });
        },
      },
    );
  }, [me?.channel, createStream, toast]);

  const handleRotateKey = useCallback(() => {
    if (!me?.channel) return;
    resetStream.mutate(
      { id: me.channel.id },
      {
        onSuccess: data => {
          setCredentials(data);
          toast({ title: 'Stream key rotated!', description: 'Your old key is now invalid. Update OBS with the new key.' });
        },
        onError: (err: any) => {
          const msg = err?.data?.error || err.message || 'Unknown error';
          toast({ title: 'Failed to rotate key', description: msg, variant: 'destructive' });
        },
      },
    );
  }, [me?.channel, resetStream, toast]);

  const openBroadcastSetup = () => {
    setActiveTab('stream');
    window.setTimeout(() => {
      document.getElementById('broadcast-setup')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  };

  const handleGoLive = () => {
    if (me?.channel?.isLive) {
      navigate(`/live/${me.channel.slug}`);
      return;
    }

    openBroadcastSetup();
    if (!credentials) {
      toast({
        title: 'Generate your stream key first',
        description: 'Kryv opened Stream Credentials. Generate a key there before starting your encoder.',
        variant: 'destructive',
      });
      return;
    }
    toast({
      title: 'Broadcast setup is ready',
      description: 'Kryv opened your RTMP credentials. Start streaming in OBS; your channel publishes automatically when the live signal is active.',
    });
  };

  if (meLoading || (channelCreated && !me?.channel)) {
    return (
      <div className="flex items-center justify-center h-[60vh] flex-col gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        {channelCreated && <p className="text-white/40 text-sm">Setting up your channel…</p>}
      </div>
    );
  }

  const channel = me?.channel;
  const isLive = channel?.isLive ?? false;

  // ── No channel yet: creation screen ──────────────────────────────────────
  if (!channel) {
    return (
      <div className="relative z-10 max-w-2xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 mb-4">
            <Radio className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-black text-white mb-2">Launch Your Channel</h1>
          <p className="text-white/40">Create your channel to start streaming live on Kryv</p>
        </div>

        {/* Location display on creation screen */}
        {location?.resolved && (
          <div className="flex items-center gap-2 justify-center mb-6 text-sm text-white/40">
            <MapPin className="w-3.5 h-3.5 text-primary" />
            <span>
              {[location.city, location.region].filter(Boolean).join(', ')}
              {location.country ? ` · ${location.country}` : ''}
            </span>
            <span className="text-white/20 mx-1">·</span>
            <Globe className="w-3 h-3" />
            <span className="text-xs">Approximate region</span>
          </div>
        )}

        <div className="p-6 border border-white/[0.08] rounded-2xl bg-white/[0.02] backdrop-blur">
          <form onSubmit={handleCreateChannel} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-white/50 uppercase tracking-widest mb-2">
                Channel Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="e.g. FanoDGC Gaming"
                className="w-full bg-black/40 border border-white/[0.10] rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 transition-all"
                required
                maxLength={60}
              />
              <p className="text-xs text-white/30 mt-1.5">This is what viewers see on your channel page.</p>
            </div>
            <Button
              type="submit"
              disabled={createChannel.isPending || !displayName.trim()}
              className="w-full h-12 font-black text-sm bg-primary text-primary-foreground rounded-xl shadow-[0_0_20px_hsl(var(--primary)/0.3)] hover:shadow-[0_0_28px_hsl(var(--primary)/0.45)] transition-all"
            >
              {createChannel.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating…</>
              ) : (
                <><Radio className="w-4 h-4 mr-2" /> Create Channel &amp; Go Live</>
              )}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  // ── Channel exists: full Kick-style dashboard ─────────────────────────────
  return (
    <div className="relative z-10 flex min-h-[calc(100dvh-4rem)]">

      {/* ── Left sidebar ── */}
      <aside className="hidden lg:flex flex-col w-52 shrink-0 border-r border-white/[0.06] bg-black/20 px-3 py-5 gap-1">
        <p className="text-[10px] font-black text-white/25 uppercase tracking-widest px-3 mb-2">Creator</p>
        <SidebarItem icon={LayoutDashboard} label="Stream Manager" active={activeTab === 'stream'} onClick={() => setActiveTab('stream')} />
        <SidebarItem icon={Library} label="Content" active={activeTab === 'content'} onClick={() => setActiveTab('content')} />
        <SidebarItem icon={Sparkles} label="Community" active={activeTab === 'engagement'} onClick={() => setActiveTab('engagement')} />
        <SidebarItem icon={Wallet} label="Revenue & Wallet" active={activeTab === 'revenue'} onClick={() => setActiveTab('revenue')} />
        <SidebarItem icon={Trophy} label="Achievements" active={activeTab === 'achievements'} onClick={() => setActiveTab('achievements')} />
        <SidebarItem icon={BarChart2} label="Analytics" active={activeTab === 'analytics'} onClick={() => setActiveTab('analytics')} />
        <SidebarItem icon={Settings} label="Settings" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />

        {/* Location pill at bottom of sidebar */}
        <div className="mt-auto pt-4 border-t border-white/[0.06]">
          {location?.resolved ? (
            <div className="px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
              <div className="flex items-center gap-1.5 mb-0.5">
                <MapPin className="w-3 h-3 text-primary" />
                <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Location</span>
              </div>
              <p className="text-xs text-white/70 font-medium">
                {[location.city, location.region].filter(Boolean).join(', ') || location.country || 'Unknown'}
              </p>
              <p className="text-[10px] text-white/30 mt-0.5">Approximate region only</p>
            </div>
          ) : (
            <div className="px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
              <div className="flex items-center gap-1.5">
                <Globe className="w-3 h-3 text-white/30" />
                <span className="text-[10px] text-white/30">Location sharing is optional</span>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main content area ── */}
      <div className="min-w-0 flex-1">

        {/* Top bar */}
        <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] bg-black/90 px-4 py-3 backdrop-blur sm:px-5 sm:py-4">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-black text-white sm:text-lg">Creator Dashboard</h1>
            <StatusBadge live={isLive} />
          </div>
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            {location?.resolved && (
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-white/40">
                <MapPin className="w-3 h-3 text-primary" />
                <span>{[location.city, location.region].filter(Boolean).join(', ') || location.country}</span>
              </div>
            )}
            <Link href="/dashboard/watch" className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl border border-white/[0.1] bg-white/[0.03] px-3 text-xs font-black text-white/70 transition hover:border-primary/45 hover:text-primary sm:px-4"><Library className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Watch studio</span></Link>
            <Button
              onClick={handleGoLive}
              className={`h-11 px-3 text-xs font-black transition-all sm:px-5 ${
                credentials
                  ? 'bg-red-600 hover:bg-red-500 text-white shadow-[0_0_16px_rgba(239,68,68,0.4)]'
                  : 'bg-white/[0.06] text-white/40 border border-white/[0.08] cursor-default'
              }`}
            >
              <Radio className="w-3.5 h-3.5 mr-1.5" />
              <span className="sm:hidden">{isLive ? 'View live' : 'Setup'}</span><span className="hidden sm:inline">{isLive ? 'View live channel' : 'Open broadcast setup'}</span>
            </Button>
          </div>
        </div>

        <div className="lg:hidden overflow-x-auto border-b border-white/[0.06] bg-black/35 px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex min-w-max gap-1">
            {([
              { id: 'stream', label: 'Stream', icon: LayoutDashboard },
              { id: 'content', label: 'Content', icon: Library },
              { id: 'engagement', label: 'Community', icon: Sparkles },
              { id: 'revenue', label: 'Wallet', icon: Wallet },
              { id: 'achievements', label: 'Achievements', icon: Trophy },
              { id: 'analytics', label: 'Analytics', icon: BarChart2 },
              { id: 'settings', label: 'Settings', icon: Settings },
            ] as Array<{ id: DashTab; label: string; icon: any }>).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                aria-current={activeTab === id ? 'page' : undefined}
                className={`inline-flex h-11 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-bold transition-colors ${activeTab === id ? 'bg-primary/15 text-primary' : 'text-white/45 hover:bg-white/[0.05] hover:text-white'}`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Stream tab ── */}
        {activeTab === 'stream' && (
          <div className="p-5 grid grid-cols-1 xl:grid-cols-3 gap-5">

            {/* Left: steps */}
            <div className="xl:col-span-2 space-y-4">

              {/* Session stats bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Status',    value: isLive ? 'LIVE' : 'OFFLINE', red: isLive },
                  { label: 'Viewers',   value: String(channel.viewerCount ?? 0) },
                  { label: 'Followers', value: String(channel.followerCount ?? 0) },
                  { label: 'Category',  value: channel.categoryName || '—' },
                ].map(({ label, value, red }) => (
                  <div key={label} className="p-3 rounded-xl border border-white/[0.07] bg-white/[0.02]">
                    <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1">{label}</p>
                    <p className={`text-sm font-black truncate ${red ? 'text-red-400' : 'text-white'}`}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Step 1: Stream info */}
              <div className="p-5 border border-white/[0.07] rounded-2xl bg-white/[0.02]">
                <div className="flex items-center gap-2 mb-4">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${channel.streamTitle ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-primary/20 text-primary border border-primary/30'}`}>
                    {channel.streamTitle ? <CheckCircle2 className="w-3.5 h-3.5" /> : '1'}
                  </div>
                  <h2 className="font-black text-white">Stream Info</h2>
                  {channel.streamTitle && <span className="text-xs text-green-400/70 ml-auto">Saved</span>}
                </div>
                <form onSubmit={handleUpdate} className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1.5">Stream Title</label>
                    <input
                      type="text"
                      value={streamTitle}
                      onChange={e => setStreamTitle(e.target.value)}
                      placeholder="What are you streaming today?"
                      className="w-full bg-black/40 border border-white/[0.08] rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
                      maxLength={140}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1.5">Category</label>
                    <select
                      value={categoryId ?? ''}
                      onChange={e => setCategoryId(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                      className="w-full bg-black/40 border border-white/[0.08] rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-primary/50 transition-all appearance-none"
                    >
                      <option value="">Select a category…</option>
                      {categories?.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                  <Button
                    type="submit"
                    disabled={updateChannel.isPending}
                    size="sm"
                    className="font-bold bg-white/[0.07] border border-white/[0.10] hover:bg-white/[0.12] text-white rounded-xl px-5"
                  >
                    {updateChannel.isPending
                      ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Saving…</>
                      : <><Save className="w-3.5 h-3.5 mr-1.5" /> Save Info</>
                    }
                  </Button>
                </form>
              </div>

              {/* Step 2: Stream credentials */}
              <div id="broadcast-setup" tabIndex={-1} className="scroll-mt-24 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 outline-none focus-visible:ring-2 focus-visible:ring-primary">
                <div className="flex items-center gap-2 mb-4">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${credentials ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-primary/20 text-primary border border-primary/30'}`}>
                    {credentials ? <CheckCircle2 className="w-3.5 h-3.5" /> : '2'}
                  </div>
                  <h2 className="font-black text-white">Stream Credentials (FastPix)</h2>
                  {credentials && (
                    <div className="ml-auto flex items-center gap-3">
                      <Button
                        onClick={handleRotateKey}
                        disabled={resetStream.isPending}
                        size="sm"
                        variant="ghost"
                        className="text-white/30 hover:text-white text-xs h-7 px-2"
                      >
                        {resetStream.isPending
                          ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Rotating…</>
                          : <><RefreshCcw className="w-3 h-3 mr-1" /> Rotate Key</>
                        }
                      </Button>
                    </div>
                  )}
                </div>

                {credentials ? (
                  <div className="space-y-3">
                    <CopyField label="RTMP Server URL" value={credentials.rtmpUrl} />
                    <CopyField label="Stream Key" value={credentials.streamKey} secret />
                    
                    {credentials.streamKey.startsWith('live_') && (
                      <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl flex items-start gap-3">
                        <Unlock className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-yellow-500 uppercase tracking-widest mb-1">Placeholder Key Active</p>
                          <p className="text-[10px] text-yellow-500/60 leading-relaxed">
                            This is a temporary fallback key. To get a real FastPix key, click <strong>Rotate Key</strong> above. 
                            If it fails, check your FastPix credentials in Render.
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2 p-3 bg-red-500/[0.07] border border-red-500/20 rounded-xl">
                      <Lock className="w-3.5 h-3.5 text-red-400 shrink-0" />
                      <p className="text-xs text-red-400/80">Keep your stream key private — anyone with it can broadcast to your channel.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-white/40">Generate your RTMP credentials to connect OBS or any streaming encoder.</p>
                    <Button
                      onClick={handleGetKey}
                      disabled={createStream.isPending}
                      className="font-black bg-primary text-primary-foreground rounded-xl px-6 shadow-[0_0_16px_hsl(var(--primary)/0.3)]"
                    >
                      {createStream.isPending
                        ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating…</>
                        : <><Wifi className="w-4 h-4 mr-2" /> Generate Stream Key</>
                      }
                    </Button>
                  </div>
                )}
              </div>

              <section className="mt-4 overflow-hidden rounded-2xl border border-cyan-300/15 bg-cyan-400/[0.035]">
                <div className="flex flex-col gap-3 border-b border-cyan-200/[0.1] px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0"><div className="flex items-center gap-2"><Camera className="h-4 w-4 text-cyan-200" /><h2 className="text-sm font-black text-white">Browser Studio preflight</h2><span className="rounded-full border border-amber-300/20 bg-amber-300/[0.08] px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-100">Gateway required</span></div><p className="mt-1 text-xs leading-relaxed text-white/45">Check your camera and microphone locally before a future browser broadcast. Kryv does not upload, record, or publish this preview. A managed publishing gateway and owner-approved destination connections are required before any browser stream can go live.</p></div>
                  {browserPreviewState === 'ready' ? <Button type="button" variant="secondary" onClick={stopBrowserPreview} className="shrink-0 border border-red-300/20 text-red-100 hover:text-red-50"><Square className="mr-2 h-3.5 w-3.5 fill-current" /> Stop check</Button> : <Button type="button" onClick={startBrowserPreview} disabled={browserPreviewState === 'requesting'} className="shrink-0 bg-cyan-200 text-black hover:bg-cyan-100">{browserPreviewState === 'requesting' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <><Camera className="mr-2 h-4 w-4" /> Check camera & mic</>}</Button>}
                </div>
                <div className="relative aspect-video bg-black/45"><video ref={browserPreviewRef} muted playsInline className={`h-full w-full object-contain ${browserPreviewState === 'ready' ? 'block' : 'hidden'}`} />{browserPreviewState !== 'ready' && <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center"><div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-200/[0.14] bg-cyan-300/[0.06]"><Camera className="h-5 w-5 text-cyan-100/60" /></div><p className="mt-3 text-sm font-bold text-white/55">Local preview is off</p><p className="mt-1 max-w-md text-xs leading-relaxed text-white/30">Permission is requested only when you choose the camera and microphone check.</p></div>}<div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full border border-white/[0.1] bg-black/60 px-2.5 py-1 text-[10px] font-bold text-white/65"><Mic className="h-3 w-3 text-cyan-200" />{browserPreviewState === 'ready' ? 'Local device preview' : 'No media transmitted'}</div></div>
                {browserPreviewError && <p className="border-t border-red-300/[0.12] bg-red-400/[0.05] px-4 py-3 text-xs text-red-100/80">{browserPreviewError}</p>}
              </section>

            </div>

            {/* Right: preview + OBS guide */}
            <div className="space-y-4">

              {/* Stream preview — shows live HLS feed when active, placeholder when offline */}
              <div className="aspect-video rounded-2xl border border-white/[0.07] bg-black overflow-hidden relative">
                {isLive && channel.fastpixPlaybackId ? (
                  <>
                    <HlsPlayer
                      src={`https://stream.fastpix.com/${channel.fastpixPlaybackId}.m3u8`}
                      autoPlay
                      muted
                      live
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute top-3 left-3 flex items-center gap-2">
                      <StatusBadge live={true} />
                      {(channel.viewerCount ?? 0) > 0 && (
                        <span className="bg-black/70 backdrop-blur text-white text-[10px] font-semibold px-2 py-0.5 rounded flex items-center gap-1">
                          <Users className="w-2.5 h-2.5" />
                          {(channel.viewerCount ?? 0).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-black/40">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.04] to-transparent pointer-events-none" />
                    <Monitor className="w-10 h-10 text-white/20 relative" />
                    <div className="relative text-center">
                      <p className="text-sm font-bold text-white/30">{channel.displayName}</p>
                      <p className="text-xs text-white/20 mt-0.5">Start streaming in OBS to see your preview here</p>
                    </div>
                    <StatusBadge live={false} />
                  </div>
                )}
              </div>

              <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02]">
                <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3">
                  <div className="flex items-center gap-2"><MessageSquare className="h-4 w-4 text-primary" /><h2 className="text-sm font-black text-white">Live chat</h2></div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">Refreshes live</span>
                </div>
                <div className="max-h-60 min-h-36 space-y-3 overflow-y-auto px-4 py-3">
                  {studioMessages?.filter(message => !hiddenStudioMessageIds.has(message.id)).length ? studioMessages.filter(message => !hiddenStudioMessageIds.has(message.id)).map((message) => (
                    <div key={message.id} className="group flex gap-2.5">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-black text-primary">{message.username.slice(0, 1).toUpperCase()}</div>
                      <div className="min-w-0 flex-1"><div className="flex items-baseline gap-2"><span className="truncate text-xs font-bold text-white">{message.username}</span><span className="text-[10px] text-white/25">{new Date(message.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span></div><p className="mt-0.5 break-words text-xs leading-relaxed text-white/65">{message.message}</p></div>
                      {String(message.userId) !== String(me?.id) && <div className="flex shrink-0 gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100"><button type="button" title="Remove message" aria-label={`Remove ${message.username}'s message`} onClick={() => handleStudioModeration('delete_message', message)} disabled={studioModerationAction.isPending} className="rounded p-1 text-white/25 hover:bg-white/[0.07] hover:text-white"><Trash2 className="h-3 w-3" /></button><button type="button" title="Timeout for 10 minutes" aria-label={`Timeout ${message.username} for 10 minutes`} onClick={() => handleStudioModeration('timeout', message)} disabled={studioModerationAction.isPending} className="rounded p-1 text-white/25 hover:bg-amber-400/10 hover:text-amber-200"><Clock3 className="h-3 w-3" /></button><button type="button" title="Ban from channel" aria-label={`Ban ${message.username} from channel`} onClick={() => handleStudioModeration('ban', message)} disabled={studioModerationAction.isPending} className="rounded p-1 text-white/25 hover:bg-red-400/10 hover:text-red-300"><Ban className="h-3 w-3" /></button></div>}
                    </div>
                  )) : <div className="flex min-h-28 flex-col items-center justify-center text-center"><MessageSquare className="h-6 w-6 text-white/15" /><p className="mt-2 text-xs font-medium text-white/35">Your live chat will appear here.</p></div>}
                </div>
                <form onSubmit={handleStudioChatSubmit} className="flex gap-2 border-t border-white/[0.07] p-3">
                  <input value={studioChatMessage} onChange={(event) => setStudioChatMessage(event.target.value)} maxLength={500} placeholder="Send a message as the channel owner" className="min-w-0 flex-1 rounded-xl border border-white/[0.1] bg-black/25 px-3 py-2 text-xs text-white outline-none transition-colors placeholder:text-white/25 focus:border-primary/60" />
                  <Button type="submit" size="icon" disabled={createStudioMessage.isPending || !studioChatMessage.trim()} className="h-9 w-9 shrink-0 rounded-xl"><Send className="h-3.5 w-3.5" /></Button>
                </form>
              </div>

              {/* OBS Setup guide */}
              <div className="p-5 border border-white/[0.07] rounded-2xl bg-white/[0.02]">
                <div className="flex items-center gap-2 mb-4">
                  <Monitor className="w-4 h-4 text-primary" />
                  <h2 className="font-black text-white text-sm">OBS Setup Guide</h2>
                </div>
                <div className="space-y-4 text-xs">
                  {([
                    {
                      n: '1', title: 'Download OBS Studio',
                      body: <span>Free &amp; open-source. <a href="https://obsproject.com" target="_blank" rel="noopener" className="text-primary hover:underline inline-flex items-center gap-0.5">obsproject.com <ExternalLink className="w-2.5 h-2.5" /></a></span>,
                    },
                    { n: '2', title: 'Settings → Stream', body: <span>Open OBS → <span className="font-mono bg-white/[0.06] px-1 rounded">Settings → Stream</span></span> },
                    { n: '3', title: 'Select Custom RTMP', body: <span>Set Service to <span className="font-mono bg-white/[0.06] px-1 rounded">Custom…</span></span> },
                    {
                      n: '4', title: 'Enter credentials',
                      body: (
                        <div className="space-y-1.5 mt-1">
                          <div className="bg-black/50 border border-white/[0.06] rounded-lg p-2 font-mono">
	                            <p className="text-white/25 text-[9px] uppercase tracking-widest mb-0.5">Server</p>
	                            <p className="text-white/70 text-[11px] break-all">{credentials?.rtmpUrl || 'rtmps://live.fastpix.io:443/live'}</p>
	                          </div>
                          <div className="bg-black/50 border border-white/[0.06] rounded-lg p-2 font-mono">
                            <p className="text-white/25 text-[9px] uppercase tracking-widest mb-0.5">Stream Key</p>
                            <p className="text-white/70 text-[11px]">{credentials?.streamKey ? '••••••••••••' : '(generate above)'}</p>
                          </div>
                        </div>
                      ),
                    },
                    { n: '✓', title: 'Hit "Start Streaming"', body: <span>Kryv automatically detects the live signal, refreshes this preview, and publishes your channel when the broadcast is active.</span>, green: true },
                  ] as Array<{ n: string; title: string; body: React.ReactNode; green?: boolean }>).map(({ n, title, body, green }) => (
                    <div key={n} className="flex gap-3">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5 ${green ? 'bg-green-500/15 text-green-400 border border-green-500/20' : 'bg-primary/10 text-primary border border-primary/20'}`}>
                        {n}
                      </div>
                      <div>
                        <p className="font-bold text-white mb-0.5">{title}</p>
                        <div className="text-white/40">{body}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 p-3 bg-primary/[0.06] border border-primary/15 rounded-xl">
                  <p className="text-[11px] text-white/50">
                    <span className="text-primary font-bold">Recommended: </span>
                    x264 or NVENC · 3000–6000 kbps · Keyframe 2s · 1080p/60fps
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Content tab ── */}
        {activeTab === 'content' && (
          <div className="max-w-6xl p-5">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Creator library</p>
                <h2 className="mt-1 text-xl font-black text-white">Your published and processing video</h2>
                <p className="mt-1 text-xs text-white/40">This library reflects your channel’s real Kryv Watch assets and FastPix processing status.</p>
              </div>
              <Button type="button" variant="secondary" onClick={() => navigate('/watch')} className="w-full sm:w-auto">
                <ExternalLink className="mr-2 h-4 w-4" /> View Watch
              </Button>
            </div>

            {creatorVideosLoading ? (
              <div className="flex min-h-48 items-center justify-center rounded-2xl border border-white/[0.07] bg-white/[0.02]">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : creatorVideos?.length ? (
              <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02]">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-b border-white/[0.07] px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white/35 sm:grid-cols-[minmax(0,1.5fr)_0.75fr_0.7fr_0.45fr]">
                  <span>Title</span><span className="hidden sm:block">Status</span><span className="hidden sm:block">Published</span><span className="text-right">Views</span>
                </div>
                <div className="divide-y divide-white/[0.06]">
                  {creatorVideos.map((video) => {
                    const statusClass = video.uploadStatus === 'ready' ? 'bg-emerald-400/10 text-emerald-300 border-emerald-400/20' : video.uploadStatus === 'errored' ? 'bg-red-400/10 text-red-300 border-red-400/20' : 'bg-amber-300/10 text-amber-200 border-amber-300/20';
                    return (
                      <div key={video.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 px-4 py-4 sm:grid-cols-[minmax(0,1.5fr)_0.75fr_0.7fr_0.45fr] sm:items-center">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-black/30 text-primary"><Clapperboard className="h-4 w-4" /></div>
                          <div className="min-w-0"><p className="truncate text-sm font-bold text-white">{video.title}</p><p className="mt-0.5 text-[11px] text-white/35">{video.contentType === 'original' ? 'Cinema original' : 'Kryv Watch'} · {video.durationSeconds ? formatDuration(video.durationSeconds) : 'Processing duration'}</p></div>
                        </div>
                        <div className="hidden sm:block"><span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-wider ${statusClass}`}>{video.uploadStatus}</span></div>
                        <span className="hidden text-xs text-white/40 sm:block">{new Date(video.createdAt).toLocaleDateString()}</span>
                        <span className="text-right text-sm font-black text-white">{video.viewCount.toLocaleString()}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/[0.12] bg-white/[0.015] px-6 py-14 text-center">
                <Clapperboard className="mx-auto h-9 w-9 text-white/20" />
                <p className="mt-4 text-sm font-bold text-white/65">Your videos will appear here after they are created for this channel.</p>
                <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-white/35">Kryv shows the authoritative processing state, so you know whether an asset is still waiting, processing, ready, or requires attention.</p>
              </div>
            )}
          </div>
        )}

        {/* ── Settings tab ── */}
        {activeTab === 'settings' && (
          <div className="p-5 max-w-5xl">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Profile Settings */}
              <div>
                <h2 className="text-lg font-black text-white mb-5 flex items-center gap-2">
                  <Settings className="w-5 h-5 text-primary" />
                  Channel Settings
                </h2>
                <form onSubmit={handleSaveSettings} className="p-5 border border-white/[0.07] rounded-2xl bg-white/[0.02] space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1.5">Channel Name</label>
                    <input
                      type="text"
                      value={settingsDisplayName}
                      onChange={e => setSettingsDisplayName(e.target.value)}
                      className="w-full bg-black/40 border border-white/[0.08] rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-primary/50 transition-all"
                      maxLength={60}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1.5">Channel URL</label>
                    <div className="flex items-center gap-2 bg-black/40 border border-white/[0.08] rounded-xl px-4 py-2.5">
                      <span className="text-white/30 text-sm">kryv.tv/live/</span>
                      <span className="text-white text-sm font-mono">{channel.slug}</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1.5">Channel biography</label>
                    <textarea
                      value={settingsDescription}
                      onChange={e => setSettingsDescription(e.target.value)}
                      placeholder="Tell viewers what your channel is about."
                      maxLength={500}
                      rows={4}
                      className="w-full resize-y bg-black/40 border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-primary/50 transition-all"
                    />
                    <p className="mt-1.5 text-right text-[10px] font-medium text-white/30">{settingsDescription.length}/500</p>
                  </div>
                  <div className="border-t border-white/[0.07] pt-4">
                    <div className="mb-3"><p className="text-sm font-bold text-white">Official links</p><p className="mt-1 text-xs leading-relaxed text-white/35">Only HTTPS links are accepted. YouTube, Instagram, and X links must point to their official domains.</p></div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest">Website<input type="url" value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)} placeholder="https://your-site.com" autoComplete="url" className="mt-1.5 w-full bg-black/40 border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm normal-case tracking-normal text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50" /></label>
                      <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest">YouTube<input type="url" value={youtubeUrl} onChange={e => setYoutubeUrl(e.target.value)} placeholder="https://youtube.com/@channel" autoComplete="url" className="mt-1.5 w-full bg-black/40 border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm normal-case tracking-normal text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50" /></label>
                      <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest">Instagram<input type="url" value={instagramUrl} onChange={e => setInstagramUrl(e.target.value)} placeholder="https://instagram.com/handle" autoComplete="url" className="mt-1.5 w-full bg-black/40 border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm normal-case tracking-normal text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50" /></label>
                      <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest">X / Twitter<input type="url" value={xUrl} onChange={e => setXUrl(e.target.value)} placeholder="https://x.com/handle" autoComplete="url" className="mt-1.5 w-full bg-black/40 border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm normal-case tracking-normal text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50" /></label>
                    </div>
                  </div>
                  <Button
                    type="submit"
                    disabled={updateChannel.isPending || !settingsDisplayName.trim()}
                    className="font-bold bg-primary text-primary-foreground rounded-xl px-6"
                  >
                    {updateChannel.isPending
                      ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</>
                      : <><Save className="w-4 h-4 mr-2" /> Save Settings</>
                    }
                  </Button>
                </form>
              </div>

              <div>
                <h2 className="text-lg font-black text-white mb-5 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary" />
                  Chat Safety
                </h2>
                <form onSubmit={handleSaveChatSettings} className="p-5 border border-white/[0.07] rounded-2xl bg-white/[0.02] space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-white">Followers-only chat</p>
                      <p className="text-xs text-white/35 mt-1">Only viewers who follow your channel can post messages.</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-label="Followers-only chat"
                      aria-checked={chatFollowersOnly}
                      onClick={() => setChatFollowersOnly(value => !value)}
                      className={`group relative inline-flex h-8 w-[72px] shrink-0 items-center rounded-full border p-1 shadow-inner transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[#101116] ${chatFollowersOnly ? 'border-primary/80 bg-primary/90' : 'border-white/15 bg-black/35 hover:border-white/30'}`}
                    >
                      <span className={`absolute inset-y-0 left-0 flex items-center pl-2 text-[9px] font-black uppercase tracking-[0.12em] transition-opacity ${chatFollowersOnly ? 'opacity-0' : 'text-white/45 opacity-100'}`}>Off</span>
                      <span className={`absolute inset-y-0 right-0 flex items-center pr-2 text-[9px] font-black uppercase tracking-[0.12em] transition-opacity ${chatFollowersOnly ? 'text-primary-foreground opacity-100' : 'opacity-0'}`}>On</span>
                      <span className={`relative z-10 h-6 w-6 rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.38)] transition-transform duration-200 ${chatFollowersOnly ? 'translate-x-10' : 'translate-x-0'}`} />
                    </button>
                  </div>
                  <div className="pt-4 border-t border-white/[0.07]">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                      <div>
                        <p className="text-sm font-bold text-white">Slow mode</p>
                        <p className="text-xs text-white/35 mt-1">Set a wait time between messages for non-moderators.</p>
                      </div>
                      <span className="text-sm font-black text-primary">{chatSlowModeSeconds ? `${chatSlowModeSeconds}s` : 'Off'}</span>
                    </div>
                    <input
                      aria-label="Chat slow mode in seconds"
                      type="range"
                      min={0}
                      max={300}
                      step={5}
                      value={chatSlowModeSeconds}
                      onChange={e => setChatSlowModeSeconds(Number(e.target.value))}
                      className="w-full accent-primary"
                    />
                    <div className="flex justify-between mt-1 text-[10px] font-bold text-white/25 uppercase tracking-widest"><span>Off</span><span>5 min</span></div>
                  </div>
                  <Button type="submit" disabled={updateChatSettings.isPending} className="font-bold bg-primary text-primary-foreground rounded-xl px-6">
                    {updateChatSettings.isPending
                      ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</>
                      : <><Shield className="w-4 h-4 mr-2" /> Save Chat Settings</>
                    }
                  </Button>
                </form>
              </div>

              <div>
                <h2 className="text-lg font-black text-white mb-5 flex items-center gap-2"><Bell className="w-5 h-5 text-primary" />Notification Preferences</h2>
                <div className="p-5 border border-white/[0.07] rounded-2xl bg-white/[0.02] space-y-3">
                  <p className="text-xs leading-relaxed text-white/40">These settings control which future Kryv alerts you allow. Email delivery remains off until you explicitly enable it.</p>
                  {[
                    { key: 'notifyOnLive' as const, title: 'Followed creators go live', detail: 'Receive in-app alerts when a channel you follow begins streaming.' },
                    { key: 'notifyOnUpload' as const, title: 'New uploads', detail: 'Receive in-app alerts for fresh videos from followed creators.' },
                    { key: 'notifyOnClip' as const, title: 'New clips', detail: 'Receive in-app alerts when a followed creator publishes a clip.' },
                    { key: 'emailNotifications' as const, title: 'Email delivery', detail: 'Permit email notifications when Kryv delivery is configured.' },
                  ].map(({ key, title, detail }) => <label key={key} className="flex items-start justify-between gap-4 rounded-xl border border-white/[0.06] bg-black/15 p-3 cursor-pointer"><span><span className="block text-sm font-bold text-white">{title}</span><span className="mt-0.5 block text-xs text-white/40">{detail}</span></span><input type="checkbox" checked={notificationPrefs[key]} onChange={e => setNotificationPrefs(current => ({ ...current, [key]: e.target.checked }))} className="mt-1 h-4 w-4 shrink-0 accent-primary" /></label>)}
                  <Button type="button" onClick={handleSaveNotificationPreferences} disabled={updateNotificationPrefs.isPending} className="mt-1 font-bold rounded-xl">{updateNotificationPrefs.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</> : <><Bell className="w-4 h-4 mr-2" /> Save notification settings</>}</Button>
                </div>
              </div>

              <div>
                <h2 className="text-lg font-black text-white mb-5 flex items-center gap-2"><Eye className="w-5 h-5 text-primary" />Activity visibility</h2>
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0"><p className="text-sm font-bold text-white">Share a minimized Kryv activity status</p><p className="mt-1 text-xs leading-relaxed text-white/40">When enabled, the owner team can see your current Kryv page category, device class, and recent activity history for platform support and safety. Kryv does not record your screen, camera, microphone, typed content, payment details, stream key, wallet destination, or anything outside Kryv.</p></div>
                    <button type="button" role="switch" aria-label="Activity visibility" aria-checked={activityObservabilityPrefs?.enabled ?? false} disabled={updateActivityObservability.isPending} onClick={() => handleUpdateActivityObservability(!(activityObservabilityPrefs?.enabled ?? false))} className={`relative inline-flex h-8 w-[72px] shrink-0 items-center rounded-full border p-1 shadow-inner transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[#101116] disabled:cursor-not-allowed disabled:opacity-50 ${(activityObservabilityPrefs?.enabled ?? false) ? 'border-primary/80 bg-primary/90' : 'border-white/15 bg-black/35 hover:border-white/30'}`}><span className={`absolute inset-y-0 left-0 flex items-center pl-2 text-[9px] font-black uppercase tracking-[0.12em] transition-opacity ${(activityObservabilityPrefs?.enabled ?? false) ? 'opacity-0' : 'text-white/45 opacity-100'}`}>Off</span><span className={`absolute inset-y-0 right-0 flex items-center pr-2 text-[9px] font-black uppercase tracking-[0.12em] transition-opacity ${(activityObservabilityPrefs?.enabled ?? false) ? 'text-primary-foreground opacity-100' : 'opacity-0'}`}>On</span><span className={`relative z-10 h-6 w-6 rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.38)] transition-transform duration-200 ${(activityObservabilityPrefs?.enabled ?? false) ? 'translate-x-10' : 'translate-x-0'}`} /></button>
                  </div>
                  <p className="mt-4 rounded-xl border border-amber-300/15 bg-amber-300/[0.06] p-3 text-[11px] leading-relaxed text-amber-100/75">This setting is off by default. Turning it off immediately removes your active presence record; it does not enable visual session replay.</p>
                </div>
              </div>

              <div>
                <h2 className="text-lg font-black text-white mb-5 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-primary" />
                  Crypto creator payouts
                </h2>
                <div className="p-5 border border-white/[0.07] rounded-2xl bg-white/[0.02]">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white">Verified crypto settlement</p>
                      <p className="mt-1 text-xs leading-relaxed text-white/40">Kryv creates a provider invoice first and only credits a creator balance after a signed payment callback confirms the transaction. Provider withdrawals and scheduled payouts remain disabled until production authorization, balance verification, reconciliation, and incident-readiness controls are complete.</p>
                    </div>
                    <span className="shrink-0 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-200">Owner-reviewed</span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">{['Bitcoin', 'Litecoin', 'Ethereum', 'Dogecoin'].map(coin => <span key={coin} className="rounded-full border border-white/[0.09] bg-black/20 px-2.5 py-1 text-[10px] font-bold text-white/60">{coin}</span>)}</div>
                  <p className="mt-4 rounded-xl border border-white/[0.06] bg-black/20 p-3 text-xs leading-relaxed text-white/40">This is a real settlement boundary—not a demo balance. Customer wallet custody and automatic scheduled payouts remain disabled. The first live tip and owner-approved payout still require provider-confirmed reconciliation before Kryv makes broader payment-performance claims.</p>
                </div>
              </div>

              <div>
                <h2 className="text-lg font-black text-white mb-5 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-primary" />
                  Supporter access
                </h2>
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.01] p-5">
                  <div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Shield className="h-5 w-5" /></div><div><p className="text-sm font-black text-white">Crypto-only supporter flows</p><p className="mt-1 text-xs leading-relaxed text-white/45">Eligible subscriptions and tips are recorded only after provider-confirmed crypto checkout. Kryv does not offer card or fiat checkout.</p></div></div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2"><div className="rounded-xl border border-white/[0.07] bg-black/20 p-3"><p className="text-[10px] font-black uppercase tracking-wider text-white/35">Ad delivery</p><p className="mt-1 text-sm font-black text-amber-100">Disabled</p><p className="mt-1 text-[11px] leading-relaxed text-white/40">No advertising or ad-free entitlement is currently delivered.</p></div><div className="rounded-xl border border-white/[0.07] bg-black/20 p-3"><p className="text-[10px] font-black uppercase tracking-wider text-white/35">Subscription status</p><p className="mt-1 text-sm font-black text-white">Provider-confirmed only</p><p className="mt-1 text-[11px] leading-relaxed text-white/40">Creator balances move only after the signed provider callback is reconciled.</p></div></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Revenue & Wallet tab ── */}
        {activeTab === 'revenue' && (
          <div className="max-w-6xl p-5 space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Creator settlement</p>
                <h2 className="mt-1 text-2xl font-black text-white">Revenue &amp; Wallet</h2>
                <p className="mt-1 max-w-2xl text-xs leading-relaxed text-white/45">Your creator balance is crypto-only. USD figures are reference values—not a conversion quote, bank balance, or fiat payout.</p>
                <div className="mt-4 grid max-w-2xl gap-2 sm:grid-cols-3">
                  <div className="rounded-xl border border-emerald-300/20 bg-emerald-300/[0.06] px-3 py-2"><p className="text-[9px] font-black uppercase tracking-widest text-emerald-200/70">Creator share</p><p className="mt-1 text-sm font-black text-emerald-100">95%</p></div>
                  <div className="rounded-xl border border-primary/20 bg-primary/[0.06] px-3 py-2"><p className="text-[9px] font-black uppercase tracking-widest text-primary/70">Kryv platform share</p><p className="mt-1 text-sm font-black text-white">5%</p></div>
                  <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2"><p className="text-[9px] font-black uppercase tracking-widest text-white/35">Checkout commission</p><p className="mt-1 text-[11px] font-bold leading-snug text-white/70">Paid separately by the supporter</p></div>
                </div>
                <p className="mt-3 max-w-2xl text-[11px] leading-relaxed text-white/35">The 95/5 split applies to the provider-confirmed crypto subtotal for eligible subscriptions and tips. Provider checkout commission is separately disclosed to the supporter and does not reduce your advertised creator share.</p>
              </div>
              <span className={`inline-flex w-fit items-center rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-widest ${creatorFinanceQuery.data?.payoutRequestsEnabled ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200' : 'border-amber-300/20 bg-amber-300/10 text-amber-100'}`}>{creatorFinanceQuery.data?.payoutRequestsEnabled ? 'Payout requests enabled' : 'Payout launch controlled'}</span>
            </div>

            {creatorFinanceQuery.isLoading ? <div className="flex min-h-64 items-center justify-center rounded-2xl border border-white/[0.08] bg-black/25"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div> : (
              <>
                <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {(['BTC', 'LTC', 'ETH', 'DOGE'] as const).map((currency) => {
                    const balance = creatorFinanceQuery.data?.balances.find((item) => item.currency === currency);
                    return <article key={currency} className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
                      <div className="flex items-center justify-between"><span className="text-xs font-black text-white">{currency}</span><Wallet className="h-4 w-4 text-primary" /></div>
                      <p className="mt-4 text-xl font-black text-white">{balance?.availableAmount ?? '0'}</p>
                      <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-white/35">Available</p>
                      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/[0.06] pt-3 text-[11px]"><span className="text-white/35">Pending <b className="ml-1 text-white/70">{balance?.pendingAmount ?? '0'}</b></span><span className="text-right text-white/35">Held <b className="ml-1 text-white/70">{balance?.heldAmount ?? '0'}</b></span></div>
                    </article>;
                  })}
                </section>

                <section className="grid gap-5 xl:grid-cols-2">
                  <form onSubmit={(event) => { event.preventDefault(); if (!payoutAddress.trim()) return; saveCreatorPayoutProfile.mutate({ data: { currency: payoutCurrency, address: payoutAddress.trim() } }, { onSuccess: () => { setPayoutAddress(''); creatorFinanceQuery.refetch(); toast({ title: 'Destination saved for review', description: 'Kryv stores only an encrypted destination and shows a masked value in your wallet.' }); }, onError: (err: any) => toast({ title: 'Destination not saved', description: err?.body?.error || err?.message || 'Check the destination and platform configuration.', variant: 'destructive' }) }); }} className="rounded-2xl border border-white/[0.08] bg-black/25 p-5">
                    <div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Wallet className="h-5 w-5" /></div><div><h3 className="text-sm font-black text-white">Payout destination</h3><p className="mt-1 text-xs leading-relaxed text-white/40">Add one destination per supported asset. A change resets owner approval and is never returned to your browser in full.</p></div></div>
                    <div className="mt-5 grid gap-3 sm:grid-cols-[140px_1fr]">
                      <label className="text-xs font-bold text-white/65">Asset<select value={payoutCurrency} onChange={event => setPayoutCurrency(event.target.value as typeof payoutCurrency)} className="mt-1.5 h-10 w-full rounded-xl border border-white/[0.1] bg-black/30 px-3 text-sm text-white outline-none focus:border-primary/60"><option value="BTC">Bitcoin (BTC)</option><option value="LTC">Litecoin (LTC)</option><option value="ETH">Ethereum (ETH)</option><option value="DOGE">Dogecoin (DOGE)</option></select></label>
                      <label className="text-xs font-bold text-white/65">Destination address<input value={payoutAddress} onChange={event => setPayoutAddress(event.target.value)} minLength={12} maxLength={240} placeholder="Paste the matching crypto address" className="mt-1.5 h-10 w-full rounded-xl border border-white/[0.1] bg-black/30 px-3 text-sm text-white outline-none focus:border-primary/60" /></label>
                    </div>
                    <Button type="submit" disabled={saveCreatorPayoutProfile.isPending || !payoutAddress.trim()} className="mt-4 w-full font-black">{saveCreatorPayoutProfile.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Encrypting…</> : <><Lock className="mr-2 h-4 w-4" /> Save for owner review</>}</Button>
                    <div className="mt-4 space-y-2">{creatorFinanceQuery.data?.payoutProfiles.length ? creatorFinanceQuery.data.payoutProfiles.map((profile) => <div key={profile.id} className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs"><span className="font-bold text-white">{profile.currency} <span className="ml-2 font-mono text-white/45">{profile.addressMasked}</span></span><span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${profile.reviewStatus === 'approved' ? 'bg-emerald-400/10 text-emerald-200' : profile.reviewStatus === 'rejected' ? 'bg-red-400/10 text-red-200' : 'bg-amber-300/10 text-amber-100'}`}>{profile.reviewStatus}</span></div>) : <p className="rounded-xl border border-dashed border-white/[0.1] p-3 text-xs text-white/35">No payout destination has been saved.</p>}</div>
                  </form>

                  <article className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.045] p-5"><div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-300/10 text-amber-100"><Clock3 className="h-5 w-5" /></div><div><h3 className="text-sm font-black text-white">Scheduled payout requests locked</h3><p className="mt-1 text-xs leading-relaxed text-white/55">Daily, weekly, and monthly payout preferences are unavailable because scheduled payout requests are hard-disabled at runtime. Kryv does not save dormant schedule instructions or promise future automatic review behavior.</p></div></div><div className="mt-5 rounded-xl border border-amber-300/15 bg-black/20 p-3 text-xs leading-relaxed text-amber-100/80"><b className="font-black text-amber-100">Available path:</b> add a masked destination for owner review, then use a manual payout request only when the current payout gate permits it. Provider withdrawals remain separately locked.</div></article>
                </section>

                <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
                  <form onSubmit={(event) => { event.preventDefault(); if (!payoutAmount.trim()) return; createCreatorPayoutRequest.mutate({ data: { currency: payoutCurrency, amount: payoutAmount.trim() } }, { onSuccess: () => { setPayoutAmount(''); creatorFinanceQuery.refetch(); toast({ title: 'Payout request queued', description: 'Your balance is reserved for owner review; no provider withdrawal has been sent.' }); }, onError: (err: any) => toast({ title: 'Payout request blocked', description: err?.body?.error || err?.message || 'Complete payout readiness before trying again.', variant: 'destructive' }) }); }} className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-5">
                    <div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary"><Send className="h-5 w-5" /></div><div><h3 className="text-sm font-black text-white">Request a payout</h3><p className="mt-1 text-xs leading-relaxed text-white/45">Available crypto is reserved first, then reviewed in the Owner Finance Command. No card or fiat payout exists.</p></div></div>
                    <div className="mt-5 grid gap-3 sm:grid-cols-[140px_1fr]"><label className="text-xs font-bold text-white/65">Asset<select value={payoutCurrency} onChange={event => setPayoutCurrency(event.target.value as typeof payoutCurrency)} className="mt-1.5 h-10 w-full rounded-xl border border-white/[0.1] bg-black/30 px-3 text-sm text-white outline-none focus:border-primary/60"><option value="BTC">BTC</option><option value="LTC">LTC</option><option value="ETH">ETH</option><option value="DOGE">DOGE</option></select></label><label className="text-xs font-bold text-white/65">Amount<input type="text" inputMode="decimal" value={payoutAmount} onChange={event => setPayoutAmount(event.target.value)} placeholder="0.00000000" className="mt-1.5 h-10 w-full rounded-xl border border-white/[0.1] bg-black/30 px-3 text-sm text-white outline-none focus:border-primary/60" /></label></div>
                    <Button type="submit" disabled={createCreatorPayoutRequest.isPending || !creatorFinanceQuery.data?.payoutRequestsEnabled || !payoutAmount.trim()} className="mt-4 w-full font-black">{createCreatorPayoutRequest.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Reserving…</> : 'Queue payout for owner review'}</Button>
                    {!creatorFinanceQuery.data?.payoutRequestsEnabled && <p className="mt-3 rounded-xl border border-amber-300/15 bg-amber-300/[0.06] p-3 text-xs leading-relaxed text-amber-100/75">Payout requests are intentionally disabled until the owner verifies encrypted destination storage, ledger monitoring, review procedures, and provider readiness.</p>}
                  </form>
                  <div className="rounded-2xl border border-white/[0.08] bg-black/25 p-5"><h3 className="text-sm font-black text-white">Payout activity</h3><div className="mt-4 space-y-2">{creatorFinanceQuery.data?.payoutRequests.length ? creatorFinanceQuery.data.payoutRequests.map((request) => <div key={request.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"><div className="flex items-center justify-between gap-3"><span className="text-sm font-bold text-white">{request.amount} {request.currency}</span><span className="text-[10px] font-black uppercase tracking-wider text-primary">{request.status}</span></div><p className="mt-1 text-[11px] text-white/35">{request.destinationMasked ?? 'Destination pending'} · {new Date(request.requestedAt).toLocaleString()}</p>{request.riskHoldReason && <p className="mt-2 text-[11px] text-amber-100/75">{request.riskHoldReason}</p>}</div>) : <p className="rounded-xl border border-dashed border-white/[0.1] p-4 text-xs text-white/35">No payout activity yet.</p>}</div></div>
                </section>
              </>
            )}
          </div>
        )}

        {/* ── Achievements tab ── */}
        {activeTab === 'achievements' && (
          <div className="max-w-5xl p-5">
            <div className="mb-6"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Creator progression</p><h2 className="mt-1 text-2xl font-black text-white">Creator Payout Ready</h2><p className="mt-1 max-w-2xl text-xs leading-relaxed text-white/45">These modest milestones unlock payout eligibility. They do not create money, guarantee payment, or convert channel points into cash.</p></div>
            {creatorAchievementsQuery.isLoading ? <div className="flex min-h-64 items-center justify-center rounded-2xl border border-white/[0.08] bg-black/25"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div> : <div className="space-y-3">{(creatorAchievementsQuery.data ?? creatorFinanceQuery.data?.achievements ?? []).map((achievement) => <article key={achievement.key} className={`rounded-2xl border p-5 ${achievement.completed ? 'border-emerald-300/20 bg-emerald-300/[0.045]' : 'border-white/[0.09] bg-black/25'}`}><div className="flex gap-4"><div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${achievement.completed ? 'bg-emerald-300/15 text-emerald-200' : 'bg-white/[0.06] text-white/40'}`}>{achievement.completed ? <CheckCircle2 className="h-5 w-5" /> : <Trophy className="h-5 w-5" />}</div><div className="min-w-0 flex-1"><div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><h3 className="text-sm font-black text-white">{achievement.title}</h3><span className={`text-xs font-black ${achievement.completed ? 'text-emerald-200' : 'text-white/50'}`}>{achievement.currentValue}/{achievement.targetValue}</span></div><p className="mt-1 text-xs text-white/45">{achievement.description}</p><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.08]"><div className={`h-full rounded-full ${achievement.completed ? 'bg-emerald-300' : 'bg-primary'}`} style={{ width: `${Math.min(100, (achievement.currentValue / Math.max(achievement.targetValue, 1)) * 100)}%` }} /></div><p className="mt-2 text-[11px] text-white/35">{achievement.evidence}</p></div></div></article>)}</div>}
          </div>
        )}

        {/* ── Engagement tab ── */}
        {activeTab === 'engagement' && (
          <div className="p-5 max-w-6xl">
            <div className="flex flex-col gap-1 mb-6">
              <h2 className="text-lg font-black text-white">Engagement Studio</h2>
              <p className="text-xs text-white/35">Create live interactions that are backed by your Kryv channel points and safely enforced on the server.</p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-5">
              <form onSubmit={(e) => { e.preventDefault(); if (!rewardTitle.trim()) return; handleEngagementAction({ action: 'create_reward', title: rewardTitle.trim(), channelPoints: rewardCost }, 'Channel-point reward created'); setRewardTitle(''); }} className="rounded-2xl border border-amber-300/20 bg-amber-400/[0.05] p-4 sm:p-5 space-y-4">
                <div className="flex items-center gap-2"><Trophy className="w-5 h-5 text-amber-300" /><h3 className="font-black text-white">Channel Points</h3></div>
                <p className="text-xs leading-relaxed text-white/45">Viewers earn points during eligible live streams, then redeem them for creator-defined rewards.</p>
                <input value={rewardTitle} onChange={e => setRewardTitle(e.target.value)} maxLength={140} placeholder="Reward title" className="w-full rounded-xl border border-white/[0.1] bg-black/25 px-3 py-2.5 text-sm text-white outline-none focus:border-amber-300/60" />
                <label className="block text-xs font-bold text-white/55">Point cost<input type="number" min={1} max={100000} value={rewardCost} onChange={e => setRewardCost(Number(e.target.value))} className="mt-1.5 w-full rounded-xl border border-white/[0.1] bg-black/25 px-3 py-2.5 text-sm text-white outline-none focus:border-amber-300/60" /></label>
                <Button type="submit" disabled={engagementAction.isPending || !rewardTitle.trim()} className="w-full bg-amber-300 text-black hover:bg-amber-200 font-black"><Trophy className="w-4 h-4 mr-2" /> Add reward</Button>
              </form>

              <form onSubmit={(e) => { e.preventDefault(); const choices = pollChoices.split('\n').map(value => value.trim()).filter(Boolean); if (!pollTitle.trim() || choices.length < 2) { toast({ title: 'Add a poll question and at least two choices', variant: 'destructive' }); return; } handleEngagementAction({ action: 'create_poll', title: pollTitle.trim(), choices, durationSeconds: 120 }, 'Poll started'); setPollTitle(''); setPollChoices(''); }} className="rounded-2xl border border-primary/25 bg-primary/[0.06] p-4 sm:p-5 space-y-4">
                <div className="flex items-center gap-2"><Vote className="w-5 h-5 text-primary" /><h3 className="font-black text-white">Live Poll</h3></div>
                <p className="text-xs leading-relaxed text-white/45">Starting a new poll automatically closes the previous active poll on this channel.</p>
                <input value={pollTitle} onChange={e => setPollTitle(e.target.value)} maxLength={140} placeholder="Ask your community…" className="w-full rounded-xl border border-white/[0.1] bg-black/25 px-3 py-2.5 text-sm text-white outline-none focus:border-primary/60" />
                <textarea value={pollChoices} onChange={e => setPollChoices(e.target.value)} rows={3} placeholder={'Choice 1\nChoice 2'} className="w-full resize-none rounded-xl border border-white/[0.1] bg-black/25 px-3 py-2.5 text-sm text-white outline-none focus:border-primary/60" />
                <Button type="submit" disabled={engagementAction.isPending} className="w-full font-black"><Vote className="w-4 h-4 mr-2" /> Start poll</Button>
                {engagement?.activePoll && <Button type="button" variant="ghost" onClick={() => handleEngagementAction({ action: 'end_poll', pollId: engagement.activePoll?.id }, 'Poll ended')} className="w-full text-white/55 hover:text-white">End “{engagement.activePoll.title}”</Button>}
              </form>

              <form onSubmit={(e) => { e.preventDefault(); const choices = predictionOutcomes.split('\n').map(value => value.trim()).filter(Boolean); if (!predictionTitle.trim() || choices.length < 2) { toast({ title: 'Add a prediction question and at least two outcomes', variant: 'destructive' }); return; } handleEngagementAction({ action: 'create_prediction', title: predictionTitle.trim(), choices, durationSeconds: 120 }, 'Prediction started'); setPredictionTitle(''); setPredictionOutcomes(''); }} className="rounded-2xl border border-fuchsia-300/20 bg-fuchsia-400/[0.05] p-4 sm:p-5 space-y-4">
                <div className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-fuchsia-300" /><h3 className="font-black text-white">Prediction</h3></div>
                <p className="text-xs leading-relaxed text-white/45">Predictions use only non-cash channel points. Lock entries before you resolve a winning outcome.</p>
                <input value={predictionTitle} onChange={e => setPredictionTitle(e.target.value)} maxLength={140} placeholder="What will happen?" className="w-full rounded-xl border border-white/[0.1] bg-black/25 px-3 py-2.5 text-sm text-white outline-none focus:border-fuchsia-300/60" />
                <textarea value={predictionOutcomes} onChange={e => setPredictionOutcomes(e.target.value)} rows={3} placeholder={'Outcome A\nOutcome B'} className="w-full resize-none rounded-xl border border-white/[0.1] bg-black/25 px-3 py-2.5 text-sm text-white outline-none focus:border-fuchsia-300/60" />
                <Button type="submit" disabled={engagementAction.isPending} className="w-full bg-fuchsia-300 text-black hover:bg-fuchsia-200 font-black"><Sparkles className="w-4 h-4 mr-2" /> Start prediction</Button>
                {engagement?.activePrediction?.status === 'active' && <Button type="button" variant="ghost" onClick={() => handleEngagementAction({ action: 'lock_prediction', predictionId: engagement.activePrediction?.id }, 'Prediction locked')} className="w-full text-white/55 hover:text-white">Lock entries</Button>}
                {engagement?.activePrediction?.status === 'locked' && <div className="pt-2 border-t border-white/[0.08]"><p className="text-[10px] font-bold uppercase tracking-widest text-white/35 mb-2">Resolve with winner</p><div className="grid grid-cols-2 gap-2">{engagement.activePrediction.outcomes.map(outcome => <Button key={outcome.id} type="button" variant="secondary" disabled={engagementAction.isPending} onClick={() => handleEngagementAction({ action: 'resolve_prediction', predictionId: engagement.activePrediction?.id, outcomeId: outcome.id }, 'Prediction resolved and points awarded')} className="h-auto py-2 text-xs font-bold truncate">{outcome.title}</Button>)}</div></div>}
              </form>
            </div>

            <div className="mt-5 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 sm:p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2"><Search className="h-5 w-5 text-primary" /><h3 className="font-black text-white">Channel destination</h3></div>
                  <p className="mt-1 text-xs text-white/45">Search Kryv to select a creator for a transparent raid or host action. Stream keys and account access are never shared.</p>
                </div>
                {selectedDestination && <span className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${selectedDestination.isLive ? 'border-red-400/20 bg-red-400/10 text-red-300' : 'border-white/[0.08] bg-white/[0.05] text-white/45'}`}>{selectedDestination.isLive ? 'Live destination' : 'Offline channel'}</span>}
              </div>
              <div className="relative mt-4">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <input value={destinationSearch} onChange={e => { setDestinationSearch(e.target.value); setSelectedDestination(null); }} placeholder="Search channels by name…" className="w-full rounded-xl border border-white/[0.1] bg-black/25 py-2.5 pl-10 pr-10 text-sm text-white outline-none transition-colors focus:border-primary/60" />
                {destinationSearch && <button type="button" aria-label="Clear channel search" onClick={() => { setDestinationSearch(''); setSelectedDestination(null); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/35 hover:text-white"><X className="h-4 w-4" /></button>}
              </div>
              {selectedDestination ? (
                <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/[0.06] p-3"><div className="min-w-0"><p className="truncate text-sm font-bold text-white">{selectedDestination.displayName}</p><p className="mt-0.5 text-[11px] text-white/40">{selectedDestination.categoryName || 'No category selected'} · Channel #{selectedDestination.id}</p></div><button type="button" onClick={() => setSelectedDestination(null)} className="text-xs font-bold text-primary hover:text-white">Change</button></div>
              ) : normalizedDestinationSearch.length >= 2 ? (
                <div className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-white/[0.08] bg-black/35 p-1">
                  {isDestinationSearching ? <div className="flex items-center gap-2 px-3 py-3 text-xs text-white/45"><Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> Searching channels…</div> : destinationSearchResults?.channels.filter(result => result.id !== channel.id).length ? destinationSearchResults.channels.filter(result => result.id !== channel.id).map(result => <button key={result.id} type="button" onClick={() => { setSelectedDestination({ id: result.id, displayName: result.displayName, isLive: result.isLive, categoryName: result.categoryName }); setDestinationSearch(result.displayName); }} className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-white/[0.06]"><span className="min-w-0"><span className="block truncate text-sm font-bold text-white">{result.displayName}</span><span className="block truncate text-[11px] text-white/40">{result.streamTitle || result.categoryName || 'Kryv channel'}</span></span><span className={`shrink-0 text-[10px] font-black uppercase tracking-wider ${result.isLive ? 'text-red-300' : 'text-white/30'}`}>{result.isLive ? '● Live' : 'Offline'}</span></button>) : <p className="px-3 py-3 text-xs text-white/40">No matching channels found.</p>}
                </div>
              ) : <p className="mt-2 text-[11px] text-white/30">Enter at least two characters to search public channels.</p>}
              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Button type="button" disabled={engagementAction.isPending || !selectedDestination?.isLive} onClick={() => selectedDestination && handleEngagementAction({ action: 'raid', targetChannelId: selectedDestination.id }, `Raid sent to ${selectedDestination.displayName}`)} className="font-black"><Swords className="mr-2 h-4 w-4" /> Raid live channel</Button>
                <div className="flex gap-2"><Button type="button" variant="secondary" disabled={engagementAction.isPending || !selectedDestination} onClick={() => selectedDestination && handleEngagementAction({ action: 'set_host', targetChannelId: selectedDestination.id }, `Hosting ${selectedDestination.displayName}`)} className="flex-1 font-black"><RadioTower className="mr-2 h-4 w-4" /> Host channel</Button><Button type="button" variant="ghost" disabled={engagementAction.isPending} onClick={() => handleEngagementAction({ action: 'clear_host' }, 'Host channel cleared')} className="text-xs text-white/45 hover:text-white">Clear</Button></div>
              </div>
            </div>
          </div>
        )}

        {/* ── Analytics tab ── */}
        {activeTab === 'analytics' && (
          <div className="p-5 max-w-6xl">
            <div className="flex flex-col gap-1 mb-5">
              <h2 className="text-lg font-black text-white">Live Analytics</h2>
              <p className="text-xs text-white/35">A rolling 30-day view of your stream sessions, community activity, and completed support events.</p>
            </div>

            {analyticsLoading ? (
              <div className="min-h-56 flex items-center justify-center border border-white/[0.07] rounded-2xl bg-white/[0.02]">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
                  {[
                    { label: 'Current Viewers', value: analytics?.isLive ? (analytics.currentViewerCount ?? 0).toLocaleString() : 'Offline', icon: Radio, accent: analytics?.isLive },
                    { label: 'Peak Viewers', value: (analytics?.peakViewers ?? 0).toLocaleString(), icon: Eye },
                    { label: 'Avg. Viewers', value: (analytics?.averageViewers ?? 0).toLocaleString(), icon: Users },
                    { label: 'Chat Messages', value: (analytics?.totalChatMessages ?? 0).toLocaleString(), icon: MessageSquare },
                    { label: 'Streams', value: (analytics?.totalStreams ?? 0).toLocaleString(), icon: Signal },
                    { label: 'Time Live', value: formatDuration(analytics?.totalStreamSeconds), icon: BarChart2 },
                    { label: 'Followers', value: (analytics?.followerCount ?? channel.followerCount ?? 0).toLocaleString(), icon: Users },
                    { label: 'Active subscriptions', value: (analytics?.activeSubscriptionCount ?? analytics?.subscriberCount ?? channel.subscriberCount ?? 0).toLocaleString(), icon: Crown },
                    { label: 'Completed tips', value: (analytics?.completedTipCount ?? 0).toLocaleString(), icon: Wallet },
                  ].map(({ label, value, icon: Icon, accent }) => (
                    <div key={label} className="p-3.5 sm:p-4 border border-white/[0.07] rounded-2xl bg-white/[0.02] min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className={`w-4 h-4 shrink-0 ${accent ? 'text-red-400' : 'text-primary'}`} />
                        <p className="text-[9px] sm:text-[10px] font-bold text-white/40 uppercase tracking-widest truncate">{label}</p>
                      </div>
                      <p className={`text-xl sm:text-2xl font-black truncate ${accent ? 'text-red-400' : 'text-white'}`}>{value}</p>
                    </div>
                  ))}
                </div>

                <div className="border border-white/[0.07] rounded-2xl bg-white/[0.02] overflow-hidden">
                  <div className="flex items-center justify-between gap-3 p-4 border-b border-white/[0.07]">
                    <div>
                      <h3 className="text-sm font-black text-white">Recent broadcasts</h3>
                      <p className="text-[11px] text-white/35 mt-0.5">Your five most recent live sessions.</p>
                    </div>
                    <span className="text-[10px] font-bold text-white/35 uppercase tracking-widest shrink-0">Last 30 days</span>
                  </div>

                  {analytics?.recentStreams?.length ? (
                    <div className="divide-y divide-white/[0.06]">
                      {analytics.recentStreams.map((stream) => (
                        <div key={stream.id} className="p-4 grid grid-cols-2 sm:grid-cols-[minmax(0,1.6fr)_0.7fr_0.7fr_0.7fr] gap-x-4 gap-y-3 items-center">
                          <div className="min-w-0 col-span-2 sm:col-span-1">
                            <p className="text-sm font-bold text-white truncate">{stream.title || 'Untitled stream'}</p>
                            <p className="text-[11px] text-white/35 mt-0.5">{new Date(stream.startedAt).toLocaleDateString()} · {formatDuration(stream.durationSeconds)}</p>
                          </div>
                          <div>
                            <p className="text-[9px] font-bold text-white/30 uppercase tracking-widest">Peak</p>
                            <p className="text-sm font-black text-white mt-0.5">{stream.peakViewers.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-[9px] font-bold text-white/30 uppercase tracking-widest">Average</p>
                            <p className="text-sm font-black text-white mt-0.5">{stream.averageViewers.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-[9px] font-bold text-white/30 uppercase tracking-widest">Chat</p>
                            <p className="text-sm font-black text-white mt-0.5">{stream.totalChatMessages.toLocaleString()}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-10 text-center">
                      <BarChart2 className="w-8 h-8 text-white/15 mx-auto mb-3" />
                      <p className="text-sm font-bold text-white/45">Your first broadcast will appear here.</p>
                      <p className="text-xs text-white/25 mt-1">Go live in OBS and Kryv will begin recording your session metrics.</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
