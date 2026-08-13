import { useGetMe, useListVideos, useCreateVideo, useDeleteVideo, useListCategories } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { BarChart3, CircleCheck, Eye, Film, Link2, Loader2, ShieldCheck, Trash2, Tv, UploadCloud, Youtube } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function DashboardWatch() {
  const { data: me } = useGetMe();
  const channelId = me?.channel?.id;
  const { data: videos, refetch: refetchVideos, isLoading: videosLoading } = useListVideos({ channelId }, { query: { enabled: !!channelId } });
  const { data: categories } = useListCategories({ kind: 'genre' });
  const createVideo = useCreateVideo();
  const deleteVideo = useDeleteVideo();
  const { toast } = useToast();

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined);
  const [source, setSource] = useState<'fastpix' | 'youtube'>('fastpix');
  const [youtubeVideoId, setYoutubeVideoId] = useState('');
  const [rightsAttested, setRightsAttested] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const library = videos ?? [];
  const libraryViews = library.reduce((total, video) => total + video.viewCount, 0);
  const readyReleases = library.filter((video) => video.uploadStatus === 'ready').length;
  const processingReleases = library.filter((video) => video.uploadStatus === 'waiting' || video.uploadStatus === 'processing').length;
  const youtubeReleases = library.filter((video) => video.playbackSource === 'youtube').length;

  const resetForm = () => {
    setTitle('');
    setCategoryId(undefined);
    setYoutubeVideoId('');
    setRightsAttested(false);
    setUploadProgress(0);
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !me?.channel) return;
    if (!title.trim()) {
      toast({ title: 'Title required', description: 'Add a Watch title before selecting a file.', variant: 'destructive' });
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress(0);
      const videoRecord = await createVideo.mutateAsync({ data: { title: title.trim(), categoryId, contentType: 'upload', playbackSource: 'fastpix' } });
      if (!videoRecord.uploadUrl) throw new Error('No FastPix upload URL was issued.');
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', videoRecord.uploadUrl);
        xhr.upload.onprogress = (progressEvent) => {
          if (progressEvent.lengthComputable) setUploadProgress(Math.round((progressEvent.loaded / progressEvent.total) * 100));
        };
        xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed with status ${xhr.status}`));
        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.send(file);
      });
      toast({ title: 'Upload accepted', description: 'FastPix processing must complete before this release appears as ready to play.' });
      resetForm();
      refetchVideos();
    } catch (error: any) {
      toast({ title: 'Upload could not start', description: error?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const publishYoutube = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !youtubeVideoId.trim() || !rightsAttested) return;
    try {
      await createVideo.mutateAsync({ data: { title: title.trim(), categoryId, contentType: 'upload', playbackSource: 'youtube', youtubeVideoId: youtubeVideoId.trim(), rightsAttested: true } });
      toast({ title: 'Official YouTube embed added', description: 'The rights-attested source is now available in Kryv Watch.' });
      resetForm();
      refetchVideos();
    } catch (error: any) {
      toast({ title: 'YouTube source rejected', description: error?.body?.error || error?.message || 'Confirm the official video ID and rights attestation.', variant: 'destructive' });
    }
  };

  const handleDelete = (id: number) => {
    if (!confirm('Delete this Watch release?')) return;
    deleteVideo.mutate({ id }, { onSuccess: () => { toast({ title: 'Video deleted' }); refetchVideos(); }, onError: (error: any) => toast({ title: 'Video could not be deleted', description: error?.body?.error || error?.message, variant: 'destructive' }) });
  };

  if (!me?.channel) return <div className="container relative z-10 mx-auto max-w-4xl space-y-4 px-4 py-8 text-center"><h1 className="text-3xl font-display font-bold text-white">Creator Dashboard</h1><p className="text-muted-foreground">Create a channel in the Live Dashboard before publishing to Watch.</p><Button asChild><a href="/dashboard/live">Go to Live Dashboard</a></Button></div>;

  return (
    <div className="relative z-10 mx-auto max-w-6xl px-4 py-6 sm:py-8"><div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><div className="flex items-center gap-2 text-primary"><Tv className="h-4 w-4" /><span className="text-[11px] font-black uppercase tracking-[0.18em]">Creator publishing</span></div><h1 className="mt-1 text-3xl font-black text-white sm:text-4xl">Kryv Watch manager</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/50">Publish processed FastPix uploads or rights-cleared official YouTube embeds. Cinema originals remain in the owner-controlled Cinema desk.</p></div></div>
      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4"><div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3"><p className="text-xl font-black text-white">{library.length}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-white/40">All releases</p></div><div className="rounded-xl border border-emerald-300/15 bg-emerald-300/[0.04] p-3"><p className="text-xl font-black text-emerald-100">{readyReleases}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-white/40">Ready to play</p></div><div className="rounded-xl border border-amber-300/15 bg-amber-300/[0.04] p-3"><p className="text-xl font-black text-amber-100">{processingReleases}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-white/40">Processing</p></div><div className="rounded-xl border border-primary/20 bg-primary/[0.05] p-3"><div className="flex items-center gap-1.5"><Eye className="h-4 w-4 text-primary" /><p className="text-xl font-black text-primary">{libraryViews.toLocaleString()}</p></div><p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-white/40">Recorded views</p></div></section>
      <p className="mt-3 flex items-center gap-1.5 text-xs leading-relaxed text-white/40"><BarChart3 className="h-3.5 w-3.5 text-primary" /> Library figures use current Watch records only: {youtubeReleases} official YouTube {youtubeReleases === 1 ? 'embed' : 'embeds'} and no estimated watch-time or revenue.</p>
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]"><section className="rounded-2xl border border-white/[0.1] bg-black/35 p-5 backdrop-blur sm:p-6"><div className="flex items-center gap-2"><UploadCloud className="h-5 w-5 text-primary" /><h2 className="text-lg font-black text-white">Add a Watch release</h2></div><div className="mt-5 space-y-4"><label className="block text-sm font-bold text-white/70">Title<input type="text" value={title} onChange={event => setTitle(event.target.value)} disabled={isUploading || createVideo.isPending} maxLength={100} className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-white outline-none focus:border-primary/60" placeholder="Release title" /></label><label className="block text-sm font-bold text-white/70">Category / genre<select value={categoryId || ''} onChange={event => setCategoryId(event.target.value ? Number(event.target.value) : undefined)} disabled={isUploading || createVideo.isPending} className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-white outline-none focus:border-primary/60"><option value="">Select category</option>{categories?.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><div><p className="text-sm font-bold text-white/70">Playback source</p><div className="mt-2 grid grid-cols-2 gap-2"><button type="button" onClick={() => setSource('fastpix')} disabled={isUploading || createVideo.isPending} className={`rounded-xl border p-3 text-left transition ${source === 'fastpix' ? 'border-primary bg-primary/10 text-primary' : 'border-white/10 bg-white/[0.03] text-white/50 hover:text-white'}`}><UploadCloud className="h-4 w-4" /><p className="mt-2 text-xs font-black">FastPix upload</p><p className="mt-1 text-[10px] leading-relaxed opacity-75">Upload a file for processing.</p></button><button type="button" onClick={() => setSource('youtube')} disabled={isUploading || createVideo.isPending} className={`rounded-xl border p-3 text-left transition ${source === 'youtube' ? 'border-red-300/60 bg-red-500/[0.1] text-red-100' : 'border-white/10 bg-white/[0.03] text-white/50 hover:text-white'}`}><Youtube className="h-4 w-4" /><p className="mt-2 text-xs font-black">Official YouTube</p><p className="mt-1 text-[10px] leading-relaxed opacity-75">Embed a rights-cleared release.</p></button></div></div>
        {source === 'fastpix' ? <div className="border-t border-white/[0.08] pt-4"><input type="file" accept="video/*" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />{isUploading ? <div className="space-y-2"><div className="flex justify-between text-sm"><span className="font-medium text-primary">Uploading to FastPix…</span><span className="font-mono text-white">{uploadProgress}%</span></div><div className="h-2 w-full overflow-hidden rounded-full bg-white/10"><div className="h-full bg-primary transition-all duration-300" style={{ width: `${uploadProgress}%` }} /></div></div> : <Button type="button" onClick={() => fileInputRef.current?.click()} disabled={!title.trim() || createVideo.isPending} className="h-12 w-full font-black"><UploadCloud className="mr-2 h-5 w-5" /> Select video file</Button>}<p className="mt-3 text-[11px] leading-relaxed text-white/40">The release stays in processing until FastPix reports a playable asset.</p></div> : <form onSubmit={publishYoutube} className="space-y-3 border-t border-white/[0.08] pt-4"><label className="block text-sm font-bold text-white/70">Official YouTube video ID<input value={youtubeVideoId} onChange={event => setYoutubeVideoId(event.target.value)} maxLength={32} placeholder="dQw4w9WgXcQ" className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 font-mono text-sm text-white outline-none focus:border-red-300/60" /></label><label className="flex cursor-pointer items-start gap-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-3"><input type="checkbox" checked={rightsAttested} onChange={event => setRightsAttested(event.target.checked)} className="mt-0.5 h-4 w-4 accent-primary" /><span className="text-xs leading-relaxed text-amber-50/85"><b className="font-black">Rights attestation.</b> I control this official source or have written permission to embed it in Kryv Watch. I understand this does not create a Cinema catalog title.</span></label><Button type="submit" disabled={createVideo.isPending || !title.trim() || !youtubeVideoId.trim() || !rightsAttested} className="h-11 w-full bg-red-500 font-black text-white hover:bg-red-500/90">{createVideo.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Youtube className="mr-2 h-4 w-4" /> Add official YouTube embed</>}</Button></form>}<div className="mt-5 flex gap-3 rounded-xl border border-white/[0.08] bg-white/[0.025] p-3"><ShieldCheck className="h-4 w-4 shrink-0 text-primary" /><p className="text-[11px] leading-relaxed text-white/45"><b className="text-white/70">Cinema boundary:</b> global Cinema titles are owner/production catalog entries. Creator uploads and YouTube embeds publish to Watch only.</p></div></div></section>
        <section className="min-h-[500px] rounded-2xl border border-white/[0.1] bg-black/35 p-5 backdrop-blur sm:p-6"><div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-black text-white">Your Watch releases</h2><p className="mt-1 text-xs text-white/40">Processing and readiness status from the source of record.</p></div><span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[10px] font-black text-white/50">{videos?.length ?? 0}</span></div>{videosLoading ? <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : videos?.length ? <div className="mt-5 space-y-3">{videos.map(video => <article key={video.id} className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3"><div className="relative flex aspect-video w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-black">{video.thumbnailUrl ? <img src={video.thumbnailUrl} alt={video.title} className="h-full w-full object-cover" /> : video.playbackSource === 'youtube' ? <Youtube className="h-6 w-6 text-red-300" /> : <Film className="h-6 w-6 text-white/20" />}</div><div className="min-w-0 flex-1"><h3 className="truncate text-sm font-black text-white">{video.title}</h3><div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-wider"><span className={`rounded px-1.5 py-0.5 ${video.uploadStatus === 'ready' ? 'bg-emerald-400/15 text-emerald-200' : video.uploadStatus === 'errored' ? 'bg-red-400/15 text-red-200' : 'bg-amber-400/15 text-amber-100'}`}>{video.uploadStatus}</span><span className="inline-flex items-center gap-1 text-white/45">{video.playbackSource === 'youtube' ? <Youtube className="h-3 w-3 text-red-300" /> : <Link2 className="h-3 w-3 text-primary" />}{video.playbackSource}</span>{video.playbackSource === 'youtube' && <span className="inline-flex items-center gap-1 text-emerald-200"><CircleCheck className="h-3 w-3" /> Attested</span>}<span className="text-white/35">{video.viewCount} views</span></div></div><Button type="button" variant="ghost" size="icon" onClick={() => handleDelete(video.id)} disabled={deleteVideo.isPending} className="shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></Button></article>)}</div> : <div className="flex flex-col items-center justify-center py-24 text-center"><Film className="h-12 w-12 text-white/10" /><p className="mt-4 text-sm text-white/45">No Watch releases yet.</p><p className="mt-1 max-w-sm text-xs leading-relaxed text-white/30">Start with a FastPix upload or an official rights-cleared YouTube embed. Kryv does not create placeholder inventory.</p></div>}</section></div>
    </div>
  );
}
