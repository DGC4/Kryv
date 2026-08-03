import { useEffect, useRef, useState } from 'react';
import { useParams } from 'wouter';
import { useGetChannelBySlug, useListChannelMessages, useCreateChannelMessage, useFollowChannel, useUnfollowChannel } from '@workspace/api-client-react';
import { useAuthStore } from '@/lib/auth-store';
import MuxPlayer from '@mux/mux-player-react';
import { Loader2, Users, Heart, Share2, Send } from 'lucide-react';
import { GoldenDBadge } from '@/components/brand/BrandIdentity';
import { Button } from '@/components/ui/button';

export default function LiveChannel() {
  const { channelSlugOrId } = useParams<{ channelSlugOrId: string }>();
  const { user } = useAuthStore();
  const isSignedIn = !!user;
  
  const { data: channel, isLoading } = useGetChannelBySlug(channelSlugOrId || '', {
    query: { enabled: !!channelSlugOrId, refetchInterval: 10000 }
  });
  
  const channelId = channel?.id;
  
  const { data: messages, refetch: refetchMessages } = useListChannelMessages(channelId!, {
    query: { enabled: !!channelId, refetchInterval: 3000 }
  });
  
  const createMessage = useCreateChannelMessage();
  const follow = useFollowChannel();
  const unfollow = useUnfollowChannel();
  
  const [chatInput, setChatInput] = useState('');
  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !channelId) return;
    
    createMessage.mutate({
      id: channelId,
      data: { message: chatInput }
    }, {
      onSuccess: () => {
        setChatInput('');
        refetchMessages();
      }
    });
  };

  const handleFollowToggle = () => {
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

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100dvh-4rem)] overflow-hidden bg-background relative z-10">
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <div className="w-full bg-black aspect-video relative">
          {channel.isLive && channel.playbackId ? (
            <MuxPlayer
              playbackId={channel.playbackId}
              streamType="live"
              autoPlay
              muted
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center">
              {channel.bannerUrl && (
                <img src={channel.bannerUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20 blur-md" />
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
                <h2 className="text-2xl font-display font-bold text-white mb-2">{channel.displayName} is offline</h2>
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
                {channel.viewerCount.toLocaleString()}
              </span>
            </div>
          )}
        </div>

        <div className="p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="flex gap-4">
              <div className="w-16 h-16 rounded-full bg-white/10 overflow-hidden shrink-0 border border-white/10">
                {channel.avatarUrl ? (
                  <img src={channel.avatarUrl} alt={channel.displayName} className="w-full h-full object-cover" />
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
                variant={channel.isFollowing ? "secondary" : "default"}
                onClick={handleFollowToggle}
                disabled={!isSignedIn || follow.isPending || unfollow.isPending}
                className="font-bold"
              >
                <Heart className={`w-4 h-4 mr-2 ${channel.isFollowing ? 'fill-current' : ''}`} />
                {channel.isFollowing ? 'Following' : 'Follow'}
              </Button>
              <Button variant="secondary" size="icon">
                <Share2 className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {channel.description && (
            <div className="mt-8 p-6 bg-white/5 border border-white/5 rounded-xl">
              <h3 className="font-bold text-white mb-2">About {channel.displayName}</h3>
              <p className="text-muted-foreground whitespace-pre-wrap">{channel.description}</p>
            </div>
          )}
        </div>
      </div>

      {/* Chat Sidebar */}
      <div className="w-full lg:w-80 xl:w-96 border-l border-white/10 bg-black/40 backdrop-blur flex flex-col h-[50dvh] lg:h-auto shrink-0">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <h3 className="font-display font-bold text-white">Stream Chat</h3>
          <Users className="w-4 h-4 text-muted-foreground" />
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={chatScrollRef}>
          {messages?.map((msg) => (
            <div key={msg.id} className="text-sm flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5">
                {msg.username.toLowerCase().includes('fano') && <GoldenDBadge className="w-3.5 h-3.5" />}
                <span className="font-bold text-primary">{msg.username}</span>
              </div>
              <span className="text-white/90 break-words">{msg.message}</span>
            </div>
          ))}
          {(!messages || messages.length === 0) && (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm text-center px-4">
              Welcome to the chat room!
            </div>
          )}
        </div>

        <div className="p-4 border-t border-white/10 bg-black/20">
          {isSignedIn ? (
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Send a message..."
                maxLength={500}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              />
              <Button type="submit" size="icon" disabled={!chatInput.trim() || createMessage.isPending}>
                <Send className="w-4 h-4" />
              </Button>
            </form>
          ) : (
            <div className="text-center p-3 bg-white/5 rounded-lg border border-white/5">
              <p className="text-sm text-muted-foreground mb-2">Sign in to chat</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
