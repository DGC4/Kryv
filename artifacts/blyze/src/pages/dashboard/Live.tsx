import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import {
  useGetMe,
  useCreateChannel,
  useUpdateChannel,
  useCreateChannelStream,
  useResetChannelStream,
  useListCategories,
} from '@workspace/api-client-react';
import HlsPlayer from '@/components/video/HlsPlayer';
import { Button } from '@/components/ui/button';
import {
  Loader2, Copy, RefreshCcw, Save, Radio, CheckCircle2,
  Monitor, ExternalLink, MapPin, Wifi,
  Settings, BarChart2, Users, MessageSquare, Eye, EyeOff,
  ChevronRight, Lock, Unlock, Globe, Signal, CreditCard,
  Zap, Shield, Crown,
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

type DashTab = 'stream' | 'settings' | 'analytics';

export default function DashboardLive() {
  const [, navigate] = useLocation();
  const { data: me, isLoading: meLoading, refetch: refetchMe } = useGetMe();
  const createChannel = useCreateChannel();
  const updateChannel = useUpdateChannel();
  const createStream = useCreateChannelStream();
  const resetStream = useResetChannelStream();
  const { data: categories } = useListCategories({ kind: 'live_game' });
  const { toast } = useToast();

  const [displayName, setDisplayName] = useState('');
  const [streamTitle, setStreamTitle] = useState('');
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined);
  const [credentials, setCredentials] = useState<{ rtmpUrl: string; streamKey: string } | null>(null);
  const [activeTab, setActiveTab] = useState<DashTab>('stream');
  const [locationEnforced, setLocationEnforced] = useState(false);
  const [channelCreated, setChannelCreated] = useState(false);
  const { location } = useIpLocation();

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
      setStreamTitle(me.channel.streamTitle || '');
      setCategoryId(me.channel.categoryId || undefined);
    }
  }, [me]);

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

  const handleGoLive = () => {
    if (!credentials) {
      toast({
        title: 'Generate your stream key first',
        description: 'Click "Generate Stream Key" in Step 2 before going live.',
        variant: 'destructive',
      });
      return;
    }
    // Enforce location confirmation on go live
    if (!locationEnforced) {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          () => setLocationEnforced(true),
          () => setLocationEnforced(true), // IP fallback is fine
          { timeout: 5000 },
        );
      } else {
        setLocationEnforced(true);
      }
    }
    toast({
      title: 'Ready to go live!',
      description: 'Start streaming in OBS using your RTMP URL and stream key.',
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
            <span className="font-mono text-xs">{location.ip}</span>
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
        <SidebarItem icon={Signal}    label="Stream"    active={activeTab === 'stream'}    onClick={() => setActiveTab('stream')} />
        <SidebarItem icon={Settings}  label="Settings"  active={activeTab === 'settings'}  onClick={() => setActiveTab('settings')} />
        <SidebarItem icon={BarChart2} label="Analytics" active={activeTab === 'analytics'} onClick={() => setActiveTab('analytics')} />

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
              <p className="text-[10px] text-white/30 font-mono mt-0.5">{location.ip}</p>
            </div>
          ) : (
            <div className="px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
              <div className="flex items-center gap-1.5">
                <Globe className="w-3 h-3 text-white/30" />
                <span className="text-[10px] text-white/30">Detecting…</span>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main content area ── */}
      <div className="flex-1 overflow-auto">

        {/* Top bar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] bg-black/10 sticky top-0 z-20 backdrop-blur">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-black text-white">Creator Dashboard</h1>
            <StatusBadge live={isLive} />
          </div>
          <div className="flex items-center gap-3">
            {location?.resolved && (
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-white/40">
                <MapPin className="w-3 h-3 text-primary" />
                <span>{[location.city, location.region].filter(Boolean).join(', ') || location.country}</span>
              </div>
            )}
            <Button
              onClick={handleGoLive}
              className={`h-9 px-5 font-black text-xs rounded-full transition-all ${
                credentials
                  ? 'bg-red-600 hover:bg-red-500 text-white shadow-[0_0_16px_rgba(239,68,68,0.4)]'
                  : 'bg-white/[0.06] text-white/40 border border-white/[0.08] cursor-default'
              }`}
            >
              <Radio className="w-3.5 h-3.5 mr-1.5" />
              {isLive ? 'End Stream' : 'Go Live Now'}
            </Button>
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
              <div className="p-5 border border-white/[0.07] rounded-2xl bg-white/[0.02]">
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

              {/* Location enforcement notice */}
              {!locationEnforced && credentials && (
                <div className="flex items-start gap-3 p-4 bg-primary/[0.06] border border-primary/20 rounded-xl">
                  <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-white mb-0.5">Location confirmation required to go live</p>
                    <p className="text-xs text-white/40">
                      Click "Go Live Now" to confirm your location.
                      {location?.resolved && (
                        <> Detected: <span className="text-white/60">{[location.city, location.region].filter(Boolean).join(', ')}</span></>
                      )}
                    </p>
                  </div>
                </div>
              )}
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
                    { n: '✓', title: 'Hit "Start Streaming"', body: <span>Your channel goes live within seconds.</span>, green: true },
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
                <div className="p-5 border border-white/[0.07] rounded-2xl bg-white/[0.02] space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1.5">Channel Name</label>
                    <input
                      type="text"
                      defaultValue={channel.displayName}
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
                  <Button className="font-bold bg-primary text-primary-foreground rounded-xl px-6">
                    <Save className="w-4 h-4 mr-2" /> Save Settings
                  </Button>
                </div>
              </div>

              {/* Subscription Plans */}
              <div>
                <h2 className="text-lg font-black text-white mb-5 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-primary" />
                  Subscription Plans
                </h2>
                <div className="space-y-3">
                  {[
                    { name: 'Free Tier', price: '$0', desc: 'Standard streaming with ads', icon: Signal, color: 'text-white/40' },
                    { name: 'Plus Plan', price: '$4.99', desc: 'One platform ad-free', icon: Zap, color: 'text-blue-400' },
                    { name: 'Pro Bundle', price: '$9.99', desc: 'Two platforms ad-free', icon: Shield, color: 'text-purple-400' },
                    { name: 'Kryv Ultra', price: '$14.99', desc: 'Full ad-free experience', icon: Crown, color: 'text-yellow-400', best: true },
                  ].map((plan) => (
                    <div key={plan.name} className={`p-4 border rounded-2xl flex items-center gap-4 transition-all hover:bg-white/[0.04] cursor-pointer ${plan.best ? 'border-primary/40 bg-primary/[0.03]' : 'border-white/[0.07] bg-white/[0.01]'}`}>
                      <div className={`w-10 h-10 rounded-xl bg-white/[0.05] flex items-center justify-center shrink-0 ${plan.color}`}>
                        <plan.icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-white">{plan.name}</p>
                          {plan.best && <span className="text-[9px] font-black bg-primary text-primary-foreground px-1.5 py-0.5 rounded uppercase">Best Value</span>}
                        </div>
                        <p className="text-xs text-white/40">{plan.desc}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-white">{plan.price}</p>
                        <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest">/ month</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Analytics tab ── */}
        {activeTab === 'analytics' && (
          <div className="p-5">
            <h2 className="text-lg font-black text-white mb-5">Analytics</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Total Followers', value: String(channel.followerCount ?? 0), icon: Users },
                { label: 'Subscribers',     value: String(channel.subscriberCount ?? 0), icon: Eye },
                { label: 'Viewer Count',    value: isLive ? String(channel.viewerCount ?? 0) : '—', icon: Radio },
                { label: 'Status',          value: isLive ? 'LIVE' : 'OFFLINE', icon: MessageSquare },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="p-4 border border-white/[0.07] rounded-2xl bg-white/[0.02]">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="w-4 h-4 text-primary" />
                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">{label}</p>
                  </div>
                  <p className="text-2xl font-black text-white">{value}</p>
                </div>
              ))}
            </div>
            <div className="p-5 border border-white/[0.07] rounded-2xl bg-white/[0.02] text-center">
              <BarChart2 className="w-8 h-8 text-white/20 mx-auto mb-2" />
              <p className="text-sm text-white/30">Detailed analytics coming soon</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
