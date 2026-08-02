import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { Link } from 'wouter';
import {
  useCreateChannel,
  useCreateChannelStream,
  useGetChannel,
  useGetMe,
  useListCategories,
  useUpdateChannel,
} from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Activity,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  LayoutDashboard,
  Loader2,
  Monitor,
  Radio,
  RefreshCcw,
  Save,
  Settings2,
  ShieldCheck,
  Signal,
  UserRound,
  Users,
  Wifi,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type StudioTab = 'studio' | 'channel' | 'insights';

type StreamCredentials = {
  rtmpUrl: string;
  streamKey: string;
  playbackId: string;
};

function formatError(error: unknown) {
  const candidate = error as { body?: { error?: string }; message?: string } | undefined;
  return candidate?.body?.error || candidate?.message || 'Something went wrong. Please try again.';
}

function StatusBadge({ live }: { live: boolean }) {
  return live ? (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-red-400/30 bg-red-500/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-red-300">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-300" />
      Live now
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white/40">
      <span className="h-1.5 w-1.5 rounded-full bg-white/30" />
      Offline
    </span>
  );
}

function StudioNavItem({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof Signal;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-bold transition-all ${
        active
          ? 'border border-primary/30 bg-primary/10 text-primary shadow-[0_0_22px_hsl(var(--primary)/0.08)]'
          : 'border border-transparent text-white/45 hover:border-white/[0.07] hover:bg-white/[0.04] hover:text-white'
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{label}</span>
      <ChevronRight className={`ml-auto h-3.5 w-3.5 transition-transform ${active ? 'translate-x-0 text-primary' : '-translate-x-1 text-white/20 group-hover:translate-x-0'}`} />
    </button>
  );
}

function CopyField({ label, value, secret = false }: { label: string; value: string; secret?: boolean }) {
  const { toast } = useToast();
  const [revealed, setRevealed] = useState(!secret);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: `${label} copied`, description: 'It is ready to paste into your streaming software.' });
    } catch {
      toast({ title: 'Copy unavailable', description: 'Your browser did not allow clipboard access. Select the field and copy it manually.', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <label className="text-[10px] font-black uppercase tracking-[0.16em] text-white/35">{label}</label>
        {secret && <span className="text-[10px] text-amber-200/70">Visible only for this session</span>}
      </div>
      <div className="flex gap-2">
        <div className="min-w-0 flex-1 overflow-hidden rounded-xl border border-white/[0.09] bg-black/40 px-3 py-2.5 font-mono text-xs text-white/80">
          <span className="block truncate">{secret && !revealed ? '••••••••••••••••••••••••••••••••' : value}</span>
        </div>
        {secret && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setRevealed((current) => !current)}
            className="h-10 w-10 shrink-0 border border-white/[0.09] bg-white/[0.03] text-white/45 hover:bg-white/[0.08] hover:text-primary"
            aria-label={revealed ? 'Hide stream key' : 'Show stream key'}
          >
            {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={copy}
          className="h-10 w-10 shrink-0 border border-white/[0.09] bg-white/[0.03] text-white/45 hover:bg-white/[0.08] hover:text-primary"
          aria-label={`Copy ${label}`}
        >
          <Copy className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function Metric({ label, value, icon: Icon, accent = false }: { label: string; value: string; icon: typeof Users; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-black/25 p-4 backdrop-blur-sm transition-colors hover:border-primary/25">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/35">{label}</p>
        <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${accent ? 'bg-primary/15 text-primary' : 'bg-white/[0.06] text-white/45'}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className={`font-display text-2xl ${accent ? 'text-primary' : 'text-white'}`}>{value}</p>
    </div>
  );
}

function ShellCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-white/[0.08] bg-black/25 p-5 backdrop-blur-sm ${className}`}>{children}</section>;
}

export default function DashboardLive() {
  const { data: me, isLoading: isMeLoading, refetch: refetchMe } = useGetMe({
    query: { refetchInterval: 8_000 },
  });
  const channelId = me?.channel?.id ?? 0;
  const { data: channelDetail, refetch: refetchChannel } = useGetChannel(channelId, {
    query: { enabled: Boolean(channelId), refetchInterval: 8_000 },
  });
  const { data: categories } = useListCategories({ kind: 'live_game' });
  const createChannel = useCreateChannel();
  const updateChannel = useUpdateChannel();
  const createStream = useCreateChannelStream();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<StudioTab>('studio');
  const [newChannelName, setNewChannelName] = useState('');
  const [streamTitle, setStreamTitle] = useState('');
  const [categoryId, setCategoryId] = useState<number | undefined>();
  const [profileName, setProfileName] = useState('');
  const [profileDescription, setProfileDescription] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [credentials, setCredentials] = useState<StreamCredentials | null>(null);
  const [rotationOpen, setRotationOpen] = useState(false);

  const channel = channelDetail ?? me?.channel;
  const isLive = channel?.isLive ?? false;

  useEffect(() => {
    if (!channel) return;
    setStreamTitle(channel.streamTitle || '');
    setCategoryId(channel.categoryId ?? undefined);
  }, [channel?.id, channel?.streamTitle, channel?.categoryId]);

  useEffect(() => {
    if (!channel) return;
    setProfileName(channel.displayName);
    setProfileDescription(channelDetail?.description || '');
    setAvatarUrl(channel.avatarUrl || '');
    setBannerUrl(channel.bannerUrl || '');
  }, [channel?.id, channel?.displayName, channel?.avatarUrl, channel?.bannerUrl, channelDetail?.description]);

  const refreshChannelData = useCallback(() => {
    void refetchMe();
    if (channelId) void refetchChannel();
  }, [channelId, refetchChannel, refetchMe]);

  const createCreatorChannel = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const displayName = newChannelName.trim();
    if (!displayName) return;
    createChannel.mutate(
      { data: { displayName } },
      {
        onSuccess: () => {
          toast({ title: 'Your Kryv channel is ready', description: 'Set your broadcast details, then generate your private stream key.' });
          refreshChannelData();
        },
        onError: (error) => toast({ title: 'Could not create the channel', description: formatError(error), variant: 'destructive' }),
      },
    );
  };

  const saveBroadcastDetails = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!channel) return;
    updateChannel.mutate(
      {
        id: channel.id,
        data: {
          streamTitle: streamTitle.trim() || undefined,
          categoryId,
        },
      },
      {
        onSuccess: () => {
          toast({ title: 'Broadcast details saved', description: 'Your title and category are ready for the next live session.' });
          refreshChannelData();
        },
        onError: (error) => toast({ title: 'Could not save broadcast details', description: formatError(error), variant: 'destructive' }),
      },
    );
  };

  const saveChannelProfile = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!channel || !profileName.trim()) return;
    updateChannel.mutate(
      {
        id: channel.id,
        data: {
          displayName: profileName.trim(),
          description: profileDescription.trim() || undefined,
          avatarUrl: avatarUrl.trim() || undefined,
          bannerUrl: bannerUrl.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          toast({ title: 'Channel profile saved', description: 'Your Kryv channel identity has been updated.' });
          refreshChannelData();
        },
        onError: (error) => toast({ title: 'Could not save channel profile', description: formatError(error), variant: 'destructive' }),
      },
    );
  };

  const generateStreamKey = useCallback(() => {
    if (!channel) return;
    createStream.mutate(
      { id: channel.id },
      {
        onSuccess: (data) => {
          setCredentials(data);
          setRotationOpen(false);
          toast({ title: 'Private stream key generated', description: 'Copy it into OBS now. Kryv will not show this key again after this session.' });
          refreshChannelData();
        },
        onError: (error) => {
          const message = formatError(error);
          toast({
            title: 'Streaming is not ready yet',
            description: message.includes('Mux') || message.includes('configured')
              ? 'Mux credentials are missing on the Kryv server. Configure MUX_TOKEN_ID, MUX_TOKEN_SECRET, and MUX_WEBHOOK_SECRET before broadcasting.'
              : message,
            variant: 'destructive',
          });
        },
      },
    );
  }, [channel, createStream, refreshChannelData, toast]);

  if (isMeLoading) {
    return (
      <div className="relative z-10 flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!channel) {
    return (
      <main className="relative z-10 mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-5xl items-center px-4 py-12 lg:px-6">
        <div className="grid w-full overflow-hidden rounded-3xl border border-white/[0.09] bg-black/35 shadow-[0_30px_100px_rgba(0,0,0,0.4)] backdrop-blur-xl lg:grid-cols-[1.1fr_0.9fr]">
          <div className="relative p-8 sm:p-12">
            <div className="pointer-events-none absolute -left-28 -top-28 h-72 w-72 rounded-full bg-primary/15 blur-3xl" />
            <div className="relative">
              <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary shadow-[0_0_28px_hsl(var(--primary)/0.18)]">
                <Radio className="h-6 w-6" />
              </div>
              <p className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-primary">Kryv Creator Studio</p>
              <h1 className="font-display text-4xl leading-[0.95] text-white sm:text-5xl">Your channel starts with a real signal.</h1>
              <p className="mt-5 max-w-lg text-sm leading-6 text-white/55">Create your creator identity once. Kryv then connects your channel to real Mux RTMP ingest and viewer playback—no simulated streams.</p>
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {[
                  ['One creator identity', 'Your public live channel, profile, and settings stay together.'],
                  ['Real live workflow', 'Generate private credentials and broadcast through your preferred encoder.'],
                ].map(([title, body]) => (
                  <div key={title} className="rounded-2xl border border-white/[0.08] bg-black/20 p-4">
                    <CheckCircle2 className="mb-2 h-4 w-4 text-primary" />
                    <p className="text-sm font-bold text-white">{title}</p>
                    <p className="mt-1 text-xs leading-5 text-white/40">{body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="border-t border-white/[0.08] bg-white/[0.025] p-8 sm:p-12 lg:border-l lg:border-t-0">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">Step 1 of 3</p>
            <h2 className="mt-2 font-display text-2xl text-white">Claim your channel</h2>
            <form onSubmit={createCreatorChannel} className="mt-7 space-y-5">
              <div>
                <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-white/45">Public channel name</label>
                <input
                  value={newChannelName}
                  onChange={(event) => setNewChannelName(event.target.value)}
                  maxLength={60}
                  placeholder="Your creator name"
                  className="h-12 w-full rounded-xl border border-white/[0.10] bg-black/35 px-4 text-sm text-white outline-none placeholder:text-white/20 focus:border-primary/60 focus:ring-2 focus:ring-primary/10"
                  required
                />
                <p className="mt-2 text-xs leading-5 text-white/35">This appears across Kryv Live. You can customize artwork and your bio in Channel settings.</p>
              </div>
              <Button
                type="submit"
                disabled={createChannel.isPending || !newChannelName.trim()}
                className="h-12 w-full rounded-xl bg-primary text-sm font-black text-primary-foreground shadow-[0_0_26px_hsl(var(--primary)/0.25)] hover:bg-primary/90"
              >
                {createChannel.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Signal className="mr-2 h-4 w-4" />}
                Create my Kryv channel
              </Button>
            </form>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative z-10 mx-auto min-h-[calc(100dvh-4rem)] w-full max-w-[1540px] px-4 py-6 lg:px-6 lg:py-8">
      <section className="relative overflow-hidden rounded-3xl border border-white/[0.09] bg-black/35 p-6 shadow-[0_24px_90px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:p-8">
        <div className="pointer-events-none absolute -right-24 -top-32 h-80 w-80 rounded-full bg-primary/15 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/4 h-24 w-1/2 bg-primary/[0.04] blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Kryv Creator Studio / Live control</p>
              <StatusBadge live={isLive} />
            </div>
            <h1 className="font-display text-3xl leading-none text-white sm:text-4xl">Broadcast with a signal that is yours.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/50">Configure your live session, generate an authenticated RTMP key, and let Mux webhooks confirm the moment your channel goes live.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link href={`/live/${channel.id}`}>
              <Button variant="outline" className="h-10 rounded-full border-white/15 bg-black/20 px-4 text-xs font-bold text-white/75 hover:border-primary/40 hover:bg-primary/10 hover:text-primary">
                <ExternalLink className="mr-2 h-3.5 w-3.5" />
                View public channel
              </Button>
            </Link>
            <Button
              type="button"
              onClick={credentials ? () => setRotationOpen(true) : generateStreamKey}
              disabled={createStream.isPending}
              className="h-10 rounded-full bg-primary px-5 text-xs font-black text-primary-foreground shadow-[0_0_22px_hsl(var(--primary)/0.22)] hover:bg-primary/90"
            >
              {createStream.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : credentials ? <RefreshCcw className="mr-2 h-3.5 w-3.5" /> : <KeyRound className="mr-2 h-3.5 w-3.5" />}
              {credentials ? 'Regenerate key' : 'Generate stream key'}
            </Button>
          </div>
        </div>
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-white/[0.08] bg-black/25 p-3 backdrop-blur-sm lg:sticky lg:top-20 lg:h-fit">
          <p className="px-3 pb-2 pt-1 text-[10px] font-black uppercase tracking-[0.18em] text-white/30">Creator workspace</p>
          <div className="flex gap-1 overflow-x-auto lg:flex-col">
            <StudioNavItem icon={LayoutDashboard} label="Live studio" active={activeTab === 'studio'} onClick={() => setActiveTab('studio')} />
            <StudioNavItem icon={UserRound} label="Channel" active={activeTab === 'channel'} onClick={() => setActiveTab('channel')} />
            <StudioNavItem icon={BarChart3} label="Pulse" active={activeTab === 'insights'} onClick={() => setActiveTab('insights')} />
          </div>
          <div className="mt-4 hidden rounded-xl border border-white/[0.07] bg-white/[0.025] p-3 lg:block">
            <div className="flex items-center gap-2 text-primary"><ShieldCheck className="h-3.5 w-3.5" /><span className="text-[10px] font-black uppercase tracking-[0.13em]">Private by design</span></div>
            <p className="mt-2 text-xs leading-5 text-white/40">Stream keys are delivered only to this authenticated creator session. Kryv does not display prior keys later.</p>
          </div>
        </aside>

        <div className="min-w-0">
          {activeTab === 'studio' && (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Metric label="Signal" value={isLive ? 'Live' : 'Offline'} icon={Radio} accent={isLive} />
                <Metric label="Live viewers" value={String(channel.viewerCount ?? 0)} icon={Users} />
                <Metric label="Followers" value={String(channel.followerCount ?? 0)} icon={UserRound} />
                <Metric label="Category" value={channel.categoryName || 'Unassigned'} icon={Activity} />
              </div>

              <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
                <div className="space-y-5">
                  <ShellCard>
                    <div className="mb-5 flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">1</div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.17em] text-white/35">Broadcast metadata</p>
                        <h2 className="mt-1 font-display text-xl text-white">Set the moment before you go live.</h2>
                      </div>
                    </div>
                    <form onSubmit={saveBroadcastDetails} className="space-y-4">
                      <div>
                        <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-white/45">Stream title</label>
                        <input
                          value={streamTitle}
                          onChange={(event) => setStreamTitle(event.target.value)}
                          maxLength={140}
                          placeholder="What are you streaming today?"
                          className="h-11 w-full rounded-xl border border-white/[0.10] bg-black/35 px-4 text-sm text-white outline-none placeholder:text-white/20 focus:border-primary/60 focus:ring-2 focus:ring-primary/10"
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-white/45">Live category</label>
                        <select
                          value={categoryId ?? ''}
                          onChange={(event) => setCategoryId(event.target.value ? Number(event.target.value) : undefined)}
                          className="h-11 w-full rounded-xl border border-white/[0.10] bg-black/35 px-4 text-sm text-white outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10"
                        >
                          <option value="">Select a category</option>
                          {categories?.map((categoryOption) => <option key={categoryOption.id} value={categoryOption.id}>{categoryOption.name}</option>)}
                        </select>
                      </div>
                      <Button type="submit" disabled={updateChannel.isPending} className="h-10 rounded-xl bg-white/[0.07] px-4 text-xs font-bold text-white hover:bg-white/[0.12]">
                        {updateChannel.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-2 h-3.5 w-3.5" />}
                        Save broadcast details
                      </Button>
                    </form>
                  </ShellCard>

                  <ShellCard className="border-primary/15 bg-gradient-to-br from-primary/[0.07] via-black/25 to-black/25">
                    <div className="mb-5 flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary"><KeyRound className="h-4 w-4" /></div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.17em] text-white/35">Private ingest</p>
                          <h2 className="mt-1 font-display text-xl text-white">Your RTMP credentials</h2>
                        </div>
                      </div>
                      <StatusBadge live={isLive} />
                    </div>
                    {credentials ? (
                      <div className="space-y-4">
                        <CopyField label="RTMP server URL" value={credentials.rtmpUrl} />
                        <CopyField label="Stream key" value={credentials.streamKey} secret />
                        <div className="flex gap-3 rounded-xl border border-amber-400/20 bg-amber-300/[0.06] p-3 text-xs leading-5 text-amber-100/80">
                          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                          <p>Anyone with this key can broadcast to your channel. Kryv stores the Mux configuration, not this plaintext key; regenerate it if it is ever exposed.</p>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-white/[0.12] bg-black/20 p-5">
                        <Wifi className="mb-3 h-5 w-5 text-primary" />
                        <p className="font-bold text-white">Generate a private Mux key when you are ready to connect.</p>
                        <p className="mt-1 text-xs leading-5 text-white/45">Your credential is generated through the authenticated Kryv API and shown only to you in this session.</p>
                        <Button type="button" onClick={generateStreamKey} disabled={createStream.isPending} className="mt-4 h-10 rounded-xl bg-primary px-4 text-xs font-black text-primary-foreground hover:bg-primary/90">
                          {createStream.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <KeyRound className="mr-2 h-3.5 w-3.5" />}
                          Generate credentials
                        </Button>
                      </div>
                    )}
                  </ShellCard>
                </div>

                <div className="space-y-5">
                  <ShellCard className="overflow-hidden p-0">
                    <div className="relative flex aspect-video items-center justify-center overflow-hidden bg-black/55">
                      {channel.bannerUrl && <img src={channel.bannerUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />}
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,hsl(var(--primary)/0.22),transparent_55%)]" />
                      <div className="relative flex flex-col items-center text-center">
                        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-black/40 text-primary"><Monitor className="h-6 w-6" /></div>
                        <p className="text-sm font-black text-white">{channel.displayName}</p>
                        <p className="mt-1 text-xs text-white/45">{isLive ? 'Mux has confirmed your live signal.' : 'Your live preview appears after Mux confirms ingest.'}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between border-t border-white/[0.08] px-4 py-3"><StatusBadge live={isLive} /><span className="text-xs text-white/35">{channel.viewerCount ?? 0} watching</span></div>
                  </ShellCard>

                  <ShellCard>
                    <div className="mb-4 flex items-center gap-2"><Monitor className="h-4 w-4 text-primary" /><h2 className="font-display text-lg text-white">OBS, Streamlabs, or XSplit</h2></div>
                    <ol className="space-y-4 text-xs">
                      {[
                        ['Open Stream settings', 'Choose a Custom RTMP service rather than a platform preset.'],
                        ['Paste server and key', 'Copy the two private fields from the secure credential panel.'],
                        ['Use stable encoder settings', 'Start with H.264, CBR, 1080p/60 fps, 6–8 Mbps, and a 2-second keyframe interval.'],
                        ['Start Streaming', 'Kryv waits for the signed Mux webhook before showing your public channel as live.'],
                      ].map(([title, body], index) => (
                        <li key={title} className="flex gap-3">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-primary/25 bg-primary/10 text-[10px] font-black text-primary">{index + 1}</span>
                          <p className="leading-5 text-white/45"><span className="font-bold text-white/85">{title}. </span>{body}</p>
                        </li>
                      ))}
                    </ol>
                    <a href="https://obsproject.com" target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center text-xs font-bold text-primary hover:underline">Download OBS Studio <ExternalLink className="ml-1.5 h-3 w-3" /></a>
                  </ShellCard>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'channel' && (
            <div className="grid gap-5 xl:grid-cols-[minmax(280px,0.75fr)_minmax(0,1.25fr)]">
              <ShellCard className="relative overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-br from-primary/30 via-primary/10 to-transparent" />
                <div className="relative pt-16 text-center">
                  <div className="mx-auto flex h-20 w-20 items-center justify-center overflow-hidden rounded-3xl border-2 border-black bg-primary/20 text-2xl font-black text-primary shadow-[0_0_30px_hsl(var(--primary)/0.35)]">
                    {channel.avatarUrl ? <img src={channel.avatarUrl} alt={channel.displayName} className="h-full w-full object-cover" /> : channel.displayName[0]?.toUpperCase()}
                  </div>
                  <p className="mt-4 font-display text-2xl text-white">{channel.displayName}</p>
                  <p className="mt-1 font-mono text-xs text-primary/80">kryv.tv/live/{channel.slug}</p>
                  <p className="mx-auto mt-5 max-w-sm text-sm leading-6 text-white/45">{channelDetail?.description || 'Add a channel bio so viewers know what makes this signal worth joining.'}</p>
                </div>
                <div className="mt-6 grid grid-cols-2 gap-2 border-t border-white/[0.08] pt-5 text-center">
                  <div><p className="font-display text-xl text-white">{channel.followerCount ?? 0}</p><p className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-white/35">Followers</p></div>
                  <div><p className="font-display text-xl text-white">{isLive ? 'On air' : 'Standby'}</p><p className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-white/35">Signal</p></div>
                </div>
              </ShellCard>

              <ShellCard>
                <div className="mb-6 flex items-start gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary"><Settings2 className="h-4 w-4" /></div><div><p className="text-[10px] font-black uppercase tracking-[0.17em] text-white/35">Public identity</p><h2 className="mt-1 font-display text-xl text-white">Channel settings</h2></div></div>
                <form onSubmit={saveChannelProfile} className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2"><label className="mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-white/45">Display name</label><input value={profileName} onChange={(event) => setProfileName(event.target.value)} maxLength={60} required className="h-11 w-full rounded-xl border border-white/[0.10] bg-black/35 px-4 text-sm text-white outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10" /></div>
                  <div className="sm:col-span-2"><label className="mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-white/45">Channel bio</label><textarea value={profileDescription} onChange={(event) => setProfileDescription(event.target.value)} maxLength={500} rows={5} placeholder="Tell people what they can expect from your channel." className="w-full resize-none rounded-xl border border-white/[0.10] bg-black/35 px-4 py-3 text-sm text-white outline-none placeholder:text-white/20 focus:border-primary/60 focus:ring-2 focus:ring-primary/10" /></div>
                  <div><label className="mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-white/45">Avatar image URL</label><input type="url" value={avatarUrl} onChange={(event) => setAvatarUrl(event.target.value)} placeholder="https://…" className="h-11 w-full rounded-xl border border-white/[0.10] bg-black/35 px-4 text-sm text-white outline-none placeholder:text-white/20 focus:border-primary/60 focus:ring-2 focus:ring-primary/10" /></div>
                  <div><label className="mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-white/45">Banner image URL</label><input type="url" value={bannerUrl} onChange={(event) => setBannerUrl(event.target.value)} placeholder="https://…" className="h-11 w-full rounded-xl border border-white/[0.10] bg-black/35 px-4 text-sm text-white outline-none placeholder:text-white/20 focus:border-primary/60 focus:ring-2 focus:ring-primary/10" /></div>
                  <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-3 pt-2"><p className="text-xs text-white/35">Your channel uses the live Kryv theme globally, including the rotating neon accent in this studio.</p><Button type="submit" disabled={updateChannel.isPending || !profileName.trim()} className="h-10 rounded-xl bg-primary px-4 text-xs font-black text-primary-foreground hover:bg-primary/90">{updateChannel.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-2 h-3.5 w-3.5" />}Save channel</Button></div>
                </form>
              </ShellCard>
            </div>
          )}

          {activeTab === 'insights' && (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Metric label="Current viewers" value={String(channel.viewerCount ?? 0)} icon={Users} accent={isLive} />
                <Metric label="Followers" value={String(channel.followerCount ?? 0)} icon={UserRound} />
                <Metric label="Public playback" value={channel.playbackId ? 'Ready' : 'Waiting'} icon={Monitor} accent={Boolean(channel.playbackId)} />
                <Metric label="Session state" value={isLive ? 'Live' : 'Offline'} icon={Radio} accent={isLive} />
              </div>
              <ShellCard className="relative overflow-hidden text-center">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,hsl(var(--primary)/0.14),transparent_50%)]" />
                <div className="relative mx-auto max-w-xl py-10"><Activity className="mx-auto mb-4 h-8 w-8 text-primary" /><p className="font-display text-2xl text-white">Real analytics arrive with a real data source.</p><p className="mt-3 text-sm leading-6 text-white/45">Kryv is showing the verified live state, viewer count, follower count, and playback readiness already available from your channel. Historical trends, revenue, and payouts remain intentionally absent until their providers are connected—no fake creator metrics.</p></div>
              </ShellCard>
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={rotationOpen} onOpenChange={setRotationOpen}>
        <AlertDialogContent className="border-primary/20 bg-black/95 text-white shadow-[0_0_60px_hsl(var(--primary)/0.16)]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-2xl">Replace the current stream key?</AlertDialogTitle>
            <AlertDialogDescription className="leading-6 text-white/55">Kryv will ask Mux to invalidate the existing key immediately and create a new private key. OBS or any encoder using the old key will stop connecting until you update it.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/15 bg-white/[0.04] text-white hover:bg-white/[0.09] hover:text-white">Keep current key</AlertDialogCancel>
            <AlertDialogAction onClick={generateStreamKey} className="bg-primary text-primary-foreground hover:bg-primary/90">Regenerate key</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
