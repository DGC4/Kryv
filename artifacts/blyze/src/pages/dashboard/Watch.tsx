import { useRef, useState } from 'react';
import { useGetMe, useListVideos, useCreateVideo, useDeleteVideo, useListCategories, useRefreshVideoProviderStatus, useListVideoMusicCredits, useCreateVideoMusicCredit, useDeleteVideoMusicCredit } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { BarChart3, CircleCheck, Eye, Film, Link2, Loader2, Music2, RefreshCw, ShieldCheck, Trash2, Tv, UploadCloud, Youtube } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { CreatorStudioNav } from '@/components/CreatorStudioNav';

export default function DashboardWatch() {
  const { data: me } = useGetMe();
  const channelId = me?.channel?.id;
  const { data: videoPage, refetch: refetchVideos, isLoading: videosLoading, isFetching: videosRefreshing } = useListVideos(
    { channelId },
    { query: { enabled: !!channelId, refetchInterval: 15000, refetchIntervalInBackground: false } },
  );
  const { data: categories } = useListCategories({ kind: 'genre' });
  const createVideo = useCreateVideo();
  const deleteVideo = useDeleteVideo();
  const refreshProviderStatus = useRefreshVideoProviderStatus();
  const createMusicCredit = useCreateVideoMusicCredit();
  const deleteMusicCredit = useDeleteVideoMusicCredit();
  const { toast } = useToast();

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined);
  const [source, setSource] = useState<'fastpix' | 'youtube'>('fastpix');
  const [youtubeVideoId, setYoutubeVideoId] = useState('');
  const [rightsAttested, setRightsAttested] = useState(false);
  const [libraryFilter, setLibraryFilter] = useState<'all' | 'ready' | 'processing' | 'errored'>('all');
  const [musicCreditVideoId, setMusicCreditVideoId] = useState<number | null>(null);
  const [musicCreditDraft, setMusicCreditDraft] = useState({ trackTitle: '', artistName: '', albumTitle: '', labelName: '', artworkUrl: '', sourceUrl: '', musicbrainzRecordingId: '', musicbrainzReleaseId: '', metadataSource: 'publisher_attested' as 'publisher_attested' | 'musicbrainz', rightsAttested: false });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const library = videoPage?.items ?? [];
  const libraryViews = library.reduce((total, video) => total + video.viewCount, 0);
  const readyReleases = library.filter((video) => video.uploadStatus === 'ready').length;
  const processingReleases = library.filter((video) => video.uploadStatus === 'waiting' || video.uploadStatus === 'processing').length;
  const youtubeReleases = library.filter((video) => video.playbackSource === 'youtube').length;
  const erroredReleases = library.filter((video) => video.uploadStatus === 'errored').length;
  const visibleLibrary = library.filter((video) => libraryFilter === 'all' || (libraryFilter === 'processing' ? video.uploadStatus === 'waiting' || video.uploadStatus === 'processing' : video.uploadStatus === libraryFilter));
  const musicCreditQuery = useListVideoMusicCredits(musicCreditVideoId ?? 0, { query: { enabled: musicCreditVideoId !== null } });

  const resetMusicCreditDraft = () => setMusicCreditDraft({ trackTitle: '', artistName: '', albumTitle: '', labelName: '', artworkUrl: '', sourceUrl: '', musicbrainzRecordingId: '', musicbrainzReleaseId: '', metadataSource: 'publisher_attested', rightsAttested: false });

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
      const uploadUrl = videoRecord.uploadUrl;
      if (!uploadUrl) throw new Error('No FastPix upload URL was issued.');
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', uploadUrl);
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

  const createMusicCreditForRelease = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!musicCreditVideoId || !musicCreditDraft.trackTitle.trim() || !musicCreditDraft.artistName.trim() || !musicCreditDraft.rightsAttested) return;
    try {
      await createMusicCredit.mutateAsync({ id: musicCreditVideoId, data: {
        trackTitle: musicCreditDraft.trackTitle.trim(),
        artistName: musicCreditDraft.artistName.trim(),
        ...(musicCreditDraft.albumTitle.trim() ? { albumTitle: musicCreditDraft.albumTitle.trim() } : {}),
        ...(musicCreditDraft.labelName.trim() ? { labelName: musicCreditDraft.labelName.trim() } : {}),
        ...(musicCreditDraft.artworkUrl.trim() ? { artworkUrl: musicCreditDraft.artworkUrl.trim() } : {}),
        ...(musicCreditDraft.sourceUrl.trim() ? { sourceUrl: musicCreditDraft.sourceUrl.trim() } : {}),
        ...(musicCreditDraft.musicbrainzRecordingId.trim() ? { musicbrainzRecordingId: musicCreditDraft.musicbrainzRecordingId.trim() } : {}),
        ...(musicCreditDraft.musicbrainzReleaseId.trim() ? { musicbrainzReleaseId: musicCreditDraft.musicbrainzReleaseId.trim() } : {}),
        metadataSource: musicCreditDraft.metadataSource,
        rightsAttested: true,
      } });
      resetMusicCreditDraft();
      await musicCreditQuery.refetch();
      toast({ title: 'Music information published', description: 'The attested credit will appear in More information on this Watch release.' });
    } catch (error: any) {
      toast({ title: 'Music credit could not be published', description: error?.body?.error || error?.message || 'Review the attestation and source links.', variant: 'destructive' });
    }
  };

  const removeMusicCredit = (creditId: number) => {
    if (!musicCreditVideoId || !confirm('Remove this music credit from the Watch release?')) return;
    deleteMusicCredit.mutate({ id: musicCreditVideoId, creditId }, {
      onSuccess: () => { void musicCreditQuery.refetch(); toast({ title: 'Music credit removed' }); },
      onError: (error: any) => toast({ title: 'Music credit could not be removed', description: error?.body?.error || error?.message || 'Try again.', variant: 'destructive' }),
    });
  };

  const handleDelete = (id: number) => {
    if (!confirm('Delete this Watch release?')) return;
    deleteVideo.mutate({ id }, { onSuccess: () => { toast({ title: 'Video deleted' }); refetchVideos(); }, onError: (error: any) => toast({ title: 'Video could not be deleted', description: error?.body?.error || error?.message, variant: 'destructive' }) });
  };

  const handleProviderRefresh = (id: number) => {
    refreshProviderStatus.mutate({ id }, {
      onSuccess: (video) => {
        void refetchVideos();
        if (video.uploadStatus === 'ready') {
          toast({ title: 'Release is ready to play', description: 'Kryv synchronized the playable FastPix source.' });
          return;
        }
        if (video.uploadStatus === 'errored') {
          toast({ title: 'FastPix reported a processing problem', description: 'This release remains unavailable to viewers. Review the source file before uploading again.', variant: 'destructive' });
          return;
        }
        toast({ title: 'Still processing', description: 'FastPix has not returned a playable delivery source yet. Kryv will keep this release private until it does.' });
      },
      onError: (error: any) => toast({ title: 'Could not refresh FastPix status', description: error?.body?.error || error?.message || 'Try again in a moment.', variant: 'destructive' }),
    });
  };

  if (!me?.channel) return <div className="container relative z-10 mx-auto max-w-4xl space-y-4 px-4 py-8 text-center"><h1 className="text-3xl font-display font-bold text-white">Creator Dashboard</h1><p className="text-muted-foreground">Create a channel in the Live Dashboard before publishing to Watch.</p><Button asChild><a href="/dashboard/live">Go to Live Dashboard</a></Button></div>;

  return (
    <div className="relative z-10 mx-auto max-w-6xl px-4 py-6 sm:py-8"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><div className="flex items-center gap-2 text-primary"><Tv className="h-4 w-4" /><span className="text-[11px] font-black uppercase tracking-[0.18em]">Creator publishing</span></div><h1 className="mt-1 text-3xl font-black text-white sm:text-4xl">Kryv Watch manager</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/50">Publish processed FastPix uploads or rights-cleared official YouTube embeds. Cinema originals remain in the owner-controlled Cinema desk.</p></div><div className="overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"><CreatorStudioNav active="watch" /></div></div>
      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4"><div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3"><p className="text-xl font-black text-white">{library.length}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-white/40">All releases</p></div><div className="rounded-xl border border-emerald-300/15 bg-emerald-300/[0.04] p-3"><p className="text-xl font-black text-emerald-100">{readyReleases}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-white/40">Ready to play</p></div><div className="rounded-xl border border-amber-300/15 bg-amber-300/[0.04] p-3"><p className="text-xl font-black text-amber-100">{processingReleases}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-white/40">Processing</p></div><div className="rounded-xl border border-primary/20 bg-primary/[0.05] p-3"><div className="flex items-center gap-1.5"><Eye className="h-4 w-4 text-primary" /><p className="text-xl font-black text-primary">{libraryViews.toLocaleString()}</p></div><p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-white/40">Recorded views</p></div></section>
      <p className="mt-3 flex items-center gap-1.5 text-xs leading-relaxed text-white/40"><BarChart3 className="h-3.5 w-3.5 text-primary" /> Library figures use current Watch records only: {youtubeReleases} official YouTube {youtubeReleases === 1 ? 'embed' : 'embeds'} and no estimated watch-time or revenue.</p>
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]"><section className="rounded-2xl border border-white/[0.1] bg-black/35 p-5 backdrop-blur sm:p-6"><div className="flex items-center gap-2"><UploadCloud className="h-5 w-5 text-primary" /><h2 className="text-lg font-black text-white">Add a Watch release</h2></div><div className="mt-5 space-y-4"><label className="block text-sm font-bold text-white/70">Title<input type="text" value={title} onChange={event => setTitle(event.target.value)} disabled={isUploading || createVideo.isPending} maxLength={100} className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-white outline-none focus:border-primary/60" placeholder="Release title" /></label><label className="block text-sm font-bold text-white/70">Category / genre<select value={categoryId || ''} onChange={event => setCategoryId(event.target.value ? Number(event.target.value) : undefined)} disabled={isUploading || createVideo.isPending} className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-white outline-none focus:border-primary/60"><option value="">Select category</option>{categories?.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><div><p className="text-sm font-bold text-white/70">Playback source</p><div className="mt-2 grid grid-cols-2 gap-2"><button type="button" onClick={() => setSource('fastpix')} disabled={isUploading || createVideo.isPending} className={`rounded-xl border p-3 text-left transition ${source === 'fastpix' ? 'border-primary bg-primary/10 text-primary' : 'border-white/10 bg-white/[0.03] text-white/50 hover:text-white'}`}><UploadCloud className="h-4 w-4" /><p className="mt-2 text-xs font-black">FastPix upload</p><p className="mt-1 text-[10px] leading-relaxed opacity-75">Upload a file for processing.</p></button><button type="button" onClick={() => setSource('youtube')} disabled={isUploading || createVideo.isPending} className={`rounded-xl border p-3 text-left transition ${source === 'youtube' ? 'border-red-300/60 bg-red-500/[0.1] text-red-100' : 'border-white/10 bg-white/[0.03] text-white/50 hover:text-white'}`}><Youtube className="h-4 w-4" /><p className="mt-2 text-xs font-black">Official YouTube</p><p className="mt-1 text-[10px] leading-relaxed opacity-75">Embed a rights-cleared release.</p></button></div></div>
        {source === 'fastpix' ? <div className="border-t border-white/[0.08] pt-4"><input type="file" accept="video/*" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />{isUploading ? <div className="space-y-2"><div className="flex justify-between text-sm"><span className="font-medium text-primary">Uploading to FastPix…</span><span className="font-mono text-white">{uploadProgress}%</span></div><div className="h-2 w-full overflow-hidden rounded-full bg-white/10"><div className="h-full bg-primary transition-all duration-300" style={{ width: `${uploadProgress}%` }} /></div></div> : <Button type="button" onClick={() => fileInputRef.current?.click()} disabled={!title.trim() || createVideo.isPending} className="h-12 w-full font-black"><UploadCloud className="mr-2 h-5 w-5" /> Select video file</Button>}<p className="mt-3 text-[11px] leading-relaxed text-white/40">The release stays in processing until FastPix reports a playable asset.</p></div> : <form onSubmit={publishYoutube} className="space-y-3 border-t border-white/[0.08] pt-4"><label className="block text-sm font-bold text-white/70">Official YouTube video ID<input value={youtubeVideoId} onChange={event => setYoutubeVideoId(event.target.value)} maxLength={32} placeholder="dQw4w9WgXcQ" className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 font-mono text-sm text-white outline-none focus:border-red-300/60" /></label><label className="flex cursor-pointer items-start gap-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-3"><input type="checkbox" checked={rightsAttested} onChange={event => setRightsAttested(event.target.checked)} className="mt-0.5 h-4 w-4 accent-primary" /><span className="text-xs leading-relaxed text-amber-50/85"><b className="font-black">Rights attestation.</b> I control this official source or have written permission to embed it in Kryv Watch. I understand this does not create a Cinema catalog title.</span></label><Button type="submit" disabled={createVideo.isPending || !title.trim() || !youtubeVideoId.trim() || !rightsAttested} className="h-11 w-full bg-red-500 font-black text-white hover:bg-red-500/90">{createVideo.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Youtube className="mr-2 h-4 w-4" /> Add official YouTube embed</>}</Button></form>}<div className="mt-5 flex gap-3 rounded-xl border border-white/[0.08] bg-white/[0.025] p-3"><ShieldCheck className="h-4 w-4 shrink-0 text-primary" /><p className="text-[11px] leading-relaxed text-white/45"><b className="text-white/70">Cinema boundary:</b> global Cinema titles are owner/production catalog entries. Creator uploads and YouTube embeds publish to Watch only.</p></div></div></section>
        <section className="min-h-[500px] rounded-2xl border border-white/[0.1] bg-black/35 p-5 backdrop-blur sm:p-6"><div className="flex flex-col gap-3"><div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-black text-white">Your Watch releases</h2><p className="mt-1 text-xs text-white/40">Processing and readiness come from the source of record. This library checks via REST every 15 seconds while this page is open.</p></div><div className="flex shrink-0 items-center gap-2"><span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[10px] font-black text-white/50">{videoPage?.total ?? 0}</span><Button type="button" variant="ghost" size="icon" onClick={() => { void refetchVideos(); }} disabled={videosRefreshing} aria-label="Recheck Watch release statuses" title="Recheck release statuses" className="h-9 w-9 rounded-lg border border-white/[0.08] text-white/55 hover:border-primary/40 hover:text-primary disabled:cursor-wait">{videosRefreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}</Button></div></div><div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="Watch release status filter">{([['all', 'All'], ['ready', 'Ready'], ['processing', 'Processing'], ['errored', 'Needs attention']] as const).map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={libraryFilter === value} onClick={() => setLibraryFilter(value)} className={`min-h-9 shrink-0 rounded-full border px-3 text-xs font-black transition ${libraryFilter === value ? 'border-primary/40 bg-primary/15 text-primary' : 'border-white/[0.08] bg-white/[0.025] text-white/45 hover:border-white/20 hover:text-white'}`}>{label}</button>)}</div></div>{library.length > 0 && <section className="mt-5 rounded-xl border border-primary/20 bg-primary/[0.045] p-4"><div className="flex items-start gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary"><Music2 className="h-4 w-4" /></div><div><h3 className="text-sm font-black text-white">Music information</h3><p className="mt-1 text-[11px] leading-relaxed text-white/45">Publish factual, owner-attested music acknowledgements for a Watch release. This labels information only; it does not clear or license a recording.</p></div></div><label className="mt-4 block text-xs font-bold text-white/60">Release<select value={musicCreditVideoId ?? ''} onChange={event => { setMusicCreditVideoId(event.target.value ? Number(event.target.value) : null); resetMusicCreditDraft(); }} className="mt-1.5 min-h-11 w-full rounded-xl border border-white/10 bg-black/35 px-3 text-sm text-white outline-none focus:border-primary/60"><option value="">Choose a Watch release</option>{library.map(video => <option key={video.id} value={video.id}>{video.title}</option>)}</select></label>{musicCreditVideoId && <div className="mt-4 border-t border-white/[0.08] pt-4">{musicCreditQuery.isLoading ? <div className="flex items-center gap-2 py-3 text-xs text-white/45"><Loader2 className="h-4 w-4 animate-spin text-primary" />Loading existing music information…</div> : <><div className="space-y-2">{(musicCreditQuery.data ?? []).map(credit => <div key={credit.id} className="flex items-center gap-3 rounded-lg border border-white/[0.08] bg-black/20 px-3 py-2.5"><Music2 className="h-4 w-4 shrink-0 text-primary" /><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-white">{credit.trackTitle}</p><p className="truncate text-[10px] text-white/45">{credit.artistName}{credit.albumTitle ? ` · ${credit.albumTitle}` : ''}</p></div><button type="button" onClick={() => removeMusicCredit(credit.id)} disabled={deleteMusicCredit.isPending} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-white/35 transition hover:bg-red-400/10 hover:text-red-200 disabled:opacity-50" aria-label={`Remove music credit ${credit.trackTitle}`}><Trash2 className="h-3.5 w-3.5" /></button></div>)}{musicCreditQuery.data?.length === 0 && <p className="rounded-lg border border-dashed border-white/[0.1] px-3 py-4 text-center text-[11px] leading-relaxed text-white/40">No music information has been published for this release.</p>}</div><form onSubmit={createMusicCreditForRelease} className="mt-4 space-y-3"><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold text-white/60">Track title<input value={musicCreditDraft.trackTitle} onChange={event => setMusicCreditDraft(draft => ({ ...draft, trackTitle: event.target.value }))} maxLength={200} required className="mt-1.5 min-h-10 w-full rounded-lg border border-white/10 bg-black/35 px-3 text-sm text-white outline-none focus:border-primary/60" placeholder="Track title" /></label><label className="text-xs font-bold text-white/60">Artist<input value={musicCreditDraft.artistName} onChange={event => setMusicCreditDraft(draft => ({ ...draft, artistName: event.target.value }))} maxLength={200} required className="mt-1.5 min-h-10 w-full rounded-lg border border-white/10 bg-black/35 px-3 text-sm text-white outline-none focus:border-primary/60" placeholder="Artist name" /></label><label className="text-xs font-bold text-white/60">Album / single<input value={musicCreditDraft.albumTitle} onChange={event => setMusicCreditDraft(draft => ({ ...draft, albumTitle: event.target.value }))} maxLength={200} className="mt-1.5 min-h-10 w-full rounded-lg border border-white/10 bg-black/35 px-3 text-sm text-white outline-none focus:border-primary/60" placeholder="Optional" /></label><label className="text-xs font-bold text-white/60">Label<input value={musicCreditDraft.labelName} onChange={event => setMusicCreditDraft(draft => ({ ...draft, labelName: event.target.value }))} maxLength={200} className="mt-1.5 min-h-10 w-full rounded-lg border border-white/10 bg-black/35 px-3 text-sm text-white outline-none focus:border-primary/60" placeholder="Optional" /></label></div><details className="rounded-lg border border-white/[0.08] bg-black/20 px-3 py-2.5"><summary className="cursor-pointer text-xs font-bold text-white/60">Verified metadata references (optional)</summary><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-[11px] font-bold text-white/55">Artwork URL (HTTPS)<input value={musicCreditDraft.artworkUrl} onChange={event => setMusicCreditDraft(draft => ({ ...draft, artworkUrl: event.target.value }))} maxLength={2048} inputMode="url" className="mt-1.5 min-h-10 w-full rounded-lg border border-white/10 bg-black/35 px-3 text-xs text-white outline-none focus:border-primary/60" placeholder="https://…" /></label><label className="text-[11px] font-bold text-white/55">Official information URL (HTTPS)<input value={musicCreditDraft.sourceUrl} onChange={event => setMusicCreditDraft(draft => ({ ...draft, sourceUrl: event.target.value }))} maxLength={2048} inputMode="url" className="mt-1.5 min-h-10 w-full rounded-lg border border-white/10 bg-black/35 px-3 text-xs text-white outline-none focus:border-primary/60" placeholder="https://…" /></label><label className="text-[11px] font-bold text-white/55">MusicBrainz recording ID<input value={musicCreditDraft.musicbrainzRecordingId} onChange={event => setMusicCreditDraft(draft => ({ ...draft, musicbrainzRecordingId: event.target.value, metadataSource: event.target.value ? 'musicbrainz' : draft.metadataSource }))} className="mt-1.5 min-h-10 w-full rounded-lg border border-white/10 bg-black/35 px-3 font-mono text-xs text-white outline-none focus:border-primary/60" placeholder="UUID" /></label><label className="text-[11px] font-bold text-white/55">MusicBrainz release ID<input value={musicCreditDraft.musicbrainzReleaseId} onChange={event => setMusicCreditDraft(draft => ({ ...draft, musicbrainzReleaseId: event.target.value, metadataSource: event.target.value ? 'musicbrainz' : draft.metadataSource }))} className="mt-1.5 min-h-10 w-full rounded-lg border border-white/10 bg-black/35 px-3 font-mono text-xs text-white outline-none focus:border-primary/60" placeholder="UUID" /></label></div></details><label className="flex cursor-pointer items-start gap-3 rounded-lg border border-amber-300/20 bg-amber-300/[0.06] p-3"><input type="checkbox" checked={musicCreditDraft.rightsAttested} onChange={event => setMusicCreditDraft(draft => ({ ...draft, rightsAttested: event.target.checked }))} className="mt-0.5 h-4 w-4 accent-primary" /><span className="text-[11px] leading-relaxed text-amber-50/85"><b className="font-black">Credit attestation.</b> I confirm these credits and any linked image or source are accurate and appropriate to show with this release. I understand a credit does not create rights to use a recording.</span></label><Button type="submit" disabled={createMusicCredit.isPending || !musicCreditDraft.trackTitle.trim() || !musicCreditDraft.artistName.trim() || !musicCreditDraft.rightsAttested} className="min-h-10 w-full text-xs font-black">{createMusicCredit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Music2 className="mr-2 h-4 w-4" /> Publish music information</>}</Button></form></>}</div>}</section>}{erroredReleases > 0 && <div className="mt-4 rounded-xl border border-red-300/20 bg-red-400/[0.05] p-3"><p className="text-xs font-black text-red-100">{erroredReleases} release{erroredReleases === 1 ? '' : 's'} need{erroredReleases === 1 ? 's' : ''} attention</p><p className="mt-1 text-[11px] leading-relaxed text-red-100/70">FastPix reported a processing failure. These releases are not publicly discoverable. Review the source file, remove the failed record, and start a new upload when ready.</p></div>}{videosLoading ? <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : visibleLibrary.length ? <div className="mt-5 space-y-3">{visibleLibrary.map(video => <article key={video.id} className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3"><div className="relative flex aspect-video w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-black">{video.thumbnailUrl ? <img src={video.thumbnailUrl} alt={video.title} className="h-full w-full object-cover" /> : video.playbackSource === 'youtube' ? <Youtube className="h-6 w-6 text-red-300" /> : <Film className="h-6 w-6 text-white/20" />}</div><div className="min-w-0 flex-1"><h3 className="truncate text-sm font-black text-white">{video.title}</h3><div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-wider"><span className={`rounded px-1.5 py-0.5 ${video.uploadStatus === 'ready' ? 'bg-emerald-400/15 text-emerald-200' : video.uploadStatus === 'errored' ? 'bg-red-400/15 text-red-200' : 'bg-amber-400/15 text-amber-100'}`}>{video.uploadStatus}</span><span className="inline-flex items-center gap-1 text-white/45">{video.playbackSource === 'youtube' ? <Youtube className="h-3 w-3 text-red-300" /> : <Link2 className="h-3 w-3 text-primary" />}{video.playbackSource}</span>{video.playbackSource === 'youtube' && <span className="inline-flex items-center gap-1 text-emerald-200"><CircleCheck className="h-3 w-3" /> Attested</span>}<span className="text-white/35">{video.viewCount} views</span></div>{video.playbackSource === 'fastpix' && (video.uploadStatus === 'waiting' || video.uploadStatus === 'processing') && <div className="mt-2 flex items-center gap-2"><button type="button" onClick={() => handleProviderRefresh(video.id)} disabled={refreshProviderStatus.isPending} className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-primary/25 bg-primary/[0.07] px-2 text-[10px] font-black text-primary transition hover:border-primary/50 hover:bg-primary/15 hover:text-white disabled:cursor-wait disabled:opacity-60">{refreshProviderStatus.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Check FastPix now</button><span className="text-[10px] leading-relaxed text-white/35">Use this if the provider already shows the release as ready.</span></div>}</div><div className="flex shrink-0 flex-col items-center gap-1"><Button type="button" variant="ghost" size="icon" aria-label={`Delete ${video.title}`} title={`Delete ${video.title}`} onClick={() => handleDelete(video.id)} disabled={deleteVideo.isPending} className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></Button></div></article>)}</div> : <div className="flex flex-col items-center justify-center py-24 text-center"><Film className="h-12 w-12 text-white/10" /><p className="mt-4 text-sm text-white/45">{libraryFilter === 'all' ? 'No Watch releases yet.' : `No ${libraryFilter === 'errored' ? 'failed' : libraryFilter} releases.`}</p><p className="mt-1 max-w-sm text-xs leading-relaxed text-white/30">{libraryFilter === 'all' ? 'Start with a FastPix upload or an official rights-cleared YouTube embed. Kryv does not create placeholder inventory.' : 'Choose another status filter or add a new release from the publishing panel.'}</p></div>}</section></div>
    </div>
  );
}
