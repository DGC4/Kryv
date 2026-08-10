import { useState, useRef } from 'react';
import { useGetMe, useListVideos, useCreateVideo, useDeleteVideo, useListCategories } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Loader2, UploadCloud, Trash2, Film, Tv } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function DashboardWatch() {
  const { data: me } = useGetMe();
  const channelId = me?.channel?.id;
  
  const { data: videos, refetch: refetchVideos, isLoading: videosLoading } = useListVideos({ channelId }, {
    query: { enabled: !!channelId }
  });
  
  const { data: categories } = useListCategories({ kind: 'genre' });
  const createVideo = useCreateVideo();
  const deleteVideo = useDeleteVideo();
  const { toast } = useToast();

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined);
  const [contentType, setContentType] = useState<'upload' | 'original'>('upload');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !me?.channel) return;
    if (!title.trim()) {
      toast({ title: 'Title required', description: 'Please enter a title before selecting a file.', variant: 'destructive' });
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress(0);

      const videoRecord = await createVideo.mutateAsync({
        data: { title, categoryId, contentType }
      });

      // Native XHR upload — works with FastPix direct upload URLs
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', videoRecord.uploadUrl);
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            setUploadProgress(Math.round((event.loaded / event.total) * 100));
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            toast({ title: 'Upload complete!', description: 'Your video is now processing.' });
            setIsUploading(false);
            setUploadProgress(0);
            setTitle('');
            setCategoryId(undefined);
            refetchVideos();
            resolve();
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        };
        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.send(file);
      });

    } catch (err: any) {
      toast({ title: 'Failed to initialize upload', description: err.message, variant: 'destructive' });
      setIsUploading(false);
    }
  };

  const handleDelete = (id: number) => {
    if (confirm('Are you sure you want to delete this video?')) {
      deleteVideo.mutate({ id }, {
        onSuccess: () => {
          toast({ title: 'Video deleted' });
          refetchVideos();
        }
      });
    }
  };

  if (!me?.channel) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl relative z-10 text-center space-y-4">
        <h1 className="text-3xl font-display font-bold text-white">Creator Dashboard</h1>
        <p className="text-muted-foreground">You need to create a channel in the Live Dashboard first.</p>
        <Button asChild><a href="/dashboard/live">Go to Live Dashboard</a></Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl relative z-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <h1 className="text-4xl font-display font-bold text-white">Video Manager</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Upload Form */}
        <div className="lg:col-span-1 space-y-6">
          <div className="p-6 border border-white/10 rounded-2xl bg-black/40 backdrop-blur">
            <h2 className="text-xl font-bold mb-6">Upload New Video</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-1">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  disabled={isUploading}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  placeholder="Video title"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-white mb-1">Category / Genre</label>
                <select
                  value={categoryId || ''}
                  onChange={e => setCategoryId(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                  disabled={isUploading}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary appearance-none"
                >
                  <option value="">Select category...</option>
                  {categories?.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">Publish To</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setContentType('upload')}
                    disabled={isUploading}
                    className={`flex-1 flex flex-col items-center p-3 rounded-lg border ${contentType === 'upload' ? 'border-primary bg-primary/10 text-primary' : 'border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10'} transition-colors`}
                  >
                    <Tv className="w-5 h-5 mb-1" />
                    <span className="text-xs font-bold">Watch</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setContentType('original')}
                    disabled={isUploading}
                    className={`flex-1 flex flex-col items-center p-3 rounded-lg border ${contentType === 'original' ? 'border-primary bg-primary/10 text-primary' : 'border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10'} transition-colors`}
                  >
                    <Film className="w-5 h-5 mb-1" />
                    <span className="text-xs font-bold">Cinema</span>
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-white/10">
                <input
                  type="file"
                  accept="video/*"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  className="hidden"
                />
                
                {isUploading ? (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-primary font-medium">Uploading...</span>
                      <span className="text-white font-mono">{Math.round(uploadProgress)}%</span>
                    </div>
                    <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <Button 
                    onClick={() => fileInputRef.current?.click()} 
                    disabled={!title.trim() || isUploading}
                    className="w-full font-bold h-12"
                  >
                    <UploadCloud className="w-5 h-5 mr-2" />
                    Select Video File
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Video List */}
        <div className="lg:col-span-2">
          <div className="p-6 border border-white/10 rounded-2xl bg-black/40 backdrop-blur min-h-[500px]">
            <h2 className="text-xl font-bold mb-6">Your Videos</h2>
            
            {videosLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : videos && videos.length > 0 ? (
              <div className="space-y-3">
                {videos.map(video => (
                  <div key={video.id} className="flex items-center gap-4 p-3 bg-white/5 border border-white/5 rounded-xl hover:border-white/10 transition-colors">
                    <div className="w-24 aspect-video bg-black rounded-lg overflow-hidden shrink-0 relative">
                      {video.thumbnailUrl ? (
                        <img src={video.thumbnailUrl} alt={video.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Film className="w-6 h-6 text-white/20" />
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-white truncate">{video.title}</h3>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        <span className={`px-1.5 py-0.5 rounded font-medium ${
                          video.uploadStatus === 'ready' ? 'bg-green-500/20 text-green-400' :
                          video.uploadStatus === 'errored' ? 'bg-destructive/20 text-destructive' :
                          'bg-orange-500/20 text-orange-400'
                        }`}>
                          {video.uploadStatus}
                        </span>
                        <span className="uppercase tracking-wider font-bold">{video.contentType}</span>
                        <span>{video.viewCount} views</span>
                      </div>
                    </div>
                    
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleDelete(video.id)}
                      disabled={deleteVideo.isPending}
                      className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Film className="w-12 h-12 text-white/10 mx-auto mb-4" />
                <p className="text-muted-foreground">You haven't uploaded any videos yet.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
