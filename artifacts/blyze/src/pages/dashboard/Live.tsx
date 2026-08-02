import { useState, useEffect } from 'react';
import { useGetMe, useCreateChannel, useUpdateChannel, useCreateChannelStream, useListCategories } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Loader2, Copy, RefreshCcw, Save, Radio, CheckCircle2, Circle, Monitor, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

function Step({ n, title, done }: { n: number; title: string; done?: boolean }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shrink-0 ${done ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-primary/20 text-primary border border-primary/30'}`}>
        {done ? <CheckCircle2 className="w-4 h-4" /> : n}
      </div>
      <h2 className="text-lg font-bold text-white">{title}</h2>
    </div>
  );
}

function CopyField({ label, value, secret }: { label: string; value: string; secret?: boolean }) {
  const { toast } = useToast();
  const [show, setShow] = useState(!secret);
  const copy = () => {
    navigator.clipboard.writeText(value);
    toast({ title: 'Copied!', description: `${label} copied to clipboard.` });
  };

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">{label}</label>
      <div className="flex gap-2">
        <div className="flex-1 bg-black/60 border border-white/10 rounded-lg px-3 py-2.5 font-mono text-sm text-white/80 overflow-hidden">
          {show ? value : '••••••••••••••••••••••••••••••••'}
        </div>
        {secret && (
          <Button variant="ghost" size="sm" onClick={() => setShow(s => !s)} className="text-white/40 hover:text-white px-2 shrink-0">
            {show ? 'Hide' : 'Show'}
          </Button>
        )}
        <Button variant="secondary" size="icon" onClick={copy} className="shrink-0 bg-white/[0.06] hover:bg-white/[0.10] border border-white/10">
          <Copy className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

export default function DashboardLive() {
  const { data: me, isLoading: meLoading, refetch: refetchMe } = useGetMe();
  const createChannel = useCreateChannel();
  const updateChannel = useUpdateChannel();
  const createStream = useCreateChannelStream();
  const { data: categories } = useListCategories({ kind: 'live_game' });
  const { toast } = useToast();

  const [displayName, setDisplayName] = useState('');
  const [streamTitle, setStreamTitle] = useState('');
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined);
  const [credentials, setCredentials] = useState<{ rtmpUrl: string; streamKey: string } | null>(null);

  useEffect(() => {
    if (me?.channel) {
      setStreamTitle(me.channel.streamTitle || '');
      setCategoryId(me.channel.categoryId || undefined);
    }
  }, [me]);

  const handleCreateChannel = (e: React.FormEvent) => {
    e.preventDefault();
    createChannel.mutate({ data: { displayName } }, {
      onSuccess: () => { toast({ title: 'Channel created!' }); refetchMe(); },
      onError: (err) => toast({ title: 'Failed', description: err.message, variant: 'destructive' }),
    });
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!me?.channel) return;
    updateChannel.mutate({ id: me.channel.id, data: { streamTitle, categoryId } }, {
      onSuccess: () => toast({ title: 'Stream info saved!' }),
      onError: (err) => toast({ title: 'Failed', description: err.message, variant: 'destructive' }),
    });
  };

  const handleGetKey = () => {
    if (!me?.channel) return;
    createStream.mutate({ id: me.channel.id }, {
      onSuccess: (data) => setCredentials(data),
      onError: (err) => toast({ title: 'Failed', description: err.message, variant: 'destructive' }),
    });
  };

  if (meLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const channel = me?.channel;
  const isLive = channel?.isLive ?? false;

  return (
    <div className="relative z-10 max-w-[1600px] mx-auto px-4 lg:px-6 py-8">

      {/* Page header */}
      <div className="flex items-center gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-black text-white">Creator Dashboard</h1>
            {isLive && (
              <span className="flex items-center gap-1.5 bg-red-600/20 border border-red-500/30 text-red-400 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider animate-pulse">
                <Radio className="w-3 h-3" />
                LIVE
              </span>
            )}
          </div>
          <p className="text-white/40 text-sm">Stream live on Kryv using OBS or any RTMP encoder</p>
        </div>
      </div>

      {!channel ? (
        /* ── Step 1: Create channel ── */
        <div className="max-w-lg">
          <div className="p-6 border border-white/[0.08] rounded-2xl bg-white/[0.03] backdrop-blur">
            <Step n={1} title="Create your channel" />
            <p className="text-white/40 text-sm mb-5 ml-11">Choose a display name for your channel — this is what viewers will see.</p>
            <form onSubmit={handleCreateChannel} className="space-y-4 ml-11">
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Your channel name…"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary/60 transition-all"
                required maxLength={60}
              />
              <Button type="submit" disabled={createChannel.isPending} className="w-full font-bold bg-primary text-primary-foreground rounded-xl h-11">
                {createChannel.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Create Channel
              </Button>
            </form>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Left column */}
          <div className="space-y-5">

            {/* Step 2: Stream info */}
            <div className="p-6 border border-white/[0.08] rounded-2xl bg-white/[0.03] backdrop-blur">
              <Step n={2} title="Set your stream info" done={!!channel.streamTitle} />
              <form onSubmit={handleUpdate} className="space-y-4 ml-11">
                <div>
                  <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Stream Title</label>
                  <input
                    type="text"
                    value={streamTitle}
                    onChange={e => setStreamTitle(e.target.value)}
                    placeholder="What are you streaming today?"
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary/60 transition-all"
                    maxLength={140}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Category</label>
                  <select
                    value={categoryId ?? ''}
                    onChange={e => setCategoryId(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary/60 transition-all appearance-none"
                  >
                    <option value="">Select a category…</option>
                    {categories?.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <Button type="submit" disabled={updateChannel.isPending} variant="secondary" className="w-full font-bold rounded-xl h-11 bg-white/[0.06] border border-white/10 hover:bg-white/[0.10]">
                  {updateChannel.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Save Info
                </Button>
              </form>
            </div>

            {/* Step 3: Get credentials */}
            <div className="p-6 border border-white/[0.08] rounded-2xl bg-white/[0.03] backdrop-blur">
              <div className="flex items-start justify-between mb-1">
                <Step n={3} title="Get stream credentials" done={!!credentials} />
                {credentials && (
                  <Button onClick={handleGetKey} disabled={createStream.isPending} size="sm" variant="ghost" className="text-white/40 hover:text-white ml-auto shrink-0 -mt-1">
                    <RefreshCcw className="w-3.5 h-3.5 mr-1" /> Rotate key
                  </Button>
                )}
              </div>

              <div className="ml-11">
                {credentials ? (
                  <div className="space-y-4">
                    <CopyField label="Server URL (RTMP)" value={credentials.rtmpUrl} />
                    <CopyField label="Stream Key" value={credentials.streamKey} secret />
                    <p className="text-xs text-red-400/80 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                      Keep your stream key private — anyone with it can broadcast to your channel.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-white/40 text-sm">Generate your credentials to connect OBS or any RTMP broadcaster.</p>
                    <Button onClick={handleGetKey} disabled={createStream.isPending} className="font-bold bg-primary text-primary-foreground rounded-xl px-6">
                      {createStream.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                      Generate Stream Key
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right column — OBS setup guide */}
          <div className="p-6 border border-white/[0.08] rounded-2xl bg-white/[0.03] backdrop-blur h-fit">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
                <Monitor className="w-4 h-4 text-primary" />
              </div>
              <h2 className="text-lg font-bold text-white">OBS Setup Guide</h2>
            </div>

            <div className="space-y-5 text-sm">
              <div className="flex gap-4">
                <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-black text-primary shrink-0 mt-0.5">1</div>
                <div>
                  <p className="font-semibold text-white mb-1">Download OBS Studio</p>
                  <p className="text-white/40">Free and open-source. Download from <a href="https://obsproject.com" target="_blank" rel="noopener" className="text-primary hover:underline inline-flex items-center gap-0.5">obsproject.com <ExternalLink className="w-3 h-3" /></a></p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-black text-primary shrink-0 mt-0.5">2</div>
                <div>
                  <p className="font-semibold text-white mb-1">Open Settings → Stream</p>
                  <p className="text-white/40">In OBS: <span className="text-white/70 font-mono text-xs bg-white/[0.06] px-1.5 py-0.5 rounded">Settings → Stream</span></p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-black text-primary shrink-0 mt-0.5">3</div>
                <div>
                  <p className="font-semibold text-white mb-1">Select Custom RTMP</p>
                  <p className="text-white/40">Set Service to <span className="text-white/70 font-mono text-xs bg-white/[0.06] px-1.5 py-0.5 rounded">Custom...</span></p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-black text-primary shrink-0 mt-0.5">4</div>
                <div>
                  <p className="font-semibold text-white mb-1">Enter your credentials</p>
                  <div className="space-y-2 mt-2">
                    <div className="bg-black/40 border border-white/[0.07] rounded-lg p-3 text-xs text-white/60 font-mono">
                      <p className="text-white/30 mb-1 font-sans font-semibold tracking-wider uppercase text-[10px]">Server</p>
                      <p className="text-white/80">{credentials?.rtmpUrl || 'rtmp://global-live.mux.com:5222/app'}</p>
                    </div>
                    <div className="bg-black/40 border border-white/[0.07] rounded-lg p-3 text-xs text-white/60 font-mono">
                      <p className="text-white/30 mb-1 font-sans font-semibold tracking-wider uppercase text-[10px]">Stream Key</p>
                      <p className="text-white/80">{credentials?.streamKey ? '••••••••' : '(generate above first)'}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-6 h-6 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                </div>
                <div>
                  <p className="font-semibold text-white mb-1">Hit "Start Streaming" in OBS</p>
                  <p className="text-white/40">Your channel will go live on Kryv within a few seconds. Your stream key generates a fresh Mux live stream each time.</p>
                </div>
              </div>

              <div className="mt-4 p-3 bg-primary/[0.07] border border-primary/20 rounded-xl">
                <p className="text-xs text-white/60">
                  <span className="text-primary font-semibold">Recommended OBS settings: </span>
                  Encoder: x264 or Hardware (NVENC/AMD). Bitrate: 3000–6000 kbps. Keyframe interval: 2s. Resolution: 1080p or 720p at 30/60fps.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
