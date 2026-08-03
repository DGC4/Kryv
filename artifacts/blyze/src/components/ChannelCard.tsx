import { Link } from 'wouter';
import type { ChannelSummary } from '@workspace/api-client-react';
import { Users } from 'lucide-react';

export function ChannelCard({ channel }: { channel: ChannelSummary }) {
  return (
    <Link href={`/live/${channel.slug || channel.id}`} className="group block">
      {/* Thumbnail */}
      <div className="relative aspect-video rounded-lg overflow-hidden bg-white/[0.04] mb-3 border border-white/[0.06] group-hover:border-primary/40 transition-all duration-300 group-hover:shadow-[0_0_20px_hsl(var(--primary)/0.15)]">
        {channel.bannerUrl ? (
          <img
            src={channel.bannerUrl}
            alt={channel.displayName}
            className="w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-[1.02] transition-all duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-black/60">
            <span className="font-black text-5xl text-white/10 select-none">{channel.displayName[0]}</span>
          </div>
        )}

        {/* Live badge */}
        {channel.isLive && (
          <div className="absolute top-2 left-2 flex items-center gap-1.5">
            <span className="bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded tracking-widest uppercase shadow-[0_0_8px_rgba(220,38,38,0.6)]">
              LIVE
            </span>
            {channel.viewerCount > 0 && (
              <span className="bg-black/70 backdrop-blur text-white text-[10px] font-semibold px-2 py-0.5 rounded flex items-center gap-1">
                <Users className="w-2.5 h-2.5" />
                {channel.viewerCount.toLocaleString()}
              </span>
            )}
          </div>
        )}

        {/* Bottom gradient */}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      {/* Info row */}
      <div className="flex gap-2.5">
        <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 border border-white/[0.08] mt-0.5">
          {channel.avatarUrl ? (
            <img src={channel.avatarUrl} alt={channel.displayName} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-primary/20 text-primary font-bold text-sm">
              {channel.displayName[0]}
            </div>
          )}
        </div>
        <div className="flex flex-col min-w-0">
          <h3 className="text-white text-sm font-semibold line-clamp-2 leading-snug group-hover:text-primary transition-colors">
            {channel.streamTitle || `${channel.displayName}'s stream`}
          </h3>
          <p className="text-white/50 text-xs mt-0.5 truncate">{channel.displayName}</p>
          {channel.categoryName && (
            <p className="text-white/35 text-xs truncate hover:text-primary transition-colors cursor-pointer">
              {channel.categoryName}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
