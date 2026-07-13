import { useState, useEffect, useRef } from 'react';
import { useGetMe, useCreateChannel, useUpdateChannel, useCreateChannelStream, useListCategories } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Loader2, Copy, RefreshCcw, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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
  
  const [credentials, setCredentials] = useState<{ rtmpUrl: string, streamKey: string } | null>(null);

  useEffect(() => {
    if (me?.channel) {
      setStreamTitle(me.channel.streamTitle || '');
      setCategoryId(me.channel.categoryId || undefined);
    }
  }, [me]);

  const handleCreateChannel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;
    
    createChannel.mutate({
      data: { displayName }
    }, {
      onSuccess: () => {
        toast({ title: 'Channel created successfully!' });
        refetchMe();
      },
      onError: (err) => {
        toast({ title: 'Failed to create channel', description: err.message, variant: 'destructive' });
      }
    });
  };

  const handleUpdateChannel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!me?.channel) return;
    
    updateChannel.mutate({
      id: me.channel.id,
      data: { streamTitle, categoryId }
    }, {
      onSuccess: () => {
        toast({ title: 'Stream info updated!' });
      },
      onError: (err) => {
        toast({ title: 'Update failed', description: err.message, variant: 'destructive' });
      }
    });
  };

  const handleGetStreamKey = () => {
    if (!me?.channel) return;
    
    createStream.mutate({
      id: me.channel.id
    }, {
      onSuccess: (data) => {
        setCredentials(data);
      },
      onError: (err) => {
        toast({ title: 'Failed to get credentials', description: err.message, variant: 'destructive' });
      }
    });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied!', description: `${label} copied to clipboard.` });
  };

  if (meLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl relative z-10">
      <h1 className="text-4xl font-display font-bold text-white mb-8">Live Dashboard</h1>

      {!me?.channel ? (
        <div className="p-8 border border-white/10 rounded-2xl bg-black/40 backdrop-blur">
          <h2 className="text-2xl font-bold mb-4">Create your channel</h2>
          <p className="text-muted-foreground mb-6">You need a channel before you can start streaming.</p>
          
          <form onSubmit={handleCreateChannel} className="space-y-4 max-w-md">
            <div>
              <label className="block text-sm font-medium text-white mb-1">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                required
                maxLength={60}
              />
            </div>
            <Button type="submit" disabled={createChannel.isPending} className="w-full font-bold">
              {createChannel.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Create Channel
            </Button>
          </form>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Stream Settings */}
          <div className="p-6 border border-white/10 rounded-2xl bg-black/40 backdrop-blur space-y-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              Stream Info
            </h2>
            
            <form onSubmit={handleUpdateChannel} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-1">Stream Title</label>
                <input
                  type="text"
                  value={streamTitle}
                  onChange={e => setStreamTitle(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  maxLength={140}
                  placeholder="What are you streaming today?"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-white mb-1">Category</label>
                <select
                  value={categoryId || ''}
                  onChange={e => setCategoryId(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary appearance-none"
                >
                  <option value="">Select a category...</option>
                  {categories?.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <Button type="submit" disabled={updateChannel.isPending} className="w-full font-bold bg-primary/20 text-primary hover:bg-primary/30 border border-primary/20">
                {updateChannel.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save Changes
              </Button>
            </form>
          </div>

          {/* Stream Key / URL */}
          <div className="p-6 border border-white/10 rounded-2xl bg-black/40 backdrop-blur space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Stream Setup</h2>
              {!credentials && (
                <Button onClick={handleGetStreamKey} disabled={createStream.isPending} variant="secondary" size="sm">
                  {createStream.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCcw className="w-4 h-4 mr-2" />}
                  Generate Key
                </Button>
              )}
            </div>

            {credentials ? (
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">Server URL</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      readOnly 
                      value={credentials.rtmpUrl} 
                      className="flex-1 bg-black border border-white/10 rounded-lg px-3 py-2 text-sm font-mono text-white/80"
                    />
                    <Button variant="secondary" size="icon" onClick={() => copyToClipboard(credentials.rtmpUrl, 'Server URL')}>
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">Stream Key</label>
                  <div className="flex gap-2">
                    <input 
                      type="password" 
                      readOnly 
                      value={credentials.streamKey} 
                      className="flex-1 bg-black border border-white/10 rounded-lg px-3 py-2 text-sm font-mono text-white/80"
                    />
                    <Button variant="secondary" size="icon" onClick={() => copyToClipboard(credentials.streamKey, 'Stream Key')}>
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-destructive mt-1 font-medium">Keep this secret! Anyone with this key can stream to your channel.</p>
                </div>
              </div>
            ) : (
              <div className="h-40 flex flex-col items-center justify-center text-center border-2 border-dashed border-white/5 rounded-xl bg-white/5">
                <p className="text-muted-foreground text-sm max-w-[200px] mb-4">
                  Generate your stream credentials to connect OBS or other broadcasting software.
                </p>
                <Button onClick={handleGetStreamKey} disabled={createStream.isPending} className="font-bold">
                  Get Stream Key
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
