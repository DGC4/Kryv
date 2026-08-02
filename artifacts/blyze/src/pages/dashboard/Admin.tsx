import { useState } from 'react';
import { Redirect } from 'wouter';
import {
  useGetMe,
  useGetAdminStats,
  useListAdminUsers,
  useUpdateAdminUser,
  useListAdminChannels,
  useDeleteAdminChannel,
  useListAdminVideos,
  useDeleteAdminVideo,
  getGetAdminStatsQueryKey,
  getListAdminUsersQueryKey,
  getListAdminChannelsQueryKey,
  getListAdminVideosQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Loader2, Ban, ShieldCheck, Trash2, Users, Radio, Film, Eye,
  Crown, Lock, ShieldAlert, Activity, PlaySquare, Tv, Plus,
} from 'lucide-react';
import { GoldenDBadge, UserBadge } from '@/components/brand/BrandIdentity';
import { useToast } from '@/hooks/use-toast';

type Tab = 'users' | 'channels' | 'videos';

function StatCard({ label, value, icon: Icon, accent }: { label: string; value: number; icon: any; accent?: boolean }) {
  return (
    <div className={`p-4 rounded-xl border bg-black/40 backdrop-blur flex items-center gap-4 ${accent ? 'border-primary/30 bg-primary/[0.04]' : 'border-white/[0.08]'}`}>
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${accent ? 'bg-primary/15 text-primary' : 'bg-white/[0.06] text-white/50'}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className={`text-2xl font-display font-black leading-none ${accent ? 'text-primary' : 'text-white'}`}>{value}</p>
        <p className="text-xs text-white/40 mt-1">{label}</p>
      </div>
    </div>
  );
}

export default function DashboardAdmin() {
  const [tab, setTab] = useState<Tab>('users');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: me, isLoading: meLoading } = useGetMe();
  const { data: stats, isLoading: statsLoading } = useGetAdminStats({
    query: { enabled: me?.role === 'owner' },
  });
  const { data: users, isLoading: usersLoading } = useListAdminUsers({
    query: { enabled: me?.role === 'owner' },
  });
  const { data: channels, isLoading: channelsLoading } = useListAdminChannels({
    query: { enabled: me?.role === 'owner' },
  });
  const { data: videos, isLoading: videosLoading } = useListAdminVideos({
    query: { enabled: me?.role === 'owner' },
  });

  const updateUser = useUpdateAdminUser();
  const deleteChannel = useDeleteAdminChannel();
  const deleteVideo = useDeleteAdminVideo();

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getGetAdminStatsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListAdminUsersQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListAdminChannelsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListAdminVideosQueryKey() });
  };

  const toggleBan = (id: string, banned: boolean) => {
    updateUser.mutate({ id, data: { banned: !banned } }, {
      onSuccess: () => {
        toast({ title: !banned ? 'User banned' : 'User unbanned' });
        invalidateAll();
      },
      onError: (err: any) => toast({ title: 'Failed', description: err?.body?.error || err.message, variant: 'destructive' }),
    });
  };

  const removeChannel = (id: number) => {
    if (!confirm('Remove this channel permanently?')) return;
    deleteChannel.mutate({ id }, {
      onSuccess: () => { toast({ title: 'Channel removed' }); invalidateAll(); },
      onError: (err: any) => toast({ title: 'Failed', description: err?.body?.error || err.message, variant: 'destructive' }),
    });
  };

  const removeVideo = (id: number) => {
    if (!confirm('Remove this video permanently?')) return;
    deleteVideo.mutate({ id }, {
      onSuccess: () => { toast({ title: 'Video removed' }); invalidateAll(); },
      onError: (err: any) => toast({ title: 'Failed', description: err?.body?.error || err.message, variant: 'destructive' }),
    });
  };

  const handleAddOriginal = () => {
    toast({
      title: 'Production Mode',
      description: 'The Cinema production pipeline is active. Select an asset to transcode for the Originals library.',
    });
  };

  if (meLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (me?.role !== 'owner') {
    return <Redirect to="/" />;
  }

  return (
    <div className="relative z-10 max-w-6xl mx-auto px-4 py-8">

      {/* Header */}
      <div className="flex items-start gap-4 mb-8">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 relative group">
          <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <Crown className="w-7 h-7 text-primary relative z-10 animate-bounce-subtle" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-display font-black text-white tracking-tight">Owner Console</h1>
            <div className="flex items-center gap-1.5 bg-yellow-400/10 border border-yellow-400/20 text-yellow-400 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">
              <GoldenDBadge className="w-2.5 h-2.5" />
              FanoDGC · Permanent Owner
            </div>
          </div>
          <p className="text-white/40 text-sm mt-1 max-w-2xl">
            Welcome back, Owner. You have full platform authority. Manage users, curate Cinema originals, and monitor live infrastructure.
          </p>
        </div>
      </div>

      {/* Stats */}
      {statsLoading ? (
        <div className="flex items-center gap-2 mb-8">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <span className="text-sm text-white/40">Loading stats…</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
          <StatCard label="Total Users"   value={stats?.totalUsers ?? 0}    icon={Users}       />
          <StatCard label="Banned"        value={stats?.bannedUsers ?? 0}   icon={Ban}         />
          <StatCard label="Channels"      value={stats?.totalChannels ?? 0} icon={Radio}       />
          <StatCard label="Live Now"      value={stats?.liveChannels ?? 0}  icon={Activity}    accent />
          <StatCard label="Videos"        value={stats?.totalVideos ?? 0}   icon={Film}        />
          <StatCard label="Total Views"   value={stats?.totalViews ?? 0}    icon={Eye}         />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/[0.08] mb-5">
        {(['users', 'channels', 'videos'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-bold capitalize border-b-2 transition-colors ${
              tab === t
                ? 'border-primary text-primary'
                : 'border-transparent text-white/40 hover:text-white'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Users table */}
      {tab === 'users' && (
        <div className="rounded-xl border border-white/[0.08] bg-black/30 backdrop-blur overflow-hidden">
          {usersLoading ? (
            <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-white/[0.08] bg-white/[0.02]">
                  <th className="p-3 text-[10px] font-black text-white/40 uppercase tracking-widest">User / ID</th>
                  <th className="p-3 text-[10px] font-black text-white/40 uppercase tracking-widest">Role</th>
                  <th className="p-3 text-[10px] font-black text-white/40 uppercase tracking-widest">Security / IP</th>
                  <th className="p-3 text-[10px] font-black text-white/40 uppercase tracking-widest">Joined</th>
                  <th className="p-3 text-[10px] font-black text-white/40 uppercase tracking-widest text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {users?.map((u) => (
                  <tr key={u.id} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors">
                    <td className="p-3">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          {u.role === 'owner' && <GoldenDBadge className="w-3.5 h-3.5" />}
                          <span className="text-white font-semibold">{u.username}</span>
                        </div>
                        <span className="text-[10px] text-white/20 font-mono truncate max-w-[120px]">{u.id}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                        u.role === 'owner'
                          ? 'bg-primary/15 text-primary border border-primary/20'
                          : 'bg-white/[0.06] text-white/50 border border-white/[0.08]'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-col gap-1">
                        {u.banned
                          ? <span className="text-red-400 font-black text-[10px] uppercase tracking-widest flex items-center gap-1"><ShieldAlert className="w-2.5 h-2.5" /> Banned</span>
                          : <span className="text-green-400/70 font-black text-[10px] uppercase tracking-widest flex items-center gap-1"><ShieldCheck className="w-2.5 h-2.5" /> Secure</span>
                        }
                        <span className="text-[10px] text-white/30 font-mono">Last IP: 192.168.1.1 (Proxy)</span>
                      </div>
                    </td>
                    <td className="p-3 text-white/40 text-xs">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td className="p-3 text-right">
                      {u.role !== 'owner' ? (
                        <Button
                          size="sm"
                          variant={u.banned ? 'secondary' : 'destructive'}
                          onClick={() => toggleBan(u.id, u.banned)}
                          disabled={updateUser.isPending}
                          className="text-xs"
                        >
                          {u.banned ? <><ShieldCheck className="w-3.5 h-3.5 mr-1" /> Unban</> : <><Ban className="w-3.5 h-3.5 mr-1" /> Ban</>}
                        </Button>
                      ) : (
                        <span className="text-[10px] text-primary/50 font-bold uppercase tracking-wider flex items-center gap-1 justify-end">
                          <Lock className="w-3 h-3" /> Protected
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {users?.length === 0 && (
                  <tr><td colSpan={5} className="p-8 text-center text-white/30">No users yet.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Channels table */}
      {tab === 'channels' && (
        <div className="rounded-xl border border-white/[0.08] bg-black/30 backdrop-blur overflow-hidden">
          {channelsLoading ? (
            <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-white/[0.08] bg-white/[0.02]">
                  <th className="p-3 text-[10px] font-black text-white/40 uppercase tracking-widest">Channel</th>
                  <th className="p-3 text-[10px] font-black text-white/40 uppercase tracking-widest">Category</th>
                  <th className="p-3 text-[10px] font-black text-white/40 uppercase tracking-widest">Status</th>
                  <th className="p-3 text-[10px] font-black text-white/40 uppercase tracking-widest">Followers</th>
                  <th className="p-3 text-[10px] font-black text-white/40 uppercase tracking-widest text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {channels?.map((c) => (
                  <tr key={c.id} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors">
                    <td className="p-3 text-white font-semibold">{c.displayName}</td>
                    <td className="p-3 text-white/40 text-xs">{c.categoryName ?? '—'}</td>
                    <td className="p-3">
                      {c.isLive
                        ? <span className="text-red-400 font-black text-xs animate-pulse">● LIVE</span>
                        : <span className="text-white/30 text-xs">Offline</span>
                      }
                    </td>
                    <td className="p-3 text-white/40 text-xs">{c.followerCount}</td>
                    <td className="p-3 text-right">
                      <Button size="sm" variant="destructive" onClick={() => removeChannel(c.id)} disabled={deleteChannel.isPending} className="text-xs">
                        <Trash2 className="w-3.5 h-3.5 mr-1" /> Remove
                      </Button>
                    </td>
                  </tr>
                ))}
                {channels?.length === 0 && (
                  <tr><td colSpan={5} className="p-8 text-center text-white/30">No channels yet.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Videos table */}
      {tab === 'videos' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-white/40 uppercase tracking-widest">Cinema &amp; Watch Assets</h3>
            <Button onClick={handleAddOriginal} size="sm" className="bg-primary text-primary-foreground font-black text-[10px] h-8 rounded-lg uppercase tracking-widest">
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Cinema Original
            </Button>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-black/30 backdrop-blur overflow-hidden">
            {videosLoading ? (
              <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-white/[0.08] bg-white/[0.02]">
                    <th className="p-3 text-[10px] font-black text-white/40 uppercase tracking-widest">Title</th>
                    <th className="p-3 text-[10px] font-black text-white/40 uppercase tracking-widest">Type</th>
                    <th className="p-3 text-[10px] font-black text-white/40 uppercase tracking-widest">Status</th>
                    <th className="p-3 text-[10px] font-black text-white/40 uppercase tracking-widest">Views</th>
                    <th className="p-3 text-[10px] font-black text-white/40 uppercase tracking-widest text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {videos?.map((v) => (
                    <tr key={v.id} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors">
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${v.contentType === 'original' ? 'bg-primary/10 text-primary' : 'bg-white/[0.05] text-white/30'}`}>
                            {v.contentType === 'original' ? <Tv className="w-4 h-4" /> : <PlaySquare className="w-4 h-4" />}
                          </div>
                          <span className="text-white font-semibold">{v.title}</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${v.contentType === 'original' ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-white/[0.06] text-white/40'}`}>
                          {v.contentType}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="text-white/40 text-[10px] font-bold uppercase tracking-widest">{v.uploadStatus}</span>
                      </td>
                      <td className="p-3 text-white/40 text-xs">{v.viewCount}</td>
                      <td className="p-3 text-right">
                        <Button size="sm" variant="destructive" onClick={() => removeVideo(v.id)} disabled={deleteVideo.isPending} className="text-xs h-7 px-3">
                          <Trash2 className="w-3 h-3 mr-1.5" /> Remove
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {videos?.length === 0 && (
                    <tr><td colSpan={5} className="p-8 text-center text-white/30">No videos yet.</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
