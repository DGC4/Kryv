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
import { Loader2, ShieldAlert, Ban, ShieldCheck, Trash2, Users, Radio, Film, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type Tab = 'users' | 'channels' | 'videos';

function StatCard({ label, value, icon: Icon }: { label: string; value: number; icon: any }) {
  return (
    <div className="p-4 rounded-xl border border-white/10 bg-black/40 backdrop-blur flex items-center gap-4">
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-display font-bold text-white leading-none">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{label}</p>
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
      onError: (err: any) => toast({ title: 'Failed', description: err.message, variant: 'destructive' }),
    });
  };

  const removeChannel = (id: number) => {
    if (!confirm('Remove this channel permanently?')) return;
    deleteChannel.mutate({ id }, {
      onSuccess: () => { toast({ title: 'Channel removed' }); invalidateAll(); },
      onError: (err: any) => toast({ title: 'Failed', description: err.message, variant: 'destructive' }),
    });
  };

  const removeVideo = (id: number) => {
    if (!confirm('Remove this video permanently?')) return;
    deleteVideo.mutate({ id }, {
      onSuccess: () => { toast({ title: 'Video removed' }); invalidateAll(); },
      onError: (err: any) => toast({ title: 'Failed', description: err.message, variant: 'destructive' }),
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
    <div className="container mx-auto px-4 py-8 max-w-6xl relative z-10">
      <div className="flex items-center gap-3 mb-2">
        <ShieldAlert className="w-7 h-7 text-primary" />
        <h1 className="text-4xl font-display font-bold text-white">Owner Console</h1>
      </div>
      <p className="text-muted-foreground mb-8">Full backend visibility and moderation for Kryv — owner access only.</p>

      {statsLoading ? (
        <Loader2 className="w-6 h-6 animate-spin text-primary mb-8" />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <StatCard label="Total users" value={stats?.totalUsers ?? 0} icon={Users} />
          <StatCard label="Banned users" value={stats?.bannedUsers ?? 0} icon={Ban} />
          <StatCard label="Channels" value={stats?.totalChannels ?? 0} icon={Radio} />
          <StatCard label="Live now" value={stats?.liveChannels ?? 0} icon={Radio} />
          <StatCard label="Videos" value={stats?.totalVideos ?? 0} icon={Film} />
          <StatCard label="Total views" value={stats?.totalViews ?? 0} icon={Eye} />
        </div>
      )}

      <div className="flex gap-1 border-b border-white/10 mb-6">
        {(['users', 'channels', 'videos'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${
              tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-white'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'users' && (
        <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur overflow-hidden">
          {usersLoading ? (
            <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-white/10">
                  <th className="p-3 font-medium">Username</th>
                  <th className="p-3 font-medium">Role</th>
                  <th className="p-3 font-medium">Status</th>
                  <th className="p-3 font-medium">Joined</th>
                  <th className="p-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {users?.map((u) => (
                  <tr key={u.id} className="border-b border-white/5 last:border-0">
                    <td className="p-3 text-white font-medium">{u.username}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${u.role === 'owner' ? 'bg-primary/20 text-primary' : 'bg-white/10 text-muted-foreground'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="p-3">
                      {u.banned ? <span className="text-destructive font-medium">Banned</span> : <span className="text-muted-foreground">Active</span>}
                    </td>
                    <td className="p-3 text-muted-foreground">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td className="p-3 text-right">
                      {u.role !== 'owner' && (
                        <Button
                          size="sm"
                          variant={u.banned ? 'secondary' : 'destructive'}
                          onClick={() => toggleBan(u.id, u.banned)}
                          disabled={updateUser.isPending}
                        >
                          {u.banned ? <ShieldCheck className="w-4 h-4 mr-1" /> : <Ban className="w-4 h-4 mr-1" />}
                          {u.banned ? 'Unban' : 'Ban'}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {users?.length === 0 && (
                  <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No users yet.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'channels' && (
        <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur overflow-hidden">
          {channelsLoading ? (
            <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-white/10">
                  <th className="p-3 font-medium">Channel</th>
                  <th className="p-3 font-medium">Category</th>
                  <th className="p-3 font-medium">Live</th>
                  <th className="p-3 font-medium">Followers</th>
                  <th className="p-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {channels?.map((c) => (
                  <tr key={c.id} className="border-b border-white/5 last:border-0">
                    <td className="p-3 text-white font-medium">{c.displayName}</td>
                    <td className="p-3 text-muted-foreground">{c.categoryName ?? '—'}</td>
                    <td className="p-3">{c.isLive ? <span className="text-primary font-bold">LIVE</span> : <span className="text-muted-foreground">Offline</span>}</td>
                    <td className="p-3 text-muted-foreground">{c.followerCount}</td>
                    <td className="p-3 text-right">
                      <Button size="sm" variant="destructive" onClick={() => removeChannel(c.id)} disabled={deleteChannel.isPending}>
                        <Trash2 className="w-4 h-4 mr-1" /> Remove
                      </Button>
                    </td>
                  </tr>
                ))}
                {channels?.length === 0 && (
                  <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No channels yet.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'videos' && (
        <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur overflow-hidden">
          {videosLoading ? (
            <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-white/10">
                  <th className="p-3 font-medium">Title</th>
                  <th className="p-3 font-medium">Type</th>
                  <th className="p-3 font-medium">Status</th>
                  <th className="p-3 font-medium">Views</th>
                  <th className="p-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {videos?.map((v) => (
                  <tr key={v.id} className="border-b border-white/5 last:border-0">
                    <td className="p-3 text-white font-medium">{v.title}</td>
                    <td className="p-3 text-muted-foreground capitalize">{v.contentType}</td>
                    <td className="p-3 text-muted-foreground capitalize">{v.uploadStatus}</td>
                    <td className="p-3 text-muted-foreground">{v.viewCount}</td>
                    <td className="p-3 text-right">
                      <Button size="sm" variant="destructive" onClick={() => removeVideo(v.id)} disabled={deleteVideo.isPending}>
                        <Trash2 className="w-4 h-4 mr-1" /> Remove
                      </Button>
                    </td>
                  </tr>
                ))}
                {videos?.length === 0 && (
                  <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No videos yet.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
