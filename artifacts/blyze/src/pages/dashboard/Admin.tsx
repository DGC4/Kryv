import React, { useState } from 'react';
import { Link, Redirect } from 'wouter';
import {
  useGetMe,
  useGetAdminAnalytics,
  useGetAdminCommandOverview,
  useGetAdminStats,
  useListAdminUsers,
  useUpdateAdminUser,
  useGetAdminUserActivity,
  useListAdminChannels,
  useDeleteAdminChannel,
  useListAdminVideos,
  useDeleteAdminVideo,
  getGetAdminStatsQueryKey,
  getListAdminUsersQueryKey,
  getListAdminChannelsQueryKey,
  getListAdminVideosQueryKey,
  useListAdminCinemaTitles,
  useCreateAdminCinemaTitle,
  useGetAdminCinemaTitle,
  useUpdateAdminCinemaTitle,
  useCreateAdminCinemaRightsWindow,
  useCreateAdminCinemaAsset,
  useCreateAdminCinemaUploadSession,
  useCreateAdminCinemaCredit,
  useDeleteAdminCinemaCredit,
  getListAdminCinemaTitlesQueryKey,
  getGetAdminCinemaTitleQueryKey,
  useListAdminFeatureFlags,
  useUpdateAdminFeatureFlag,
  getListAdminFeatureFlagsQueryKey,
  useGetAdminFinanceLedger,
  useGetAdminFinanceOverview,
  useGetAdminTreasuryContext,
  useUpdateAdminTreasuryContext,
  getGetAdminTreasuryContextQueryKey,
  useListAdminCreatorBalances,
  useGetAdminCreatorBalanceDetail,
  useListAdminPayoutProfiles,
  useReviewAdminPayoutProfile,
  useListAdminPayoutRequests,
  useReviewAdminPayoutRequest,
  useGetAdminAdsOverview,
  useCreateAdminAdCampaign,
  useCreateAdminAdFundingInvoice,
  useApproveAdminAdCampaign,
  getGetAdminFinanceOverviewQueryKey,
  getListAdminPayoutProfilesQueryKey,
  getListAdminPayoutRequestsQueryKey,
  useListAdminModerationCases,
  useReviewAdminModerationCase,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Loader2, Ban, ShieldCheck, Trash2, Users, Radio, Film, Eye,
  Crown, Lock, ShieldAlert, Activity, PlaySquare, Tv, Plus, Clapperboard, CheckCircle2, CircleAlert, FileVideo2, Gavel, History, Send, UploadCloud, Power, Zap, Wallet, Landmark, Clock3, XCircle,
} from 'lucide-react';
import { GoldenDBadge, UserBadge } from '@/components/brand/BrandIdentity';
import { useToast } from '@/hooks/use-toast';

type Tab = 'overview' | 'analytics' | 'users' | 'channels' | 'videos' | 'cinema' | 'finance' | 'ads' | 'safety' | 'operations';

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

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
  const [tab, setTab] = useState<Tab>('overview');
  const [analyticsRangeDays, setAnalyticsRangeDays] = useState<1 | 7 | 30>(7);
  const [adminUserSearch, setAdminUserSearch] = useState('');
  const [adminChannelSearch, setAdminChannelSearch] = useState('');
  const [adminUserOffset, setAdminUserOffset] = useState(0);
  const [adminChannelOffset, setAdminChannelOffset] = useState(0);
  const normalizedUserSearch = adminUserSearch.trim();
  const normalizedChannelSearch = adminChannelSearch.trim();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: me, isLoading: meLoading } = useGetMe();
  const { data: stats, isLoading: statsLoading, isError: statsError, refetch: refetchStats } = useGetAdminStats({
    query: { enabled: me?.role === 'owner' },
  });
  const commandOverviewQuery = useGetAdminCommandOverview({
    query: { enabled: me?.role === 'owner' && tab === 'overview', refetchInterval: tab === 'overview' ? 30000 : false },
  });
  const adminAnalyticsQuery = useGetAdminAnalytics({ rangeDays: analyticsRangeDays }, {
    query: { enabled: me?.role === 'owner' && tab === 'analytics', refetchInterval: tab === 'analytics' ? 30000 : false },
  });
  const userRegistryQuery = useListAdminUsers(
    { q: normalizedUserSearch || undefined, limit: 30, offset: adminUserOffset },
    { query: { enabled: me?.role === 'owner' && tab === 'users' } },
  );
  const channelRegistryQuery = useListAdminChannels(
    { q: normalizedChannelSearch || undefined, limit: 30, offset: adminChannelOffset },
    { query: { enabled: me?.role === 'owner' && tab === 'channels' } },
  );
  const cinemaCreditChannelsQuery = useListAdminChannels(
    { limit: 100, offset: 0 },
    { query: { enabled: me?.role === 'owner' && tab === 'cinema' } },
  );
  const { data: videos, isLoading: videosLoading } = useListAdminVideos({
    query: { enabled: me?.role === 'owner' && tab === 'videos' },
  });
  const { data: cinemaTitles, isLoading: cinemaTitlesLoading } = useListAdminCinemaTitles({
    query: { enabled: me?.role === 'owner' && tab === 'cinema' },
  });
  const { data: featureFlags, isLoading: featureFlagsLoading } = useListAdminFeatureFlags({
    query: { enabled: me?.role === 'owner' && tab === 'operations' },
  });
  const financeOverviewQuery = useGetAdminFinanceOverview({
    query: { enabled: me?.role === 'owner' && tab === 'finance', refetchInterval: tab === 'finance' ? 15000 : false },
  });
  const financeLedgerQuery = useGetAdminFinanceLedger({
    query: { enabled: me?.role === 'owner' && tab === 'finance', refetchInterval: tab === 'finance' ? 15000 : false },
  });
  const treasuryContextQuery = useGetAdminTreasuryContext({
    query: { enabled: me?.role === 'owner' && tab === 'finance' },
  });
  const creatorBalancesQuery = useListAdminCreatorBalances({
    query: { enabled: me?.role === 'owner' && tab === 'finance', refetchInterval: tab === 'finance' ? 15000 : false },
  });
  const payoutProfilesQuery = useListAdminPayoutProfiles({
    query: { enabled: me?.role === 'owner' && tab === 'finance' },
  });
  const payoutRequestsQuery = useListAdminPayoutRequests({
    query: { enabled: me?.role === 'owner' && tab === 'finance' },
  });
  const adsOverviewQuery = useGetAdminAdsOverview({
    query: { enabled: me?.role === 'owner' && tab === 'ads', refetchInterval: tab === 'ads' ? 15000 : false },
  });
  const moderationCasesQuery = useListAdminModerationCases({ status: 'open' }, {
    query: { enabled: me?.role === 'owner' && tab === 'safety', refetchInterval: tab === 'safety' ? 15000 : false },
  });
  const [selectedCinemaTitleId, setSelectedCinemaTitleId] = useState<number | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedCreatorBalanceChannelId, setSelectedCreatorBalanceChannelId] = useState<number | null>(null);
  const cinemaDetailQuery = useGetAdminCinemaTitle(selectedCinemaTitleId ?? 0, {
    query: { enabled: me?.role === 'owner' && selectedCinemaTitleId !== null },
  });
  const userActivityQuery = useGetAdminUserActivity(String(selectedUserId ?? 0), {
    query: { enabled: me?.role === 'owner' && selectedUserId !== null },
  });
  const creatorBalanceDetailQuery = useGetAdminCreatorBalanceDetail(selectedCreatorBalanceChannelId ?? 0, {
    query: { enabled: me?.role === 'owner' && tab === 'finance' && selectedCreatorBalanceChannelId !== null, refetchInterval: tab === 'finance' && selectedCreatorBalanceChannelId !== null ? 15000 : false },
  });
  const [cinemaTitle, setCinemaTitle] = useState('');
  const [rightsReference, setRightsReference] = useState('');
  const [assetKind, setAssetKind] = useState<'feature' | 'trailer' | 'preview' | 'captions'>('feature');
  const [assetPlaybackId, setAssetPlaybackId] = useState('');
  const [assetMediaId, setAssetMediaId] = useState('');
  const [assetProvenance, setAssetProvenance] = useState('');
  const [cinemaUploadAssetKind, setCinemaUploadAssetKind] = useState<'feature' | 'trailer' | 'preview'>('feature');
  const [cinemaUploadFile, setCinemaUploadFile] = useState<File | null>(null);
  const [cinemaUploadProvenance, setCinemaUploadProvenance] = useState('');
  const [cinemaUploadLanguage, setCinemaUploadLanguage] = useState('en');
  const [cinemaUploading, setCinemaUploading] = useState(false);
  const [rightsEntitlement, setRightsEntitlement] = useState<'free' | 'subscription' | 'rental' | 'purchase'>('subscription');
  const [rightsTerritories, setRightsTerritories] = useState('');
  const [rightsStartsAt, setRightsStartsAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [rightsEndsAt, setRightsEndsAt] = useState('');
  const [creditChannelId, setCreditChannelId] = useState('');
  const [creditRole, setCreditRole] = useState('');
  const [creditDisplayOrder, setCreditDisplayOrder] = useState('0');
  const [adCampaignName, setAdCampaignName] = useState('');
  const [adAdvertiserName, setAdAdvertiserName] = useState('');
  const [adFundingMode, setAdFundingMode] = useState<'promotional' | 'paid'>('promotional');
  const [adBudgetUsd, setAdBudgetUsd] = useState('');
  const [adCreatorShare, setAdCreatorShare] = useState('0');
  const [adEndsAt, setAdEndsAt] = useState(() => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16));
  const [treasuryLabel, setTreasuryLabel] = useState('');
  const [treasuryNotes, setTreasuryNotes] = useState('');

  const updateUser = useUpdateAdminUser();
  const deleteChannel = useDeleteAdminChannel();
  const deleteVideo = useDeleteAdminVideo();
  const createCinemaTitle = useCreateAdminCinemaTitle();
  const updateCinemaTitle = useUpdateAdminCinemaTitle();
  const createCinemaRightsWindow = useCreateAdminCinemaRightsWindow();
  const createCinemaAsset = useCreateAdminCinemaAsset();
  const createCinemaUploadSession = useCreateAdminCinemaUploadSession();
  const createCinemaCredit = useCreateAdminCinemaCredit();
  const deleteCinemaCredit = useDeleteAdminCinemaCredit();
  const updateFeatureFlag = useUpdateAdminFeatureFlag();
  const reviewAdminPayoutProfile = useReviewAdminPayoutProfile();
  const reviewAdminPayoutRequest = useReviewAdminPayoutRequest();
  const createAdminAdCampaign = useCreateAdminAdCampaign();
  const createAdminAdFundingInvoice = useCreateAdminAdFundingInvoice();
  const approveAdminAdCampaign = useApproveAdminAdCampaign();
  const reviewAdminModerationCase = useReviewAdminModerationCase();
  const updateAdminTreasuryContext = useUpdateAdminTreasuryContext();

  React.useEffect(() => {
    if (!treasuryContextQuery.data) return;
    setTreasuryLabel(treasuryContextQuery.data.label ?? '');
    setTreasuryNotes(treasuryContextQuery.data.notes ?? '');
  }, [treasuryContextQuery.data?.updatedAt]);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getGetAdminStatsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListAdminUsersQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListAdminChannelsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListAdminVideosQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListAdminCinemaTitlesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListAdminFeatureFlagsQueryKey() });
    if (selectedCinemaTitleId !== null) queryClient.invalidateQueries({ queryKey: getGetAdminCinemaTitleQueryKey(selectedCinemaTitleId) });
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

  const removeChannel = (id: string) => {
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

  const refreshFinanceCommand = () => {
    queryClient.invalidateQueries({ queryKey: getGetAdminFinanceOverviewQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetAdminTreasuryContextQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListAdminPayoutProfilesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListAdminPayoutRequestsQueryKey() });
  };

  const saveTreasuryContext = (event: React.FormEvent) => {
    event.preventDefault();
    updateAdminTreasuryContext.mutate({ data: { label: treasuryLabel.trim() || null, notes: treasuryNotes.trim() || null } }, {
      onSuccess: () => {
        refreshFinanceCommand();
        toast({ title: 'Treasury operating context saved', description: 'The safe label and notes were audit logged. No wallet address, provider key, custody record, or payout instruction was changed.' });
      },
      onError: (error: any) => toast({ title: 'Treasury context could not be saved', description: error?.body?.error || error?.message || 'The safe operating note was not changed.', variant: 'destructive' }),
    });
  };

  const refreshAdsCommand = () => adsOverviewQuery.refetch();

  const createAdvertisingCampaign = (event: React.FormEvent) => {
    event.preventDefault();
    const endsAt = new Date(adEndsAt);
    const creatorShareBps = Math.round(Number(adCreatorShare || '0') * 100);
    if (!adCampaignName.trim() || Number.isNaN(endsAt.getTime()) || creatorShareBps < 0 || creatorShareBps > 10_000) return;
    createAdminAdCampaign.mutate({ data: {
      name: adCampaignName.trim(),
      ...(adAdvertiserName.trim() ? { advertiserName: adAdvertiserName.trim() } : {}),
      fundingMode: adFundingMode,
      ...(adFundingMode === 'paid' ? { budgetUsd: adBudgetUsd } : {}),
      creatorShareBps,
      endsAt: endsAt.toISOString(),
    } }, {
      onSuccess: () => { setAdCampaignName(''); setAdAdvertiserName(''); setAdBudgetUsd(''); setAdCreatorShare('0'); refreshAdsCommand(); toast({ title: 'Advertising campaign drafted', description: adFundingMode === 'paid' ? 'Create and complete its crypto funding invoice before owner approval.' : 'Approve this bounded promotional flight only after creative and ad-rule review.' }); },
      onError: (err: any) => toast({ title: 'Campaign draft blocked', description: err?.body?.error || err?.message || 'Check the campaign details and delivery window.', variant: 'destructive' }),
    });
  };

  const createAdvertisingFundingInvoice = (id: number) => {
    createAdminAdFundingInvoice.mutate({ id, data: {} }, {
      onSuccess: (invoice) => { refreshAdsCommand(); navigator.clipboard?.writeText(invoice.invoiceUrl).catch(() => undefined); window.open(invoice.invoiceUrl, '_blank', 'noopener,noreferrer'); toast({ title: 'Crypto funding invoice created', description: 'The Kryv-branded invoice opened in a new tab and its URL was copied for the advertiser. It must receive a signed confirmation before approval.' }); },
      onError: (err: any) => toast({ title: 'Funding invoice blocked', description: err?.body?.error || err?.message || 'Check provider readiness and campaign funding state.', variant: 'destructive' }),
    });
  };

  const approveAdvertisingCampaign = (id: number, name: string) => {
    if (!confirm(`Approve ${name} for delivery? Delivery remains blocked until its campaign rule and approved creative are active.`)) return;
    approveAdminAdCampaign.mutate({ id }, {
      onSuccess: () => { refreshAdsCommand(); toast({ title: 'Campaign approved', description: 'The ad decision engine will still enforce funding, consent, active rule, creative, and delivery-window checks.' }); },
      onError: (err: any) => toast({ title: 'Campaign approval blocked', description: err?.body?.error || err?.message || 'Complete the funding and delivery requirements first.', variant: 'destructive' }),
    });
  };

  const reviewPayoutProfile = (id: number, decision: 'approved' | 'rejected') => {
    if (!confirm(`${decision === 'approved' ? 'Approve' : 'Reject'} this masked payout destination? The destination is never displayed in full.`)) return;
    reviewAdminPayoutProfile.mutate({ id, data: { decision } }, {
      onSuccess: () => { refreshFinanceCommand(); toast({ title: `Payout destination ${decision}` }); },
      onError: (err: any) => toast({ title: 'Profile review blocked', description: err?.body?.error || err?.message || 'Review could not be recorded.', variant: 'destructive' }),
    });
  };

  const reviewPayoutRequest = (id: number, decision: 'approved' | 'held' | 'rejected') => {
    const labels = { approved: 'Approve for controlled release', held: 'Place on hold', rejected: 'Reject and release balance' };
    if (!confirm(`${labels[decision]}? This action is audited. Approval does not send a provider withdrawal.`)) return;
    reviewAdminPayoutRequest.mutate({ id, data: { decision } }, {
      onSuccess: () => { refreshFinanceCommand(); toast({ title: `Payout ${decision}`, description: decision === 'approved' ? 'No provider withdrawal was sent.' : undefined }); },
      onError: (err: any) => toast({ title: 'Payout review blocked', description: err?.body?.error || err?.message || 'Review could not be recorded.', variant: 'destructive' }),
    });
  };

  const reviewModerationCase = (id: number, decision: 'resolved' | 'dismissed') => {
    if (!confirm(`${decision === 'resolved' ? 'Resolve' : 'Dismiss'} this safety report? This review is final and recorded in Kryv's audit ledger.`)) return;
    reviewAdminModerationCase.mutate({ id, data: { decision } }, {
      onSuccess: () => { moderationCasesQuery.refetch(); toast({ title: `Safety report ${decision}`, description: 'The report review was recorded without altering the original evidence.' }); },
      onError: (err: any) => toast({ title: 'Safety review blocked', description: err?.body?.error || err?.message || 'Review could not be recorded.', variant: 'destructive' }),
    });
  };

  const handleAddOriginal = () => setTab('cinema');

  const operationalFlagLabel = (key: string) => ({
    crypto_commerce: 'crypto commerce',
    ads_delivery: 'ad delivery',
    creator_payout_requests: 'creator payout requests',
    customer_wallet_custody: 'customer wallet custody',
    scheduled_payout_requests: 'scheduled payout requests',
    provider_withdrawals: 'provider withdrawals',
  }[key] ?? 'operational control');

  const toggleOperationalFlag = (key: string, enabled: boolean) => {
    const label = operationalFlagLabel(key);
    const warning = key === 'provider_withdrawals'
      ? 'Confirm provider request-IP rules, balances, fee estimation, reconciliation, and incident response are verified.'
      : key === 'scheduled_payout_requests'
        ? 'Confirm a production scheduler, UTC cadence tests, idempotency checks, and alerting are operating.'
        : key === 'customer_wallet_custody'
          ? 'Confirm custody authorization, key-management boundaries, deposit reconciliation, incident response, and the customer disclosure flow are approved.'
          : key === 'ads_delivery'
            ? 'Confirm consent, creative review, delivery measurement, rate limits, and the delivery kill switch are verified.'
            : 'Confirm that its provider configuration, monitoring, and incident response are ready.';
    if (enabled && !confirm(`Enable ${label}? ${warning}`)) return;
    updateFeatureFlag.mutate({ key, data: { enabled } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAdminFeatureFlagsQueryKey() });
        toast({ title: enabled ? `${label} enabled` : `${label} disabled`, description: enabled ? 'The server-side feature gate is now open.' : 'The server-side feature gate is now closed.' });
      },
      onError: (err: any) => toast({ title: 'Operational change blocked', description: err?.body?.error || err?.message || 'The feature flag could not be updated.', variant: 'destructive' }),
    });
  };

  const handleCreateCinemaTitle = (event: React.FormEvent) => {
    event.preventDefault();
    if (!cinemaTitle.trim() || !rightsReference.trim()) return;
    createCinemaTitle.mutate({ data: { title: cinemaTitle.trim(), rightsReference: rightsReference.trim() } }, {
      onSuccess: () => {
        setCinemaTitle('');
        setRightsReference('');
        invalidateAll();
        toast({ title: 'Cinema title draft created', description: 'Add an approved FastPix feature or trailer asset before publishing.' });
      },
      onError: (err: any) => toast({ title: 'Cinema draft could not be created', description: err?.body?.error || err?.message || 'Check the rights reference and try again.', variant: 'destructive' }),
    });
  };

  const refreshCinemaDesk = () => {
    queryClient.invalidateQueries({ queryKey: getListAdminCinemaTitlesQueryKey() });
    if (selectedCinemaTitleId !== null) queryClient.invalidateQueries({ queryKey: getGetAdminCinemaTitleQueryKey(selectedCinemaTitleId) });
  };

  const transitionCinemaTitle = (publishState: 'draft' | 'review' | 'published' | 'archived') => {
    if (selectedCinemaTitleId === null) return;
    updateCinemaTitle.mutate({ id: selectedCinemaTitleId, data: { publishState, reason: `Owner moved title to ${publishState}` } }, {
      onSuccess: () => { refreshCinemaDesk(); toast({ title: `Cinema title moved to ${publishState}` }); },
      onError: (err: any) => toast({ title: 'Publishing action blocked', description: err?.body?.blockingReasons?.join(' ') || err?.body?.error || err?.message || 'Review the title readiness checks.', variant: 'destructive' }),
    });
  };

  const handleAddCinemaAsset = (event: React.FormEvent) => {
    event.preventDefault();
    if (selectedCinemaTitleId === null || !assetPlaybackId.trim() || !assetProvenance.trim()) return;
    createCinemaAsset.mutate({ id: selectedCinemaTitleId, data: { assetKind, fastpixPlaybackId: assetPlaybackId.trim(), ...(assetMediaId.trim() ? { fastpixMediaId: assetMediaId.trim() } : {}), sourceProvenance: assetProvenance.trim() } }, {
      onSuccess: () => { setAssetPlaybackId(''); setAssetMediaId(''); setAssetProvenance(''); refreshCinemaDesk(); toast({ title: 'Approved Cinema asset attached' }); },
      onError: (err: any) => toast({ title: 'Asset could not be attached', description: err?.body?.error || err?.message || 'Confirm the approved playback identifier and provenance.', variant: 'destructive' }),
    });
  };

  const handleCinemaDirectUpload = (event: React.FormEvent) => {
    event.preventDefault();
    if (selectedCinemaTitleId === null || !cinemaUploadFile || !cinemaUploadProvenance.trim() || cinemaUploading) return;

    const file = cinemaUploadFile;
    setCinemaUploading(true);
    createCinemaUploadSession.mutate(
      {
        id: selectedCinemaTitleId,
        data: {
          assetKind: cinemaUploadAssetKind,
          sourceProvenance: cinemaUploadProvenance.trim(),
          language: cinemaUploadLanguage.trim() || 'en',
        },
      },
      {
        onSuccess: async (session) => {
          try {
            const uploadResponse = await fetch(session.uploadUrl, {
              method: 'PUT',
              headers: { 'Content-Type': file.type || 'application/octet-stream' },
              body: file,
            });
            if (!uploadResponse.ok) throw new Error(`Upload failed with HTTP ${uploadResponse.status}`);
            setCinemaUploadFile(null);
            setCinemaUploadProvenance('');
            refreshCinemaDesk();
            toast({ title: 'Cinema upload accepted', description: 'The file is processing. Provider readiness must complete before the asset can unlock publication.' });
          } catch (error: any) {
            toast({ title: 'Cinema upload did not complete', description: error?.message || 'The pending asset remains blocked until a successful approved upload is completed.', variant: 'destructive' });
          } finally {
            setCinemaUploading(false);
          }
        },
        onError: (err: any) => {
          setCinemaUploading(false);
          toast({ title: 'Owner upload session blocked', description: err?.body?.error || err?.message || 'No upload URL was issued.', variant: 'destructive' });
        },
      },
    );
  };

  const handleAddRightsWindow = (event: React.FormEvent) => {
    event.preventDefault();
    if (selectedCinemaTitleId === null || !rightsReference.trim() || !rightsStartsAt) return;
    const startsAt = new Date(rightsStartsAt);
    const endsAt = rightsEndsAt ? new Date(rightsEndsAt) : undefined;
    if (Number.isNaN(startsAt.getTime()) || (endsAt && Number.isNaN(endsAt.getTime()))) return;
    createCinemaRightsWindow.mutate({ id: selectedCinemaTitleId, data: { entitlementType: rightsEntitlement, rightsReference: rightsReference.trim(), territoryCodes: rightsTerritories.split(',').map(value => value.trim().toUpperCase()).filter(Boolean), startsAt: startsAt.toISOString(), ...(endsAt ? { endsAt: endsAt.toISOString() } : {}) } }, {
      onSuccess: () => { setRightsTerritories(''); setRightsEndsAt(''); refreshCinemaDesk(); toast({ title: 'Rights window added' }); },
      onError: (err: any) => toast({ title: 'Rights window could not be added', description: err?.body?.error || err?.message || 'Check the entitlement and dates.', variant: 'destructive' }),
    });
  };

  const handleAddCinemaCredit = (event: React.FormEvent) => {
    event.preventDefault();
    const channelId = Number(creditChannelId);
    const displayOrder = Number(creditDisplayOrder || '0');
    if (selectedCinemaTitleId === null || !Number.isSafeInteger(channelId) || channelId < 1 || !creditRole.trim() || !Number.isSafeInteger(displayOrder)) return;
    createCinemaCredit.mutate({ id: selectedCinemaTitleId, data: { channelId, role: creditRole.trim(), displayOrder } }, {
      onSuccess: () => { setCreditChannelId(''); setCreditRole(''); setCreditDisplayOrder('0'); refreshCinemaDesk(); toast({ title: 'Creator credit attached', description: 'The credit can surface on this creator’s public profile only when the Cinema title is rights-cleared and published.' }); },
      onError: (err: any) => toast({ title: 'Creator credit could not be attached', description: err?.body?.error || err?.message || 'Confirm the channel ID and role, then try again.', variant: 'destructive' }),
    });
  };

  const removeCinemaCredit = (creditId: number, name: string) => {
    if (selectedCinemaTitleId === null || !confirm(`Remove ${name}'s Cinema credit from this title?`)) return;
    deleteCinemaCredit.mutate({ id: selectedCinemaTitleId, creditId }, {
      onSuccess: () => { refreshCinemaDesk(); toast({ title: 'Creator credit removed' }); },
      onError: (err: any) => toast({ title: 'Creator credit could not be removed', description: err?.body?.error || err?.message || 'The audit-protected action was not completed.', variant: 'destructive' }),
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
        <div className="mb-8 flex items-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <span className="text-sm text-white/40">Loading stats…</span>
        </div>
      ) : statsError ? (
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-300/20 bg-red-400/[0.05] p-4 text-sm text-red-100"><p className="font-bold">Top-line platform statistics are temporarily unavailable.</p><Button type="button" size="sm" variant="outline" onClick={() => refetchStats()} className="border-red-200/25 bg-red-200/[0.08] font-black text-red-50 hover:bg-red-200/[0.14] hover:text-red-50">Retry stats</Button></div>
      ) : stats ? (
        <div className="grid grid-cols-2 gap-3 mb-8 md:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Total Users"   value={stats.totalUsers}    icon={Users}       />
          <StatCard label="Banned"        value={stats.bannedUsers}   icon={Ban}         />
          <StatCard label="Channels"      value={stats.totalChannels} icon={Radio}       />
          <StatCard label="Live Now"      value={stats.liveChannels}  icon={Activity}    accent />
          <StatCard label="Videos"        value={stats.totalVideos}   icon={Film}        />
          <StatCard label="Total Views"   value={stats.totalViews}    icon={Eye}         />
        </div>
      ) : null}

      {/* Tabs */}
      <div className="-mx-4 mb-5 flex gap-1 overflow-x-auto border-b border-white/[0.08] px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:px-0">
        {(['overview', 'analytics', 'users', 'channels', 'videos', 'cinema', 'finance', 'ads', 'safety', 'operations'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`shrink-0 px-4 py-2.5 text-sm font-bold capitalize border-b-2 transition-colors ${
              tab === t
                ? 'border-primary text-primary'
                : 'border-transparent text-white/40 hover:text-white'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <section className="space-y-5">
          <div className="rounded-2xl border border-primary/20 bg-[radial-gradient(circle_at_top_right,rgba(51,238,196,0.14),transparent_38%),linear-gradient(130deg,rgba(91,70,255,0.12),rgba(8,10,15,0.96)_58%)] p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-2 text-primary"><Landmark className="h-5 w-5" /><h2 className="text-lg font-black text-white">Platform command overview</h2></div><p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/55">A read-only operating picture built from channel, video, Cinema, payment-intent, immutable revenue, payout, report, and feature-flag records. Asset amounts are never collapsed into a synthetic fiat total.</p></div><div className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-wider ${commandOverviewQuery.data?.commerce.providerConfigured ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200' : 'border-amber-300/20 bg-amber-300/10 text-amber-100'}`}><Activity className="h-3.5 w-3.5" /> {commandOverviewQuery.data?.commerce.providerConfigured ? 'Provider configuration detected' : 'Provider configuration pending'}</div></div>
          </div>
          {commandOverviewQuery.isLoading ? <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div> : commandOverviewQuery.data ? <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6"><StatCard label="Creators" value={commandOverviewQuery.data.platform.creatorChannels} icon={Users} /><StatCard label="Live now" value={commandOverviewQuery.data.platform.liveChannels} icon={Radio} accent /><StatCard label="Watch objects" value={commandOverviewQuery.data.platform.watchItems} icon={PlaySquare} /><StatCard label="Ready Watch" value={commandOverviewQuery.data.platform.readyWatchItems} icon={CheckCircle2} accent /><StatCard label="Cinema titles" value={commandOverviewQuery.data.platform.cinemaTitles} icon={Clapperboard} /><StatCard label="Total views" value={commandOverviewQuery.data.platform.totalViews} icon={Eye} /></div>
            <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]"><article className="rounded-2xl border border-white/[0.08] bg-black/25 p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h3 className="text-sm font-black text-white">Crypto commerce state</h3><p className="mt-1 text-xs leading-relaxed text-white/40">Operational flags are shown as state only. Open Operations for acknowledged, audited changes.</p></div><Button size="sm" variant="secondary" className="w-fit text-xs font-black" onClick={() => setTab('operations')}>Open flags</Button></div><div className="mt-4 grid gap-2 sm:grid-cols-2">{[{ label: 'Crypto commerce', enabled: commandOverviewQuery.data.commerce.cryptoCommerceEnabled }, { label: 'Payout requests', enabled: commandOverviewQuery.data.commerce.payoutRequestsEnabled }, { label: 'Scheduled payouts', enabled: commandOverviewQuery.data.commerce.scheduledPayoutRequestsEnabled }, { label: 'Provider withdrawals', enabled: commandOverviewQuery.data.commerce.providerWithdrawalsEnabled }, { label: 'Customer custody', enabled: commandOverviewQuery.data.commerce.customerWalletCustodyEnabled }, { label: 'Ad delivery', enabled: commandOverviewQuery.data.commerce.adsDeliveryEnabled }].map((item) => <div key={item.label} className={`flex items-center justify-between rounded-xl border px-3 py-2.5 ${item.enabled ? 'border-emerald-300/20 bg-emerald-300/[0.06]' : 'border-white/[0.08] bg-white/[0.02]'}`}><span className="text-xs font-bold text-white/70">{item.label}</span><span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${item.enabled ? 'bg-emerald-300/15 text-emerald-200' : 'bg-white/[0.07] text-white/45'}`}>{item.enabled ? 'On' : 'Off'}</span></div>)}</div></article>
              <article className="rounded-2xl border border-white/[0.08] bg-black/25 p-5"><div className="flex items-start justify-between gap-4"><div><h3 className="text-sm font-black text-white">Review queue</h3><p className="mt-1 text-xs leading-relaxed text-white/40">Counts reflect actual open safety cases and queue records, not automated risk decisions.</p></div><Button size="sm" variant="secondary" className="w-fit text-xs font-black" onClick={() => setTab('finance')}>Open finance</Button></div><div className="mt-4 grid grid-cols-3 gap-3"><div className="rounded-xl border border-amber-300/15 bg-amber-300/[0.05] p-3"><p className="text-2xl font-black text-amber-100">{commandOverviewQuery.data.commerce.pendingProfileReviews}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-white/40">Profiles</p></div><div className="rounded-xl border border-amber-300/15 bg-amber-300/[0.05] p-3"><p className="text-2xl font-black text-amber-100">{commandOverviewQuery.data.commerce.pendingPayoutReviews}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-white/40">Payouts</p></div><div className="rounded-xl border border-red-300/15 bg-red-400/[0.05] p-3"><p className="text-2xl font-black text-red-100">{commandOverviewQuery.data.safety.openCases}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-white/40">Safety</p></div></div><div className="mt-4 flex gap-2"><Button size="sm" variant="secondary" className="flex-1 text-xs font-black" onClick={() => setTab('safety')}>Safety queue</Button><Button size="sm" variant="secondary" className="flex-1 text-xs font-black" onClick={() => setTab('cinema')}>Catalog ops</Button></div></article></div>
            <div className="grid gap-5 xl:grid-cols-2"><article className="rounded-2xl border border-white/[0.08] bg-black/25 p-5"><div className="flex items-start justify-between gap-4"><div><h3 className="text-sm font-black text-white">Payment intent status</h3><p className="mt-1 text-xs leading-relaxed text-white/40">Provider-neutral intent counts. Completion is only meaningful after signed provider confirmation and downstream reconciliation.</p></div><Wallet className="h-5 w-5 text-primary" /></div><div className="mt-4 flex flex-wrap gap-2">{commandOverviewQuery.data.payments.length ? commandOverviewQuery.data.payments.map((payment) => <div key={payment.status} className="rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 py-2"><p className="text-lg font-black text-white">{payment.count}</p><p className="text-[10px] font-bold uppercase tracking-wider text-white/40">{payment.status.replaceAll('_', ' ')}</p></div>) : <p className="rounded-xl border border-dashed border-white/[0.1] p-4 text-xs leading-relaxed text-white/35">No payment intents have been recorded yet.</p>}</div></article><article className="rounded-2xl border border-white/[0.08] bg-black/25 p-5"><div className="flex items-start justify-between gap-4"><div><h3 className="text-sm font-black text-white">Payout lifecycle</h3><p className="mt-1 text-xs leading-relaxed text-white/40">Status totals are read-only here. Do not re-approve or retry requests that are already executing with a risk hold.</p></div><Clock3 className="h-5 w-5 text-primary" /></div><div className="mt-4 flex flex-wrap gap-2">{commandOverviewQuery.data.payoutStatusCounts.length ? commandOverviewQuery.data.payoutStatusCounts.map((payout) => <div key={payout.status} className="rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 py-2"><p className="text-lg font-black text-white">{payout.count}</p><p className="text-[10px] font-bold uppercase tracking-wider text-white/40">{payout.status.replaceAll('_', ' ')}</p></div>) : <p className="rounded-xl border border-dashed border-white/[0.1] p-4 text-xs leading-relaxed text-white/35">No payout requests have entered the lifecycle.</p>}</div></article></div>
            <article className="overflow-hidden rounded-2xl border border-white/[0.08] bg-black/25"><div className="flex flex-col gap-2 border-b border-white/[0.07] px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="text-sm font-black text-white">Settled platform revenue by asset</h3><p className="mt-1 text-xs leading-relaxed text-white/40">Immutable platform revenue movements only. Values remain separated by crypto asset and reflect actual movement rows, not estimated treasury balances.</p></div><Button size="sm" variant="secondary" className="w-fit text-xs font-black" onClick={() => setTab('finance')}>Finance detail</Button></div>{commandOverviewQuery.data.revenueByAsset.length ? <div className="grid divide-y divide-white/[0.06] sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">{commandOverviewQuery.data.revenueByAsset.map((asset) => <div key={asset.currency} className="p-4"><div className="flex items-center justify-between"><span className="font-black text-white">{asset.currency}</span><Landmark className="h-4 w-4 text-primary" /></div><p className="mt-3 text-sm font-black text-white">{asset.platformFeeAmount}</p><p className="text-[10px] font-bold uppercase tracking-widest text-white/35">Platform 5% movements</p><div className="mt-3 space-y-1 text-[11px] text-white/45"><p>Gross {asset.grossAmount}</p><p>Creator net {asset.creatorNetAmount}</p></div></div>)}</div> : <p className="p-6 text-sm text-white/40">No settled platform-revenue movements have been recorded.</p>}</article>
          </> : <div className="rounded-2xl border border-red-300/20 bg-red-400/[0.05] p-5 text-sm text-red-100"><p className="font-black">The owner overview could not load</p><p className="mt-1 leading-relaxed text-red-100/70">Kryv cannot safely summarize the platform command state while the authoritative overview is unavailable.</p><Button type="button" variant="outline" onClick={() => commandOverviewQuery.refetch()} className="mt-4 border-red-200/25 bg-red-200/[0.08] font-black text-red-50 hover:bg-red-200/[0.14] hover:text-red-50">Retry overview</Button></div>}
        </section>
      )}

      {tab === 'analytics' && (
        <section className="space-y-5">
          <div className="rounded-2xl border border-primary/20 bg-[radial-gradient(circle_at_top_right,rgba(51,238,196,0.14),transparent_38%),linear-gradient(130deg,rgba(91,70,255,0.12),rgba(8,10,15,0.96)_58%)] p-5 sm:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-2 text-primary"><Activity className="h-5 w-5" /><h2 className="text-lg font-black text-white">Connected platform analytics</h2></div><p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/55">Stream sessions, recorded chat activity, active memberships, top live creators, and immutable revenue movements. This view does not create estimates for watch time, conversion, or fiat value.</p></div><div className="flex w-full rounded-xl border border-white/[0.1] bg-black/25 p-1 sm:w-auto">{([1, 7, 30] as const).map((days) => <button key={days} type="button" onClick={() => setAnalyticsRangeDays(days)} className={`min-h-10 flex-1 rounded-lg px-3 text-xs font-black transition sm:flex-none ${analyticsRangeDays === days ? 'bg-primary text-primary-foreground' : 'text-white/45 hover:text-white'}`}>{days === 1 ? '24h' : `${days}d`}</button>)}</div></div></div>
          {adminAnalyticsQuery.isLoading ? <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div> : adminAnalyticsQuery.data ? <><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5"><StatCard label="Streams" value={adminAnalyticsQuery.data.summary.streamSessions} icon={Radio} accent /><div className="rounded-xl border border-white/[0.08] bg-black/40 p-4"><p className="text-2xl font-display font-black leading-none text-white">{formatDuration(adminAnalyticsQuery.data.summary.streamSeconds)}</p><p className="mt-1 text-xs text-white/40">Time live</p></div><StatCard label="Chat messages" value={adminAnalyticsQuery.data.summary.chatMessages} icon={Activity} /><StatCard label="Active creators" value={adminAnalyticsQuery.data.summary.activeCreators} icon={Users} /><StatCard label="Active memberships" value={adminAnalyticsQuery.data.summary.activeSubscriptions} icon={Crown} /></div>
            <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]"><article className="rounded-2xl border border-white/[0.08] bg-black/25 p-5"><div><h3 className="text-sm font-black text-white">Recorded activity by day</h3><p className="mt-1 text-xs leading-relaxed text-white/40">Bars compare the actual count of stream sessions with recorded chat messages in each populated day. Blank days are not invented.</p></div>{adminAnalyticsQuery.data.activity.length ? <div className="mt-6 flex h-52 items-end gap-2 overflow-x-auto pb-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{adminAnalyticsQuery.data.activity.map((point) => { const maxValue = Math.max(...adminAnalyticsQuery.data.activity.flatMap((item) => [item.streamSessions, item.chatMessages]), 1); return <div key={point.bucket} className="flex min-w-11 flex-1 flex-col items-center justify-end gap-1.5" title={`${point.bucket}: ${point.streamSessions} streams, ${point.chatMessages} chat messages`}><div className="flex h-40 items-end gap-1"><span className="w-3 rounded-t bg-primary/90" style={{ height: `${Math.max(4, (point.streamSessions / maxValue) * 100)}%` }} /><span className="w-3 rounded-t bg-fuchsia-300/85" style={{ height: `${Math.max(4, (point.chatMessages / maxValue) * 100)}%` }} /></div><span className="whitespace-nowrap text-[9px] font-bold text-white/35">{point.bucket.slice(5)}</span></div>; })}</div> : <div className="mt-5 rounded-xl border border-dashed border-white/[0.1] p-6 text-sm text-white/40">No recorded stream sessions or chat messages fall within this range.</div>}<div className="mt-2 flex gap-4 text-[10px] font-bold uppercase tracking-wider text-white/40"><span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-primary" /> Streams</span><span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-fuchsia-300" /> Chat messages</span></div></article>
              <article className="rounded-2xl border border-white/[0.08] bg-black/25 p-5"><div><h3 className="text-sm font-black text-white">Top live creators</h3><p className="mt-1 text-xs leading-relaxed text-white/40">Ranked by recorded stream sessions during the selected range, with session duration and creator-side chat totals.</p></div><div className="mt-4 space-y-2">{adminAnalyticsQuery.data.topCreators.length ? adminAnalyticsQuery.data.topCreators.map((creator, index) => <div key={creator.channelId} className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-black text-primary">{index + 1}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-white">{creator.channelDisplayName}</p><p className="mt-1 text-[10px] text-white/40">{creator.streamSessions} streams · {formatDuration(creator.streamSeconds)} · {creator.chatMessages} chat</p></div></div>) : <p className="rounded-xl border border-dashed border-white/[0.1] p-5 text-xs text-white/35">No creator stream records fall within this range.</p>}</div></article></div>
            <article className="overflow-hidden rounded-2xl border border-white/[0.08] bg-black/25"><div className="border-b border-white/[0.07] px-5 py-4"><h3 className="text-sm font-black text-white">Confirmed revenue movements by asset</h3><p className="mt-1 text-xs leading-relaxed text-white/40">Revenue is shown only from immutable allocation rows created after confirmed settlement. Gross, 5% platform fee, and 95% creator net remain separate crypto-asset amounts.</p></div>{adminAnalyticsQuery.data.revenueByAsset.length ? <div className="grid divide-y divide-white/[0.07] sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">{adminAnalyticsQuery.data.revenueByAsset.map((asset) => <div key={asset.currency} className="p-4"><p className="font-black text-white">{asset.currency}</p><p className="mt-3 text-lg font-black text-primary">{asset.platformFeeAmount}</p><p className="text-[10px] font-bold uppercase tracking-wider text-white/35">Platform fee movements</p><div className="mt-3 space-y-1 text-[11px] text-white/45"><p>Gross {asset.grossAmount}</p><p>Creator net {asset.creatorNetAmount}</p></div></div>)}</div> : <p className="p-6 text-sm text-white/40">No immutable revenue movements were recorded in this range.</p>}</article>
          </> : <div className="rounded-2xl border border-red-300/20 bg-red-400/[0.05] p-5 text-sm text-red-100"><p className="font-black">Analytics could not load</p><p className="mt-1 leading-relaxed text-red-100/70">Kryv cannot safely present partial activity, creator, membership, or revenue metrics while the connected analytics query is unavailable.</p><Button type="button" variant="outline" onClick={() => adminAnalyticsQuery.refetch()} className="mt-4 border-red-200/25 bg-red-200/[0.08] font-black text-red-50 hover:bg-red-200/[0.14] hover:text-red-50">Retry analytics</Button></div>}
        </section>
      )}

      {tab === 'finance' && (
        <section className="space-y-5">
          <div className="rounded-2xl border border-primary/20 bg-primary/[0.045] p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div><div className="flex items-center gap-2 text-primary"><Landmark className="h-5 w-5" /><h2 className="text-lg font-black">Finance Command</h2></div><p className="mt-1 max-w-3xl text-sm leading-relaxed text-white/50">Server-authoritative creator liabilities, destination-review queue, and payout decisions. Balances remain asset-denominated and destinations stay masked; this screen never exposes provider credentials or full payout addresses.</p></div>
              <div className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-wider ${financeOverviewQuery.data?.providerConfigured ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200' : 'border-amber-300/20 bg-amber-300/10 text-amber-100'}`}><Activity className="h-3.5 w-3.5" /> {financeOverviewQuery.data?.providerConfigured ? 'Provider configuration detected' : 'Provider configuration pending'}</div>
            </div>
          </div>

          {financeOverviewQuery.isLoading ? <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div> : financeOverviewQuery.isError ? <div className="rounded-2xl border border-red-300/20 bg-red-400/[0.05] p-5 text-sm text-red-100"><p className="font-black">Finance overview is temporarily unavailable</p><p className="mt-1 leading-relaxed text-red-100/70">Kryv cannot safely present creator liabilities, payout queue totals, or provider configuration state while the authoritative overview is unavailable.</p><Button type="button" variant="outline" onClick={() => financeOverviewQuery.refetch()} className="mt-4 border-red-200/25 bg-red-200/[0.08] font-black text-red-50 hover:bg-red-200/[0.14] hover:text-red-50">Retry Finance Command</Button></div> : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Profile reviews" value={financeOverviewQuery.data?.pendingProfileReviews ?? 0} icon={ShieldCheck} accent />
                <StatCard label="Payout queue" value={financeOverviewQuery.data?.requestedPayouts ?? 0} icon={Clock3} />
                <StatCard label="Payout requests" value={financeOverviewQuery.data?.payoutRequestsEnabled ? 1 : 0} icon={Wallet} accent={Boolean(financeOverviewQuery.data?.payoutRequestsEnabled)} />
                <StatCard label="Provider withdrawals" value={financeOverviewQuery.data?.providerWithdrawalsEnabled ? 1 : 0} icon={Send} accent={Boolean(financeOverviewQuery.data?.providerWithdrawalsEnabled)} />
              </div>

              <section className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-2 text-primary"><Landmark className="h-4 w-4" /><h3 className="text-sm font-black text-white">Treasury operating context</h3></div><p className="mt-1 max-w-3xl text-xs leading-relaxed text-white/45">A safe, owner-visible label and note for the finance desk. This is not a wallet configuration surface and cannot store provider keys, seed phrases, full addresses, custody data, or payout instructions.</p></div>{treasuryContextQuery.data?.updatedAt && <p className="shrink-0 text-[10px] text-white/35">Updated {new Date(treasuryContextQuery.data.updatedAt).toLocaleString()}</p>}</div>{treasuryContextQuery.isLoading ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div> : treasuryContextQuery.isError ? <div className="mt-4 rounded-xl border border-red-300/20 bg-red-400/[0.05] p-3 text-xs text-red-100">The safe treasury context could not be loaded. No context values are shown or changed.</div> : <form onSubmit={saveTreasuryContext} className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)_auto]"><label className="text-xs font-bold text-white/65">Desk label<input value={treasuryLabel} onChange={(event) => setTreasuryLabel(event.target.value)} maxLength={120} placeholder="e.g. Kryv operating treasury" className="mt-1.5 h-10 w-full rounded-xl border border-white/[0.1] bg-black/30 px-3 text-sm text-white outline-none focus:border-primary/60" /></label><label className="text-xs font-bold text-white/65">Safe operating note<textarea value={treasuryNotes} onChange={(event) => setTreasuryNotes(event.target.value)} maxLength={2000} rows={3} placeholder="Non-secret handoff context for the operator desk" className="mt-1.5 w-full resize-y rounded-xl border border-white/[0.1] bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-primary/60" /></label><div className="flex items-end"><Button type="submit" disabled={updateAdminTreasuryContext.isPending} className="min-h-11 w-full font-black lg:w-auto">{updateAdminTreasuryContext.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save safe context'}</Button></div></form>}<p className="mt-3 text-[10px] leading-relaxed text-amber-100/75">Hard boundary: provider withdrawals, customer custody, scheduled payout requests, and ad delivery remain operationally disabled. Saving this context does not alter those gates.</p></section>

              <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-black/25">
                <div className="flex flex-col gap-2 border-b border-white/[0.07] px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="text-sm font-black text-white">Creator liability by asset</h3><p className="mt-1 text-xs text-white/40">On-platform pending, available, and held balance projections. These are not provider treasury balances.</p></div><span className="text-[10px] font-bold uppercase tracking-widest text-white/35">Crypto only</span></div>
                <div className="grid grid-cols-1 divide-y divide-white/[0.06] sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">{financeOverviewQuery.data?.assetLiabilities.length ? financeOverviewQuery.data.assetLiabilities.map((asset) => <div key={asset.currency} className="p-4"><div className="flex items-center justify-between"><span className="font-black text-white">{asset.currency}</span><Wallet className="h-4 w-4 text-primary" /></div><p className="mt-3 text-sm font-black text-white">{asset.availableAmount}</p><p className="text-[10px] font-bold uppercase tracking-widest text-white/35">Available liability</p><div className="mt-3 flex justify-between text-[11px] text-white/45"><span>Pending {asset.pendingAmount}</span><span>Held {asset.heldAmount}</span></div></div>) : <div className="col-span-full p-6 text-sm text-white/40">No creator balances have settled yet.</div>}</div>
              </div>

              <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
                <article className="overflow-hidden rounded-2xl border border-white/[0.08] bg-black/25"><div className="border-b border-white/[0.07] p-5"><div className="flex items-start justify-between gap-4"><div><h3 className="text-sm font-black text-white">Creator balance registry</h3><p className="mt-1 text-xs leading-relaxed text-white/40">Current balances grouped by creator and asset. Select a row to inspect the corresponding immutable movement history.</p></div><span className="shrink-0 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[9px] font-black uppercase text-white/45">{creatorBalancesQuery.data?.length ?? 0} assets</span></div></div><div className="max-h-[31rem] divide-y divide-white/[0.06] overflow-y-auto p-2">{creatorBalancesQuery.isLoading ? <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div> : creatorBalancesQuery.data?.length ? creatorBalancesQuery.data.map((balance) => <button key={`${balance.channelId}-${balance.currency}`} type="button" onClick={() => setSelectedCreatorBalanceChannelId(balance.channelId)} aria-pressed={selectedCreatorBalanceChannelId === balance.channelId} className={`w-full rounded-xl p-3 text-left transition ${selectedCreatorBalanceChannelId === balance.channelId ? 'bg-primary/10 ring-1 ring-primary/35' : 'hover:bg-white/[0.045]'}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-bold text-white">{balance.channelDisplayName}</p><p className="mt-1 truncate text-[10px] text-white/35">@{balance.creatorUsername} · {balance.currency}</p></div><span className="shrink-0 text-xs font-black text-primary">{balance.availableAmount}</span></div><div className="mt-2 flex gap-3 text-[10px] text-white/45"><span>Pending {balance.pendingAmount}</span><span>Held {balance.heldAmount}</span></div></button>) : <p className="m-3 rounded-xl border border-dashed border-white/[0.1] p-4 text-xs leading-relaxed text-white/35">No current creator balance records have been created from settled ledger activity.</p>}</div></article>
                <article className="overflow-hidden rounded-2xl border border-white/[0.08] bg-black/25"><div className="border-b border-white/[0.07] p-5"><h3 className="text-sm font-black text-white">Balance fluctuation drilldown</h3><p className="mt-1 text-xs leading-relaxed text-white/40">Amounts remain in their original crypto assets. This view is read-only and never reveals custody addresses or payout destinations.</p></div>{selectedCreatorBalanceChannelId === null ? <div className="flex min-h-64 items-center justify-center p-6 text-center text-sm text-white/40">Select a creator balance from the registry to inspect current liabilities and the latest 50 immutable movements.</div> : creatorBalanceDetailQuery.isLoading ? <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : creatorBalanceDetailQuery.data ? <div className="p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-base font-black text-white">{creatorBalanceDetailQuery.data.channelDisplayName}</p><p className="mt-1 text-xs text-white/40">@{creatorBalanceDetailQuery.data.creatorUsername}</p></div><Link href={`/profile/${creatorBalanceDetailQuery.data.channelSlug}`} className="text-xs font-black text-primary hover:text-white">Public profile</Link></div><div className="mt-5 grid gap-3 sm:grid-cols-2">{creatorBalanceDetailQuery.data.balances.map((balance) => <div key={balance.currency} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3"><div className="flex items-center justify-between"><span className="font-black text-white">{balance.currency}</span><span className="text-xs font-black text-primary">{balance.availableAmount}</span></div><p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-white/35">Available liability</p><div className="mt-3 flex justify-between gap-3 text-[10px] text-white/45"><span>Pending {balance.pendingAmount}</span><span>Held {balance.heldAmount}</span></div></div>)}</div><div className="mt-5"><h4 className="text-xs font-black text-white">Immutable movements</h4><div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">{creatorBalanceDetailQuery.data.movements.length ? creatorBalanceDetailQuery.data.movements.map((movement) => <article key={movement.id} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold text-white">{movement.movementType.replaceAll('_', ' ')}</p><p className="mt-1 text-[10px] uppercase tracking-wider text-white/35">{movement.sourceType} · {movement.currency}</p></div><p className="text-[10px] text-white/30">{new Date(movement.createdAt).toLocaleString()}</p></div><div className="mt-2 grid grid-cols-3 gap-2 text-[10px]"><span className={movement.availableDelta.startsWith('-') ? 'text-red-200' : 'text-emerald-200'}>Available {movement.availableDelta}</span><span className={movement.heldDelta.startsWith('-') ? 'text-red-200' : 'text-amber-100'}>Held {movement.heldDelta}</span><span className={movement.pendingDelta.startsWith('-') ? 'text-red-200' : 'text-white/55'}>Pending {movement.pendingDelta}</span></div></article>) : <p className="rounded-xl border border-dashed border-white/[0.1] p-4 text-xs text-white/35">No immutable balance movements have been recorded for this creator.</p>}</div></div></div> : <div className="p-6 text-sm text-red-200">The selected creator balance detail could not load.</div>}</article>
              </section>

              <div className="grid gap-5 xl:grid-cols-2">
                <div className="rounded-2xl border border-white/[0.08] bg-black/25 p-5"><div className="flex items-start justify-between gap-4"><div><h3 className="text-sm font-black text-white">Payout destination review</h3><p className="mt-1 text-xs leading-relaxed text-white/40">Review only the asset and masked value. Approval confirms the record for payout requests; it does not move funds.</p></div><span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[9px] font-black uppercase text-white/45">{payoutProfilesQuery.data?.length ?? 0} records</span></div><div className="mt-4 space-y-3">{payoutProfilesQuery.isLoading ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div> : payoutProfilesQuery.data?.length ? payoutProfilesQuery.data.map((profile) => <article key={profile.id} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-bold text-white">{profile.creatorUsername} · {profile.channelDisplayName}</p><p className="mt-1 font-mono text-xs text-white/45">{profile.currency} · {profile.addressMasked}</p><p className="mt-1 text-[10px] text-white/30">Updated {new Date(profile.updatedAt).toLocaleString()}</p></div><span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${profile.reviewStatus === 'approved' ? 'bg-emerald-300/10 text-emerald-200' : profile.reviewStatus === 'rejected' ? 'bg-red-400/10 text-red-200' : 'bg-amber-300/10 text-amber-100'}`}>{profile.reviewStatus}</span></div>{profile.reviewStatus === 'pending' && <div className="mt-3 flex gap-2"><Button size="sm" className="h-8 flex-1 text-xs font-black" disabled={reviewAdminPayoutProfile.isPending} onClick={() => reviewPayoutProfile(profile.id, 'approved')}><CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Approve</Button><Button size="sm" variant="secondary" className="h-8 flex-1 text-xs font-black" disabled={reviewAdminPayoutProfile.isPending} onClick={() => reviewPayoutProfile(profile.id, 'rejected')}><XCircle className="mr-1.5 h-3.5 w-3.5" /> Reject</Button></div>}</article>) : <p className="rounded-xl border border-dashed border-white/[0.1] p-5 text-xs text-white/35">No creator payout destinations are awaiting review.</p>}</div></div>

                <div className="rounded-2xl border border-white/[0.08] bg-black/25 p-5"><div className="flex items-start justify-between gap-4"><div><h3 className="text-sm font-black text-white">Payout review queue</h3><p className="mt-1 text-xs leading-relaxed text-white/40">Approve for controlled release, hold for investigation, or reject to release the reserved creator balance. Approval is not a provider withdrawal.</p></div><span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[9px] font-black uppercase text-white/45">{payoutRequestsQuery.data?.length ?? 0} records</span></div><div className="mt-4 space-y-3">{payoutRequestsQuery.isLoading ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div> : payoutRequestsQuery.data?.length ? payoutRequestsQuery.data.map((request) => <article key={request.id} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-bold text-white">{request.creatorUsername} · {request.amount} {request.currency}</p><p className="mt-1 font-mono text-xs text-white/45">{request.destinationMasked ?? 'No destination snapshot'}</p><p className="mt-1 text-[10px] text-white/30">{request.requestSource} request · {new Date(request.requestedAt).toLocaleString()}</p>{request.riskHoldReason && <p className="mt-2 text-[11px] text-amber-100/75">{request.riskHoldReason}</p>}</div><span className="rounded-full bg-primary/10 px-2 py-1 text-[9px] font-black uppercase text-primary">{request.status}</span></div>{['requested', 'held'].includes(request.status) && <div className="mt-3 grid grid-cols-3 gap-2"><Button size="sm" className="h-8 text-[10px] font-black" disabled={reviewAdminPayoutRequest.isPending} onClick={() => reviewPayoutRequest(request.id, 'approved')}>Approve</Button><Button size="sm" variant="secondary" className="h-8 text-[10px] font-black" disabled={reviewAdminPayoutRequest.isPending} onClick={() => reviewPayoutRequest(request.id, 'held')}>Hold</Button><Button size="sm" variant="secondary" className="h-8 text-[10px] font-black" disabled={reviewAdminPayoutRequest.isPending} onClick={() => reviewPayoutRequest(request.id, 'rejected')}>Reject</Button></div>}</article>) : <p className="rounded-xl border border-dashed border-white/[0.1] p-5 text-xs text-white/35">No payout requests have entered the queue.</p>}</div></div>
              </div>

              <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-black/25"><div className="flex flex-col gap-3 border-b border-white/[0.07] px-5 py-4 sm:flex-row sm:items-start sm:justify-between"><div><h3 className="text-sm font-black text-white">Immutable finance ledger</h3><p className="mt-1 max-w-3xl text-xs leading-relaxed text-white/40">Recent platform revenue, creator balance deltas, and provider-event outcomes. IDs, payment references, destination addresses, and secrets are intentionally excluded. Ledger rows are read-only; do not infer a retry from a held or executing payout.</p></div><span className="w-fit rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-white/45">Latest 30 each</span></div>{financeLedgerQuery.isLoading ? <div className="flex justify-center py-14"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : <div className="grid divide-y divide-white/[0.07] xl:grid-cols-3 xl:divide-x xl:divide-y-0"><div className="p-4"><div className="flex items-center gap-2"><Landmark className="h-4 w-4 text-primary" /><h4 className="text-xs font-black text-white">Platform revenue</h4></div><p className="mt-1 text-[10px] leading-relaxed text-white/35">Confirmed allocation rows; gross, platform fee, and creator net remain asset-denominated.</p><div className="mt-4 space-y-2">{financeLedgerQuery.data?.platformRevenue.length ? financeLedgerQuery.data.platformRevenue.map((movement) => <article key={movement.id} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-xs font-bold text-white">{movement.channelDisplayName}</p><p className="mt-1 text-[10px] uppercase tracking-wider text-white/35">{movement.paymentKind} · {movement.sourceType}</p></div><span className="shrink-0 text-xs font-black text-primary">{movement.platformFeeAmount} {movement.currency}</span></div><div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-white/45"><span>Gross {movement.grossAmount}</span><span>Creator net {movement.creatorNetAmount}</span></div><p className="mt-2 text-[10px] text-white/30">{new Date(movement.createdAt).toLocaleString()}</p></article>) : <p className="rounded-xl border border-dashed border-white/[0.1] p-4 text-xs leading-relaxed text-white/35">No platform revenue movements have settled.</p>}</div></div><div className="p-4"><div className="flex items-center gap-2"><Wallet className="h-4 w-4 text-primary" /><h4 className="text-xs font-black text-white">Creator balance fluctuations</h4></div><p className="mt-1 text-[10px] leading-relaxed text-white/35">Available, held, and pending deltas come directly from immutable creator balance movements.</p><div className="mt-4 space-y-2">{financeLedgerQuery.data?.creatorBalanceMovements.length ? financeLedgerQuery.data.creatorBalanceMovements.map((movement) => <article key={movement.id} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-xs font-bold text-white">{movement.channelDisplayName}</p><p className="mt-1 text-[10px] uppercase tracking-wider text-white/35">{movement.movementType} · {movement.sourceType}</p></div><span className="shrink-0 text-xs font-black text-white">{movement.currency}</span></div><div className="mt-2 grid grid-cols-3 gap-2 text-[10px]"><span className={movement.availableDelta.startsWith('-') ? 'text-red-200' : 'text-emerald-200'}>Available {movement.availableDelta}</span><span className={movement.heldDelta.startsWith('-') ? 'text-red-200' : 'text-amber-100'}>Held {movement.heldDelta}</span><span className={movement.pendingDelta.startsWith('-') ? 'text-red-200' : 'text-white/55'}>Pending {movement.pendingDelta}</span></div><p className="mt-2 text-[10px] text-white/30">{new Date(movement.createdAt).toLocaleString()}</p></article>) : <p className="rounded-xl border border-dashed border-white/[0.1] p-4 text-xs leading-relaxed text-white/35">No creator-balance movements have been recorded.</p>}</div></div><div className="p-4"><div className="flex items-center gap-2"><Activity className="h-4 w-4 text-primary" /><h4 className="text-xs font-black text-white">Payment event outcomes</h4></div><p className="mt-1 text-[10px] leading-relaxed text-white/35">Sanitized callback processing states only. Resolve callback errors through the controlled incident process, not by re-crediting a ledger row.</p><div className="mt-4 space-y-2">{financeLedgerQuery.data?.paymentEvents.length ? financeLedgerQuery.data.paymentEvents.map((event) => <article key={event.id} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-xs font-bold text-white">{event.eventType.replaceAll('_', ' ')}</p><p className="mt-1 text-[10px] uppercase tracking-wider text-white/35">{event.provider} · {event.processingStatus}</p></div><span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-black uppercase ${event.processingStatus === 'processed' ? 'bg-emerald-300/10 text-emerald-200' : event.processingStatus === 'failed' ? 'bg-red-400/10 text-red-200' : 'bg-amber-300/10 text-amber-100'}`}>{event.processingStatus}</span></div>{event.errorCode && <p className="mt-2 text-[10px] text-red-200/75">Error code: {event.errorCode}</p>}<p className="mt-2 text-[10px] text-white/30">{new Date(event.processedAt ?? event.createdAt).toLocaleString()}</p></article>) : <p className="rounded-xl border border-dashed border-white/[0.1] p-4 text-xs leading-relaxed text-white/35">No payment callback events have been recorded.</p>}</div></div></div>}</section>

              <p className="rounded-2xl border border-amber-300/15 bg-amber-300/[0.05] p-4 text-xs leading-relaxed text-amber-100/75">Provider withdrawals are hard-disabled. Request-IP rules, asset balances, fee estimation, callback reconciliation, response monitoring, and an incident runbook are prerequisites for a separate future launch decision; they cannot be activated from this console.</p>
            </>
          )}
        </section>
      )}

      {tab === 'ads' && (
        <section className="space-y-5">
          <div className="rounded-2xl border border-primary/20 bg-primary/[0.045] p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-2 text-primary"><Landmark className="h-5 w-5" /><h2 className="text-lg font-black">Advertising Command</h2></div><p className="mt-1 max-w-3xl text-sm leading-relaxed text-white/50">Run Kryv-controlled promotional flights and crypto-funded advertiser campaigns. A campaign cannot serve until its owner approval, funding state, delivery window, rule, creative, consent, and feature gate all pass.</p></div><span className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-wider ${adsOverviewQuery.data?.deliveryEnabled ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200' : 'border-amber-300/20 bg-amber-300/10 text-amber-100'}`}><Activity className="h-3.5 w-3.5" /> {adsOverviewQuery.data?.deliveryEnabled ? 'Delivery gate enabled' : 'Delivery gate closed'}</span></div>
            {!adsOverviewQuery.data?.deliveryEnabled && <p className="mt-4 rounded-xl border border-amber-300/15 bg-amber-300/[0.06] p-3 text-xs leading-relaxed text-amber-100/75">Advertising delivery, campaign creation, funding invoices, and campaign approval are hard-disabled until consent, creative review, measurement, and an operator kill switch are launched together.</p>}
          </div>

          <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
            <form onSubmit={createAdvertisingCampaign} className="rounded-2xl border border-white/[0.08] bg-black/25 p-5"><div><h3 className="text-sm font-black text-white">Draft a campaign</h3><p className="mt-1 text-xs leading-relaxed text-white/40">Promotional flights are free, time-bounded owner campaigns. Paid campaigns create a crypto invoice and remain blocked until a signed funding confirmation is reconciled.</p></div><div className="mt-5 space-y-3"><label className="block text-xs font-bold text-white/65">Campaign name<input required value={adCampaignName} onChange={event => setAdCampaignName(event.target.value)} maxLength={140} placeholder="Launch partner campaign" className="mt-1.5 h-10 w-full rounded-xl border border-white/[0.1] bg-black/30 px-3 text-sm text-white outline-none focus:border-primary/60" /></label><label className="block text-xs font-bold text-white/65">Advertiser or partner<label className="ml-1 text-white/30">optional</label><input value={adAdvertiserName} onChange={event => setAdAdvertiserName(event.target.value)} maxLength={140} placeholder="Partner name" className="mt-1.5 h-10 w-full rounded-xl border border-white/[0.1] bg-black/30 px-3 text-sm text-white outline-none focus:border-primary/60" /></label><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold text-white/65">Campaign mode<select value={adFundingMode} onChange={event => setAdFundingMode(event.target.value as typeof adFundingMode)} className="mt-1.5 h-10 w-full rounded-xl border border-white/[0.1] bg-black/30 px-3 text-sm text-white outline-none focus:border-primary/60"><option value="promotional">Free promotional flight</option><option value="paid">Crypto-funded campaign</option></select></label><label className="text-xs font-bold text-white/65">Ends at<input required type="datetime-local" value={adEndsAt} onChange={event => setAdEndsAt(event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-white/[0.1] bg-black/30 px-3 text-sm text-white outline-none focus:border-primary/60" /></label></div>{adFundingMode === 'paid' && <label className="block text-xs font-bold text-white/65">Budget reference (USD)<input required inputMode="decimal" value={adBudgetUsd} onChange={event => setAdBudgetUsd(event.target.value)} placeholder="250.00" className="mt-1.5 h-10 w-full rounded-xl border border-white/[0.1] bg-black/30 px-3 text-sm text-white outline-none focus:border-primary/60" /><span className="mt-1 block text-[10px] leading-relaxed text-white/30">Used only to request the exact crypto invoice. Kryv does not create a fiat charge.</span></label>}<label className="block text-xs font-bold text-white/65">Creator ad allocation (%)<input inputMode="decimal" value={adCreatorShare} onChange={event => setAdCreatorShare(event.target.value)} placeholder="0" className="mt-1.5 h-10 w-full rounded-xl border border-white/[0.1] bg-black/30 px-3 text-sm text-white outline-none focus:border-primary/60" /><span className="mt-1 block text-[10px] leading-relaxed text-white/30">Defaults to 0%. A creator ad allocation requires separate qualified-delivery accounting; it is never forecast or automatically credited.</span></label></div><Button type="submit" disabled={createAdminAdCampaign.isPending || !adsOverviewQuery.data?.deliveryEnabled || !adCampaignName.trim()} className="mt-5 w-full font-black">{createAdminAdCampaign.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating…</> : <><Plus className="mr-2 h-4 w-4" /> Create draft campaign</>}</Button></form>

            <div className="rounded-2xl border border-white/[0.08] bg-black/25 p-5"><h3 className="text-sm font-black text-white">Campaign revenue controls</h3><div className="mt-4 grid gap-3 sm:grid-cols-2"><StatCard label="Pending fundings" value={adsOverviewQuery.data?.pendingFundings ?? 0} icon={Clock3} /><StatCard label="Confirmed fundings" value={adsOverviewQuery.data?.confirmedFundings ?? 0} icon={CheckCircle2} accent /></div><div className="mt-4 space-y-2">{adsOverviewQuery.data?.revenue.length ? adsOverviewQuery.data.revenue.map((revenue) => <div key={revenue.currency} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3"><div className="flex items-center justify-between"><span className="font-black text-white">{revenue.currency}</span><span className="text-[10px] font-black uppercase tracking-wider text-primary">Advertiser funding settled</span></div><div className="mt-3 grid grid-cols-3 gap-2 text-[11px]"><div><p className="text-white/35">Gross</p><p className="mt-1 font-bold text-white">{revenue.grossAmount}</p></div><div><p className="text-white/35">Platform</p><p className="mt-1 font-bold text-emerald-200">{revenue.platformAmount}</p></div><div><p className="text-white/35">Creators</p><p className="mt-1 font-bold text-white">{revenue.creatorAmount}</p></div></div></div>) : <p className="rounded-xl border border-dashed border-white/[0.1] p-4 text-xs leading-relaxed text-white/35">No advertiser funding has settled. Kryv will not show projected or invented ad revenue.</p>}</div><div className="mt-4 rounded-xl border border-amber-300/15 bg-amber-300/[0.05] p-3 text-[11px] leading-relaxed text-amber-100/75"><b className="font-black">Guardrail:</b> advertiser funding is platform revenue only until a campaign has an explicit creator allocation and qualified-delivery accounting. The 95/5 creator split for subscriptions and tips remains separate.</div></div>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-black/25 p-5"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><h3 className="text-sm font-black text-white">Campaign command queue</h3><p className="mt-1 text-xs leading-relaxed text-white/40">Approval never bypasses funding, creative, rule, consent, or ad-delivery kill-switch checks.</p></div><Button type="button" variant="secondary" size="sm" onClick={() => refreshAdsCommand()} disabled={adsOverviewQuery.isFetching} className="w-fit font-black">{adsOverviewQuery.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh'}</Button></div><div className="mt-4 space-y-3">{adsOverviewQuery.isLoading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : adsOverviewQuery.data?.campaigns.length ? adsOverviewQuery.data.campaigns.map((campaign) => <article key={campaign.id} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h4 className="text-sm font-black text-white">{campaign.name}</h4><span className="rounded-full bg-primary/10 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-primary">{campaign.fundingMode}</span><span className="rounded-full bg-white/[0.07] px-2 py-1 text-[9px] font-black uppercase tracking-wider text-white/55">{campaign.status}</span></div><p className="mt-1 text-xs text-white/40">{campaign.advertiserName ?? 'Kryv house campaign'} · ends {campaign.endsAt ? new Date(campaign.endsAt).toLocaleString() : 'not scheduled'}</p><p className="mt-2 text-[11px] text-white/35">Funding: <b className="text-white/65">{campaign.fundingStatus.replaceAll('_', ' ')}</b> · creator allocation: <b className="text-white/65">{(campaign.creatorShareBps / 100).toFixed(2)}%</b>{campaign.budgetAmount ? ` · USD reference ${campaign.budgetAmount}` : ''}</p></div><div className="flex shrink-0 flex-wrap gap-2">{campaign.fundingMode === 'paid' && !['funded', 'invoice_pending'].includes(campaign.fundingStatus) && <Button size="sm" disabled={createAdminAdFundingInvoice.isPending || !adsOverviewQuery.data?.deliveryEnabled} onClick={() => createAdvertisingFundingInvoice(campaign.id)} className="h-8 text-[10px] font-black">{createAdminAdFundingInvoice.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Create crypto invoice'}</Button>}{campaign.status !== 'active' && (campaign.fundingMode === 'promotional' || campaign.fundingStatus === 'funded') && <Button size="sm" variant="secondary" disabled={approveAdminAdCampaign.isPending || !adsOverviewQuery.data?.deliveryEnabled} onClick={() => approveAdvertisingCampaign(campaign.id, campaign.name)} className="h-8 text-[10px] font-black">Approve delivery</Button>}</div></div></article>) : <p className="rounded-xl border border-dashed border-white/[0.1] p-5 text-xs text-white/35">No campaigns have been drafted. Start with a short, owner-approved promotional flight rather than opening delivery globally.</p>}</div></div>

          <div className="grid gap-3 lg:grid-cols-3">{Object.entries(adsOverviewQuery.data?.policy ?? {}).map(([key, value]) => <div key={key} className="rounded-xl border border-white/[0.08] bg-black/25 p-4"><p className="text-[10px] font-black uppercase tracking-widest text-primary">{key.replace(/([A-Z])/g, ' $1')}</p><p className="mt-2 text-xs leading-relaxed text-white/45">{value}</p></div>)}</div>
        </section>
      )}

      {tab === 'safety' && (
        <section className="space-y-5">
          <div className="rounded-2xl border border-red-300/20 bg-red-400/[0.045] p-5 sm:p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-2 text-red-200"><ShieldAlert className="h-5 w-5" /><h2 className="text-lg font-black">Trust &amp; Safety Queue</h2></div><p className="mt-1 max-w-3xl text-sm leading-relaxed text-white/50">Viewer reports preserve the reported message, selected reason, reporter identity, and immutable audit correlation. Resolve or dismiss only after reviewing the captured evidence; a completed decision is not overwritten.</p></div><div className="rounded-full border border-white/[0.1] bg-black/25 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white/55">{moderationCasesQuery.data?.length ?? 0} open</div></div></div>
          {moderationCasesQuery.isLoading ? <div className="flex justify-center py-14"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div> : moderationCasesQuery.data?.length ? <div className="space-y-3">{moderationCasesQuery.data.map((moderationCase) => <article key={moderationCase.id} className="rounded-2xl border border-white/[0.08] bg-black/25 p-4 sm:p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-black text-white">{moderationCase.caseType.replaceAll('_', ' ')}</h3><span className="rounded-full bg-red-400/10 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-red-200">{moderationCase.status}</span></div><p className="mt-2 text-xs leading-relaxed text-white/60">{moderationCase.summary ?? 'No reporter detail was supplied.'}</p><div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-bold uppercase tracking-wider text-white/35"><span>Case #{moderationCase.id}</span><span>Channel {moderationCase.channelId ?? 'not retained'}</span><span>Subject {moderationCase.subjectUsername ?? `user #${moderationCase.subjectUserId ?? 'unknown'}`}</span><span>Reported {new Date(moderationCase.createdAt).toLocaleString()}</span></div>{moderationCase.evidence.length > 0 && <details className="mt-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2"><summary className="cursor-pointer text-[10px] font-black uppercase tracking-wider text-white/45">Captured evidence ({moderationCase.evidence.length})</summary><div className="mt-2 space-y-2">{moderationCase.evidence.map((entry, index) => <div key={index} className="rounded-lg bg-black/25 p-2 text-[11px] leading-relaxed text-white/55">{Object.entries(entry).filter(([key]) => ['kind', 'message', 'title', 'channelSlug', 'reason', 'reportedAt', 'createdAt'].includes(key)).map(([key, value]) => <p key={key}><span className="mr-1 font-black uppercase tracking-wider text-white/35">{key.replaceAll(/([A-Z])/g, ' $1')}:</span>{typeof value === 'string' ? value : String(value)}</p>)}</div>)}</div></details>}</div><div className="grid shrink-0 grid-cols-2 gap-2 sm:w-48"><Button size="sm" className="h-8 text-[10px] font-black" disabled={reviewAdminModerationCase.isPending} onClick={() => reviewModerationCase(moderationCase.id, 'resolved')}><CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Resolve</Button><Button size="sm" variant="secondary" className="h-8 text-[10px] font-black" disabled={reviewAdminModerationCase.isPending} onClick={() => reviewModerationCase(moderationCase.id, 'dismissed')}><XCircle className="mr-1 h-3.5 w-3.5" /> Dismiss</Button></div></div></article>)}</div> : <div className="rounded-2xl border border-dashed border-white/[0.12] bg-white/[0.015] p-8 text-center text-sm text-white/40">No open viewer safety reports. New reports from live chat, creator channels, Clips, and Watch videos will appear here for owner review.</div>}
        </section>
      )}

      {tab === 'operations' && (
        <section className="space-y-4">
          <div className="rounded-2xl border border-primary/20 bg-primary/[0.045] p-5 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div><div className="flex items-center gap-2 text-primary"><ShieldAlert className="h-5 w-5" /><h2 className="text-lg font-black">Operational controls</h2></div><p className="mt-1 max-w-2xl text-sm leading-relaxed text-white/50">Server-enforced feature gates for controlled launch and immediate incident response. Every change is retained in the platform audit ledger.</p></div>
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/25 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white/50"><Zap className="h-3.5 w-3.5 text-primary" /> Kill switches</div>
            </div>
          </div>
          {featureFlagsLoading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (
            <div className="grid gap-4 lg:grid-cols-2">
              {featureFlags?.map((flag) => {
                const isCrypto = flag.key === 'crypto_commerce';
                const label = operationalFlagLabel(flag.key);
                return <article key={flag.key} className={`rounded-2xl border p-5 ${flag.enabled ? 'border-emerald-400/25 bg-emerald-400/[0.045]' : 'border-white/[0.1] bg-black/30'}`}>
                  <div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2"><Power className={`h-4 w-4 ${flag.enabled ? 'text-emerald-300' : 'text-white/35'}`} /><h3 className="text-sm font-black text-white">{label}</h3></div><p className="mt-2 text-xs leading-relaxed text-white/50">{flag.description}</p></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${flag.enabled ? 'bg-emerald-400/15 text-emerald-300' : 'bg-white/[0.07] text-white/45'}`}>{flag.enabled ? 'Enabled' : 'Disabled'}</span></div>
                  {!flag.enabled && <p className="mt-4 rounded-xl border border-amber-300/15 bg-amber-300/[0.06] p-3 text-[11px] leading-relaxed text-amber-100/70">{isCrypto ? 'Before enabling: confirm the provider secret, HTTPS JSON callback URL, public application URL, and signed-callback monitoring are configured in production.' : flag.key === 'provider_withdrawals' ? 'Hard-disabled: provider request-IP rules, asset balances, fee estimation, reconciliation, and an incident-response runbook are prerequisites for a separate future launch.' : flag.key === 'scheduled_payout_requests' ? 'Hard-disabled: a production scheduler, UTC schedule handling, idempotency, retries, and alerting are prerequisites for a separate future launch.' : 'Hard-disabled: complete the documented controlled-launch readiness checks before a separate future launch decision.'}</p>}
                  <div className="mt-5 flex items-center justify-between gap-3"><span className="text-[10px] font-bold text-white/35">Updated {new Date(flag.updatedAt).toLocaleString()}</span><Button variant={flag.enabled ? 'secondary' : 'default'} size="sm" disabled={updateFeatureFlag.isPending || (!flag.enabled && ['ads_delivery', 'customer_wallet_custody', 'scheduled_payout_requests', 'provider_withdrawals'].includes(flag.key))} onClick={() => toggleOperationalFlag(flag.key, !flag.enabled)} className="font-black">{updateFeatureFlag.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : flag.enabled ? 'Disable now' : ['ads_delivery', 'customer_wallet_custody', 'scheduled_payout_requests', 'provider_withdrawals'].includes(flag.key) ? 'Locked disabled' : 'Enable'}</Button></div>
                </article>;
              })}
              {!featureFlags?.length && <div className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.05] p-5 text-sm text-amber-100/80">No operational flags are provisioned. Apply the platform foundations migration before attempting activation.</div>}
            </div>
          )}
        </section>
      )}

      {/* Users table */}
      {tab === 'users' && (
        <>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-black text-white">Users and creator accounts</h2><p className="mt-1 text-xs text-white/40">Search existing authorized user records, then open consent-aware Kryv activity detail or take a reviewed account action.</p></div><label className="relative block sm:w-72"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" /><input value={adminUserSearch} onChange={(event) => { setAdminUserSearch(event.target.value); setAdminUserOffset(0); }} maxLength={80} placeholder="Search username" className="h-11 w-full rounded-xl border border-white/[0.1] bg-black/30 py-2 pl-9 pr-3 text-sm text-white outline-none focus:border-primary/60" /></label></div>
        <div className="overflow-x-auto rounded-xl border border-white/[0.08] bg-black/30 backdrop-blur">
          {userRegistryQuery.isLoading ? (
            <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-white/[0.08] bg-white/[0.02]">
                  <th className="p-3 text-[10px] font-black text-white/40 uppercase tracking-widest">User / ID</th>
                  <th className="p-3 text-[10px] font-black text-white/40 uppercase tracking-widest">Role</th>
                  <th className="p-3 text-[10px] font-black text-white/40 uppercase tracking-widest">Security</th>
                  <th className="p-3 text-[10px] font-black text-white/40 uppercase tracking-widest">Joined</th>
                  <th className="p-3 text-[10px] font-black text-white/40 uppercase tracking-widest text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {userRegistryQuery.data?.items.map((u) => (
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
                        <span className="text-[10px] text-white/30">Open activity detail for consent-aware Kryv history</span>
                      </div>
                    </td>
                    <td className="p-3 text-white/40 text-xs">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-2"><Button size="sm" variant="secondary" onClick={() => setSelectedUserId(u.id)} className="text-xs"><Eye className="mr-1 h-3.5 w-3.5" /> View</Button>
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
                      )}</div>
                    </td>
                  </tr>
                ))}
                {userRegistryQuery.data?.items.length === 0 && (
                  <tr><td colSpan={5} className="p-8 text-center text-white/30">{normalizedUserSearch ? 'No user records match this search.' : 'No users yet.'}</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
        {userRegistryQuery.data && <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-white/45"><span>{userRegistryQuery.data.total ? `${userRegistryQuery.data.offset + 1}–${Math.min(userRegistryQuery.data.offset + userRegistryQuery.data.items.length, userRegistryQuery.data.total)} of ${userRegistryQuery.data.total} users` : 'No users'}</span><div className="flex gap-2"><Button type="button" size="sm" variant="secondary" disabled={adminUserOffset === 0} onClick={() => setAdminUserOffset(Math.max(0, adminUserOffset - 30))}>Previous</Button><Button type="button" size="sm" variant="secondary" disabled={adminUserOffset + userRegistryQuery.data.items.length >= userRegistryQuery.data.total} onClick={() => setAdminUserOffset(adminUserOffset + 30)}>Next</Button></div></div>}
        {selectedUserId !== null && <section className="mt-5 rounded-2xl border border-primary/20 bg-[#0a0d14] p-5 shadow-2xl shadow-black/25"><div className="flex flex-col gap-4 border-b border-white/[0.08] pb-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">Owner activity detail</p><h3 className="mt-1 text-xl font-black text-white">{userActivityQuery.data?.user.username || 'Loading user profile'}</h3><p className="mt-1 max-w-2xl text-xs leading-relaxed text-white/45">This panel shows consent-aware Kryv activity only. It never displays screen capture, typed content, private messages, payment information, wallet destinations, stream keys, camera or microphone data, or activity outside Kryv.</p></div><Button variant="secondary" size="sm" onClick={() => setSelectedUserId(null)}><XCircle className="mr-1 h-4 w-4" /> Close</Button></div>{userActivityQuery.isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : userActivityQuery.data ? <div className="mt-5 space-y-5"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><div className="rounded-xl border border-white/[0.08] bg-black/25 p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-white/35">Visibility consent</p><p className={`mt-2 text-sm font-black ${userActivityQuery.data.activityObservabilityEnabled ? 'text-emerald-300' : 'text-white/55'}`}>{userActivityQuery.data.activityObservabilityEnabled ? 'Enabled by user' : 'Not enabled'}</p></div><div className="rounded-xl border border-white/[0.08] bg-black/25 p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-white/35">Current Kryv state</p>{userActivityQuery.data.currentPresence ? <><p className="mt-2 text-sm font-black capitalize text-white">{userActivityQuery.data.currentPresence.routeKey.replaceAll('_', ' ')}</p><p className="mt-1 text-[11px] text-white/45">{userActivityQuery.data.currentPresence.deviceClass} · {new Date(userActivityQuery.data.currentPresence.updatedAt).toLocaleString()}</p></> : <p className="mt-2 text-sm font-black text-white/55">No current presence</p>}</div><div className="rounded-xl border border-white/[0.08] bg-black/25 p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-white/35">Creator channels</p><p className="mt-2 text-sm font-black text-white">{userActivityQuery.data.channels.length}</p><p className="mt-1 text-[11px] text-white/45">Owned channel records</p></div></div><div className="grid gap-5 lg:grid-cols-2"><section><div className="mb-3 flex items-center gap-2"><Activity className="h-4 w-4 text-primary" /><h4 className="text-sm font-black text-white">Recent Kryv history</h4></div><div className="space-y-2">{userActivityQuery.data.activity.map((event, index) => <div key={`${event.action}-${event.createdAt}-${index}`} className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.07] bg-black/20 px-3 py-2.5"><span className="text-xs font-bold text-white/70">{event.action.replaceAll('.', ' ')}</span><span className="shrink-0 text-[10px] text-white/35">{new Date(event.createdAt).toLocaleString()}</span></div>)}{userActivityQuery.data.activity.length === 0 && <p className="rounded-xl border border-dashed border-white/10 p-4 text-xs text-white/40">No recorded Kryv activity is available for this user yet.</p>}</div></section><section><div className="mb-3 flex items-center gap-2"><Users className="h-4 w-4 text-primary" /><h4 className="text-sm font-black text-white">Known sign-in devices</h4></div><div className="space-y-2">{userActivityQuery.data.devices.map((device, index) => <div key={`${device.deviceName}-${device.lastSeen}-${index}`} className="rounded-xl border border-white/[0.07] bg-black/20 p-3"><p className="text-xs font-bold text-white/75">{device.deviceName || 'Unidentified device'}</p><p className="mt-1 text-[10px] text-white/40">{[device.deviceOs, device.deviceBrowser].filter(Boolean).join(' · ') || 'Device detail unavailable'} · {device.loginCount} sign-ins</p><p className="mt-1 text-[10px] text-white/28">Last seen {device.lastSeen ? new Date(device.lastSeen).toLocaleString() : 'unavailable'}</p></div>)}{userActivityQuery.data.devices.length === 0 && <p className="rounded-xl border border-dashed border-white/10 p-4 text-xs text-white/40">No prior sign-in device summary is available.</p>}</div></section></div>{userActivityQuery.data.channels.length > 0 && <section><div className="mb-3 flex items-center gap-2"><Radio className="h-4 w-4 text-primary" /><h4 className="text-sm font-black text-white">Channel context</h4></div><div className="flex flex-wrap gap-2">{userActivityQuery.data.channels.map(channel => <span key={channel.id} className="rounded-lg border border-white/[0.08] bg-black/25 px-3 py-2 text-xs font-bold text-white/70">{channel.displayName}{channel.isLive ? <span className="ml-2 text-red-300">LIVE</span> : null}</span>)}</div></section>}</div> : <div className="rounded-xl border border-red-400/20 bg-red-400/[0.05] p-4 text-sm text-red-100/80">The activity detail could not be loaded. The owner action was not retried automatically.</div>}</section>}
        </>
      )}

      {/* Channels table */}
      {tab === 'channels' && (
        <div className="space-y-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-black text-white">Creator channels</h2><p className="mt-1 text-xs text-white/40">Search active and offline creator channels, open public profiles, or use existing owner removal controls.</p></div><label className="relative block sm:w-72"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" /><input value={adminChannelSearch} onChange={(event) => { setAdminChannelSearch(event.target.value); setAdminChannelOffset(0); }} maxLength={80} placeholder="Search channel or slug" className="h-11 w-full rounded-xl border border-white/[0.1] bg-black/30 py-2 pl-9 pr-3 text-sm text-white outline-none focus:border-primary/60" /></label></div><div className="overflow-x-auto rounded-xl border border-white/[0.08] bg-black/30 backdrop-blur">
          {channelRegistryQuery.isLoading ? (
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
                {channelRegistryQuery.data?.items.map((c) => (
                  <tr key={c.id} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors">
                      <td className="p-3"><Link href={`/profile/${c.slug}`} className="font-semibold text-white hover:text-primary">{c.displayName}</Link><p className="mt-1 font-mono text-[10px] text-white/30">/{c.slug}</p></td>
                    <td className="p-3 text-white/40 text-xs">{c.categoryName ?? '—'}</td>
                    <td className="p-3">
                      {c.isLive
                        ? <span className="text-red-400 font-black text-xs animate-pulse">● LIVE</span>
                        : <span className="text-white/30 text-xs">Offline</span>
                      }
                    </td>
                    <td className="p-3 text-white/40 text-xs">{c.followerCount}</td>
                    <td className="p-3 text-right">
                      <Button size="sm" variant="destructive" onClick={() => removeChannel(String(c.id))} disabled={deleteChannel.isPending} className="text-xs">
                        <Trash2 className="w-3.5 h-3.5 mr-1" /> Remove
                      </Button>
                    </td>
                  </tr>
                ))}
                {channelRegistryQuery.data?.items.length === 0 && (
                  <tr><td colSpan={5} className="p-8 text-center text-white/30">{normalizedChannelSearch ? 'No channels match this search.' : 'No channels yet.'}</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>{channelRegistryQuery.data && <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-white/45"><span>{channelRegistryQuery.data.total ? `${channelRegistryQuery.data.offset + 1}–${Math.min(channelRegistryQuery.data.offset + channelRegistryQuery.data.items.length, channelRegistryQuery.data.total)} of ${channelRegistryQuery.data.total} channels` : 'No channels'}</span><div className="flex gap-2"><Button type="button" size="sm" variant="secondary" disabled={adminChannelOffset === 0} onClick={() => setAdminChannelOffset(Math.max(0, adminChannelOffset - 30))}>Previous</Button><Button type="button" size="sm" variant="secondary" disabled={adminChannelOffset + channelRegistryQuery.data.items.length >= channelRegistryQuery.data.total} onClick={() => setAdminChannelOffset(adminChannelOffset + 30)}>Next</Button></div></div>}</div>
      )}

      {tab === 'cinema' && (
        <div className="space-y-5">
          <section className="overflow-hidden rounded-2xl border border-primary/25 bg-[radial-gradient(circle_at_95%_0%,hsl(var(--primary)/0.17),transparent_36%),rgba(255,255,255,0.025)] p-5 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div><div className="flex items-center gap-2 text-primary"><Gavel className="h-4 w-4" /><span className="text-[10px] font-black uppercase tracking-[0.18em]">Controlled publishing</span></div><h2 className="mt-1 text-xl font-black text-white">Cinema control room</h2><p className="mt-1 max-w-3xl text-xs leading-relaxed text-white/50">Create a rights-referenced draft, attach an approved media manifest, establish a live entitlement window, then move the title through review and release. Every owner action is recorded.</p></div>
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-[10px] font-bold text-white/60"><Lock className="h-3 w-3 text-primary" /> Owner-only desk</span>
            </div>
            <form onSubmit={handleCreateCinemaTitle} className="mt-5 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
              <input value={cinemaTitle} onChange={event => setCinemaTitle(event.target.value)} maxLength={160} placeholder="Title name" className="h-10 rounded-xl border border-white/[0.1] bg-black/30 px-3 text-sm text-white outline-none focus:border-primary/60" />
              <input value={rightsReference} onChange={event => setRightsReference(event.target.value)} maxLength={500} placeholder="Rights or license reference" className="h-10 rounded-xl border border-white/[0.1] bg-black/30 px-3 text-sm text-white outline-none focus:border-primary/60" />
              <Button type="submit" disabled={createCinemaTitle.isPending || !cinemaTitle.trim() || !rightsReference.trim()} className="h-10 rounded-xl font-bold">{createCinemaTitle.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="mr-1.5 h-4 w-4" /> Create draft</>}</Button>
            </form>
          </section>

          <div className="grid gap-5 xl:grid-cols-[0.82fr_1.45fr]">
            <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-black/30">
              <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3"><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/35">Catalog queue</p><h3 className="text-sm font-black text-white">Titles awaiting owner action</h3></div><span className="rounded-full bg-white/[0.06] px-2 py-1 text-[10px] font-bold text-white/50">{cinemaTitles?.length ?? 0}</span></div>
              {cinemaTitlesLoading ? <div className="p-8 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></div> : <div className="max-h-[660px] divide-y divide-white/[0.06] overflow-y-auto">{cinemaTitles?.map(title => <button key={title.id} type="button" onClick={() => setSelectedCinemaTitleId(title.id)} className={`w-full px-4 py-4 text-left transition-colors hover:bg-white/[0.04] ${selectedCinemaTitleId === title.id ? 'bg-primary/[0.09]' : ''}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-black text-white">{title.title}</p><p className="mt-1 truncate font-mono text-[10px] text-white/30">/{title.slug}</p></div><span className={`shrink-0 rounded-md border px-2 py-1 text-[9px] font-black uppercase tracking-wider ${title.publishState === 'published' ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200' : title.publishState === 'review' ? 'border-sky-400/25 bg-sky-400/10 text-sky-200' : 'border-amber-400/25 bg-amber-400/10 text-amber-200'}`}>{title.publishState}</span></div><div className="mt-3 flex items-center justify-between text-[10px] font-semibold text-white/38"><span>{title.maturityLevel} audience</span><span>Updated {new Date(title.updatedAt).toLocaleDateString()}</span></div></button>)}{cinemaTitles?.length === 0 && <div className="p-8 text-center text-sm text-white/35">No Cinema drafts yet.</div>}</div>}
            </section>

            <section className="min-h-[430px] overflow-hidden rounded-2xl border border-white/[0.08] bg-black/30">
              {cinemaDetailQuery.isLoading ? <div className="flex min-h-[430px] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div> : cinemaDetailQuery.data ? (() => { const title = cinemaDetailQuery.data; return <div>
                <div className="border-b border-white/[0.08] bg-[linear-gradient(135deg,rgba(255,255,255,0.045),rgba(99,102,241,0.06))] p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-2 text-primary"><FileVideo2 className="h-4 w-4" /><span className="text-[10px] font-black uppercase tracking-[0.16em]">Title manifest</span></div><h3 className="mt-1 text-2xl font-black text-white">{title.title}</h3><p className="mt-1 font-mono text-[10px] text-white/35">/{title.slug}</p></div><div className="flex flex-wrap gap-2"><Button size="sm" variant="secondary" disabled={updateCinemaTitle.isPending} onClick={() => transitionCinemaTitle('review')} className="h-8 text-[10px] font-black uppercase tracking-wider"><Send className="mr-1.5 h-3.5 w-3.5" /> Review</Button><Button size="sm" disabled={updateCinemaTitle.isPending || !title.readiness.isPublishEligible} onClick={() => transitionCinemaTitle('published')} className="h-8 text-[10px] font-black uppercase tracking-wider"><CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Publish</Button><Button size="sm" variant="outline" disabled={updateCinemaTitle.isPending} onClick={() => transitionCinemaTitle('archived')} className="h-8 border-white/15 bg-transparent text-[10px] font-black uppercase tracking-wider text-white/70 hover:bg-white/10"><Lock className="mr-1.5 h-3.5 w-3.5" /> Archive</Button></div></div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2"><div className={`rounded-xl border p-3 ${title.readiness.hasReadyFeature ? 'border-emerald-400/20 bg-emerald-400/[0.07]' : 'border-amber-400/20 bg-amber-400/[0.07]'}`}><div className="flex items-center gap-2 text-xs font-black text-white">{title.readiness.hasReadyFeature ? <CheckCircle2 className="h-4 w-4 text-emerald-300" /> : <CircleAlert className="h-4 w-4 text-amber-300" />} Approved feature</div><p className="mt-1 text-[11px] text-white/48">{title.readiness.hasReadyFeature ? 'A ready playback asset is attached.' : 'Attach a feature playback asset before publishing.'}</p></div><div className={`rounded-xl border p-3 ${title.readiness.hasActiveRightsWindow ? 'border-emerald-400/20 bg-emerald-400/[0.07]' : 'border-amber-400/20 bg-amber-400/[0.07]'}`}><div className="flex items-center gap-2 text-xs font-black text-white">{title.readiness.hasActiveRightsWindow ? <CheckCircle2 className="h-4 w-4 text-emerald-300" /> : <CircleAlert className="h-4 w-4 text-amber-300" />} Active rights</div><p className="mt-1 text-[11px] text-white/48">{title.readiness.hasActiveRightsWindow ? 'At least one entitlement window is active.' : 'Add a current entitlement window before publishing.'}</p></div></div>
                  {!title.readiness.isPublishEligible && <p className="mt-3 text-[11px] leading-relaxed text-amber-100/65">Release remains protected: {title.readiness.blockingReasons.join(' ')}</p>}
                </div>
                <div className="grid gap-5 p-5 lg:grid-cols-2"><div className="space-y-5"><section><div className="mb-3 flex items-center gap-2"><UploadCloud className="h-4 w-4 text-primary" /><h4 className="text-sm font-black text-white">Owner asset intake</h4></div><form onSubmit={handleCinemaDirectUpload} className="space-y-2 rounded-xl border border-primary/20 bg-primary/[0.045] p-3"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-wider text-primary">Direct media upload</p><p className="mt-1 text-[10px] leading-relaxed text-white/45">Only the owner receives a one-time upload session. The media provider must verify processing before this asset can be published.</p></div><Lock className="h-4 w-4 shrink-0 text-primary" /></div><div className="grid grid-cols-2 gap-2"><select value={cinemaUploadAssetKind} onChange={event => setCinemaUploadAssetKind(event.target.value as typeof cinemaUploadAssetKind)} className="h-9 rounded-lg border border-white/[0.1] bg-black/40 px-2 text-xs text-white outline-none"><option value="feature">Feature</option><option value="trailer">Trailer</option><option value="preview">Preview</option></select><input value={cinemaUploadLanguage} onChange={event => setCinemaUploadLanguage(event.target.value)} maxLength={16} placeholder="Language (en)" className="h-9 min-w-0 rounded-lg border border-white/[0.1] bg-black/40 px-2 text-xs text-white outline-none" /></div><input type="file" accept="video/*" onChange={event => setCinemaUploadFile(event.target.files?.[0] ?? null)} className="block w-full text-[10px] text-white/50 file:mr-3 file:rounded-lg file:border-0 file:bg-white/[0.1] file:px-3 file:py-2 file:text-[10px] file:font-black file:text-white hover:file:bg-white/[0.16]" /><input value={cinemaUploadProvenance} onChange={event => setCinemaUploadProvenance(event.target.value)} placeholder="Rights / provenance reference" className="h-9 w-full rounded-lg border border-white/[0.1] bg-black/40 px-2 text-xs text-white outline-none" /><Button type="submit" size="sm" disabled={cinemaUploading || createCinemaUploadSession.isPending || !cinemaUploadFile || !cinemaUploadProvenance.trim()} className="h-9 w-full text-[10px] font-black uppercase tracking-wider">{cinemaUploading || createCinemaUploadSession.isPending ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Uploading</> : <><UploadCloud className="mr-1.5 h-3.5 w-3.5" /> Upload approved media</>}</Button></form><div className="my-4 flex items-center gap-3"><div className="h-px flex-1 bg-white/[0.08]" /><span className="text-[9px] font-black uppercase tracking-wider text-white/25">or attach a provider-approved asset</span><div className="h-px flex-1 bg-white/[0.08]" /></div><form onSubmit={handleAddCinemaAsset} className="space-y-2 rounded-xl border border-white/[0.08] bg-white/[0.025] p-3"><div className="grid grid-cols-2 gap-2"><select value={assetKind} onChange={event => setAssetKind(event.target.value as typeof assetKind)} className="h-9 rounded-lg border border-white/[0.1] bg-black/40 px-2 text-xs text-white outline-none"><option value="feature">Feature</option><option value="trailer">Trailer</option><option value="preview">Preview</option><option value="captions">Captions</option></select><input value={assetMediaId} onChange={event => setAssetMediaId(event.target.value)} placeholder="Media ID (optional)" className="h-9 min-w-0 rounded-lg border border-white/[0.1] bg-black/40 px-2 text-xs text-white outline-none" /></div><input value={assetPlaybackId} onChange={event => setAssetPlaybackId(event.target.value)} placeholder="Approved playback ID" className="h-9 w-full rounded-lg border border-white/[0.1] bg-black/40 px-2 text-xs text-white outline-none" /><input value={assetProvenance} onChange={event => setAssetProvenance(event.target.value)} placeholder="Provenance / rights source" className="h-9 w-full rounded-lg border border-white/[0.1] bg-black/40 px-2 text-xs text-white outline-none" /><Button type="submit" size="sm" disabled={createCinemaAsset.isPending || !assetPlaybackId.trim() || !assetProvenance.trim()} className="h-9 w-full text-[10px] font-black uppercase tracking-wider">Attach approved asset</Button></form><div className="mt-3 space-y-2">{title.assets.map(asset => <div key={asset.id} className="rounded-lg border border-white/[0.07] bg-black/20 p-2.5"><div className="flex items-center justify-between gap-2"><span className="text-[10px] font-black uppercase tracking-wider text-white">{asset.assetKind}</span><span className="text-[9px] font-bold uppercase text-emerald-200">{asset.processingStatus}</span></div><p className="mt-1 truncate font-mono text-[10px] text-white/40">{asset.fastpixPlaybackId || 'No playback ID'}</p></div>)}{title.assets.length === 0 && <p className="rounded-lg border border-dashed border-white/10 p-3 text-[11px] text-white/35">No approved assets are attached.</p>}</div></section></div>
                  <div className="space-y-5"><section><div className="mb-3 flex items-center gap-2"><Gavel className="h-4 w-4 text-primary" /><h4 className="text-sm font-black text-white">Rights and entitlements</h4></div><form onSubmit={handleAddRightsWindow} className="space-y-2 rounded-xl border border-white/[0.08] bg-white/[0.025] p-3"><div className="grid grid-cols-2 gap-2"><select value={rightsEntitlement} onChange={event => setRightsEntitlement(event.target.value as typeof rightsEntitlement)} className="h-9 rounded-lg border border-white/[0.1] bg-black/40 px-2 text-xs text-white outline-none"><option value="subscription">Subscription</option><option value="free">Free</option><option value="rental">Rental</option><option value="purchase">Purchase</option></select><input value={rightsTerritories} onChange={event => setRightsTerritories(event.target.value)} placeholder="US, CA (optional)" className="h-9 min-w-0 rounded-lg border border-white/[0.1] bg-black/40 px-2 text-xs text-white outline-none" /></div><input value={rightsReference} onChange={event => setRightsReference(event.target.value)} placeholder="Contract or license reference" className="h-9 w-full rounded-lg border border-white/[0.1] bg-black/40 px-2 text-xs text-white outline-none" /><div className="grid grid-cols-2 gap-2"><input type="datetime-local" value={rightsStartsAt} onChange={event => setRightsStartsAt(event.target.value)} className="h-9 min-w-0 rounded-lg border border-white/[0.1] bg-black/40 px-2 text-xs text-white outline-none" /><input type="datetime-local" value={rightsEndsAt} onChange={event => setRightsEndsAt(event.target.value)} className="h-9 min-w-0 rounded-lg border border-white/[0.1] bg-black/40 px-2 text-xs text-white outline-none" /></div><Button type="submit" size="sm" disabled={createCinemaRightsWindow.isPending || !rightsReference.trim()} className="h-9 w-full text-[10px] font-black uppercase tracking-wider">Add rights window</Button></form><div className="mt-3 space-y-2">{title.rightsWindows.map(window => <div key={window.id} className="rounded-lg border border-white/[0.07] bg-black/20 p-2.5"><div className="flex items-center justify-between gap-2"><span className="text-[10px] font-black uppercase tracking-wider text-white">{window.entitlementType}</span><span className="text-[9px] font-bold uppercase text-white/45">{window.territoryCodes.length ? window.territoryCodes.join(', ') : 'Global'}</span></div><p className="mt-1 truncate text-[10px] text-white/42">{window.rightsReference}</p><p className="mt-1 text-[9px] text-white/30">{new Date(window.startsAt).toLocaleDateString()} — {window.endsAt ? new Date(window.endsAt).toLocaleDateString() : 'Open ended'}</p></div>)}</div></section>
                    <section><div className="mb-3 flex items-center gap-2"><Clapperboard className="h-4 w-4 text-primary" /><h4 className="text-sm font-black text-white">Creator credits</h4></div><form onSubmit={handleAddCinemaCredit} className="space-y-2 rounded-xl border border-primary/20 bg-primary/[0.045] p-3"><p className="text-[10px] leading-relaxed text-white/45">Credits link a real creator channel to this owner-controlled title. They never grant the creator publishing or upload rights.</p><div className="grid grid-cols-[minmax(0,1fr)_0.7fr] gap-2"><select value={creditChannelId} onChange={event => setCreditChannelId(event.target.value)} className="h-9 min-w-0 rounded-lg border border-white/[0.1] bg-black/40 px-2 text-xs text-white outline-none"><option value="">Choose creator channel</option>{cinemaCreditChannelsQuery.data?.items.map(channel => <option key={channel.id} value={channel.id}>{channel.displayName} · #{channel.id}</option>)}</select><input value={creditRole} onChange={event => setCreditRole(event.target.value)} maxLength={80} placeholder="Role (e.g. Director)" className="h-9 min-w-0 rounded-lg border border-white/[0.1] bg-black/40 px-2 text-xs text-white outline-none" /></div><div className="flex gap-2"><input type="number" value={creditDisplayOrder} onChange={event => setCreditDisplayOrder(event.target.value)} className="h-9 min-w-0 w-24 rounded-lg border border-white/[0.1] bg-black/40 px-2 text-xs text-white outline-none" aria-label="Credit display order" /><Button type="submit" size="sm" disabled={createCinemaCredit.isPending || !creditChannelId || !creditRole.trim()} className="h-9 flex-1 text-[10px] font-black uppercase tracking-wider">{createCinemaCredit.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Attach credit'}</Button></div></form><div className="mt-3 space-y-2">{title.credits.map(credit => <div key={credit.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.07] bg-black/20 p-2.5"><div className="min-w-0"><p className="truncate text-xs font-black text-white">{credit.channelDisplayName}</p><p className="mt-0.5 text-[10px] text-primary">{credit.role} · /{credit.channelSlug}</p></div><Button type="button" size="sm" variant="secondary" disabled={deleteCinemaCredit.isPending} onClick={() => removeCinemaCredit(credit.id, credit.channelDisplayName)} className="h-7 shrink-0 px-2 text-[10px] text-red-100 hover:text-red-50">Remove</Button></div>)}{title.credits.length === 0 && <p className="rounded-lg border border-dashed border-white/10 p-3 text-[11px] leading-relaxed text-white/35">No creator credits are attached. Add only verified production roles for channels that should appear in this title’s public filmography.</p>}</div></section>
                    <section><div className="mb-3 flex items-center gap-2"><History className="h-4 w-4 text-primary" /><h4 className="text-sm font-black text-white">Owner activity</h4></div><div className="space-y-2">{title.activity.map(entry => <div key={entry.id} className="rounded-lg border border-white/[0.07] bg-black/20 p-2.5"><p className="text-[10px] font-black uppercase tracking-wider text-white/75">{entry.action.replaceAll('.', ' ')}</p><p className="mt-1 text-[10px] text-white/38">{entry.reason || 'Owner-controlled workflow event'}</p><p className="mt-1 text-[9px] text-white/25">{new Date(entry.createdAt).toLocaleString()}</p></div>)}{title.activity.length === 0 && <p className="rounded-lg border border-dashed border-white/10 p-3 text-[11px] text-white/35">The audit trail will appear after an owner action.</p>}</div></section></div></div>
              </div>; })() : <div className="flex min-h-[430px] flex-col items-center justify-center p-8 text-center"><Clapperboard className="h-8 w-8 text-primary/65" /><h3 className="mt-4 text-lg font-black text-white">Open a title control record</h3><p className="mt-2 max-w-sm text-sm leading-relaxed text-white/45">Select a Cinema title from the queue to inspect publishing readiness, approve its assets, establish rights, and control its release state.</p></div>}
            </section>
          </div>
        </div>
      )}

      {/* Videos table */}
      {tab === 'videos' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-white/40 uppercase tracking-widest">Watch sources &amp; Cinema assets</h3>
            <Button onClick={handleAddOriginal} size="sm" className="bg-primary text-primary-foreground font-black text-[10px] h-8 rounded-lg uppercase tracking-widest">
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Cinema Original
            </Button>
          </div>
          <div className="overflow-x-auto rounded-xl border border-white/[0.08] bg-black/30 backdrop-blur">
            {videosLoading ? (
              <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : (
              <table className="min-w-[44rem] w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-white/[0.08] bg-white/[0.02]">
                    <th className="p-3 text-[10px] font-black text-white/40 uppercase tracking-widest">Title</th>
                    <th className="p-3 text-[10px] font-black text-white/40 uppercase tracking-widest">Type</th>
                    <th className="p-3 text-[10px] font-black text-white/40 uppercase tracking-widest">Status</th>
                    <th className="p-3 text-[10px] font-black text-white/40 uppercase tracking-widest">Source / rights</th>
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
                      <td className="p-3"><div className="space-y-1"><span className={`inline-flex rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-wider ${v.playbackSource === 'youtube' ? 'bg-red-400/10 text-red-200' : 'bg-primary/10 text-primary'}`}>{v.playbackSource}</span>{v.playbackSource === 'youtube' && <p className={`flex items-center gap-1 text-[10px] ${v.rightsAttestedAt ? 'text-emerald-200' : 'text-amber-100'}`}>{v.rightsAttestedAt ? <><CircleCheck className="h-3 w-3" /> Attested {new Date(v.rightsAttestedAt).toLocaleDateString()}</> : <><CircleAlert className="h-3 w-3" /> Missing record</>}</p>}</div></td>
                      <td className="p-3 text-white/40 text-xs">{v.viewCount}</td>
                      <td className="p-3 text-right">
                        <Button size="sm" variant="destructive" onClick={() => removeVideo(v.id)} disabled={deleteVideo.isPending} className="text-xs h-7 px-3">
                          <Trash2 className="w-3 h-3 mr-1.5" /> Remove
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {videos?.length === 0 && (
                    <tr><td colSpan={6} className="p-8 text-center text-white/30">No video records have been created yet.</td></tr>
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
