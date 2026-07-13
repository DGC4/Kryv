import { Link } from 'wouter';
import { ChannelSummary } from '@workspace/api-client-react/src/generated/api.schemas';
import { Users } from 'lucide-react';

export function ChannelCard({ channel }: { channel: ChannelSummary }) {
  return (
    <Link href={`/live/${channel.slug || channel.id}`} className="group block">
      <div className="relative aspect-video rounded-xl overflow-hidden bg-white/5 border border-white/5 mb-3 group-hover:border-primary/50 transition-colors">
        {channel.bannerUrl ? (
          <img src={channel.bannerUrl} alt={channel.displayName} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-black/40">
            <span className="font-display text-4xl text-white/20 font-bold">{channel.displayName[0]}</span>
          </div>
        )}
        
        {channel.isLive && (
          <div className="absolute top-2 left-2 bg-destructive text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider animate-pulse">
            Live
          </div>
        )}
        
        {channel.isLive && channel.viewerCount > 0 && (
          <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur text-white text-xs font-medium px-2 py-1 rounded flex items-center gap-1">
            <Users className="w-3 h-3" />
            {channel.viewerCount.toLocaleString()}
          </div>
        )}
      </div>
      
      <div className="flex gap-3">
        <div className="w-10 h-10 rounded-full bg-white/10 overflow-hidden shrink-0 border border-white/5">
          {channel.avatarUrl ? (
            <img src={channel.avatarUrl} alt={channel.displayName} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-primary/20 text-primary font-bold">
              {channel.displayName[0]}
            </div>
          )}
        </div>
        <div className="flex flex-col min-w-0">
          <h3 className="text-white font-bold truncate group-hover:text-primary transition-colors">
            {channel.streamTitle || `${channel.displayName}'s stream`}
          </h3>
          <p className="text-muted-foreground text-sm truncate">{channel.displayName}</p>
          {channel.categoryName && (
            <p className="text-muted-foreground text-xs truncate mt-0.5">{channel.categoryName}</p>
          )}
        </div>
      </div>
    </Link>
  );
}
