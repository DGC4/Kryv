import { useMemo, useState } from 'react';
import { useGetCustomerWallet, useCreateCustomerWalletDepositAddress } from '@workspace/api-client-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Copy, Loader2, LockKeyhole, RefreshCw, ShieldCheck, WalletCards } from 'lucide-react';

const assets = ['BTC', 'LTC', 'ETH', 'DOGE'] as const;
type Asset = (typeof assets)[number];

function amount(value: string) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  return numeric.toLocaleString(undefined, { maximumFractionDigits: 8 });
}

export default function CustomerWallet() {
  const { toast } = useToast();
  const [selectedAsset, setSelectedAsset] = useState<Asset>('BTC');
  const { data: wallet, isLoading, refetch, isFetching } = useGetCustomerWallet({
    query: { refetchInterval: 15_000 },
  });
  const createDepositAddress = useCreateCustomerWalletDepositAddress({
    mutation: {
      onSuccess: async () => {
        await refetch();
        toast({ title: 'Kryv deposit address ready', description: 'Your permanent address is ready to receive this asset.' });
      },
      onError: (error) => {
        toast({ variant: 'destructive', title: 'Deposit address unavailable', description: error instanceof Error ? error.message : 'Kryv could not create the deposit address.' });
      },
    },
  });

  const selectedAddress = useMemo(
    () => wallet?.depositAddresses.find((address) => address.currency === selectedAsset),
    [wallet?.depositAddresses, selectedAsset],
  );
  const selectedBalance = useMemo(
    () => wallet?.balances.find((balance) => balance.currency === selectedAsset),
    [wallet?.balances, selectedAsset],
  );

  const copyAddress = async () => {
    if (!selectedAddress?.address) return;
    try {
      await navigator.clipboard.writeText(selectedAddress.address);
      toast({ title: 'Address copied', description: `${selectedAsset} deposit address copied securely.` });
    } catch {
      toast({ variant: 'destructive', title: 'Copy unavailable', description: 'Select and copy the address manually.' });
    }
  };

  if (isLoading) {
    return <main className="mx-auto flex min-h-[60vh] max-w-6xl items-center justify-center px-4"><Loader2 className="h-7 w-7 animate-spin text-primary" /></main>;
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 pb-24 sm:px-6 lg:py-10">
      <section className="overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-primary/25 via-[#15151c] to-black p-5 sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-primary"><WalletCards className="h-5 w-5" /><span className="text-sm font-bold uppercase tracking-[0.16em]">Kryv Wallet</span></div>
            <h1 className="mt-3 font-display text-3xl font-black tracking-tight text-white sm:text-5xl">Your crypto, clearly accounted for.</h1>
            <p className="mt-3 text-sm leading-relaxed text-white/70 sm:text-base">Balances are credited only after Kryv receives and verifies a completed blockchain settlement. USD values are references only; your wallet balance remains denominated in crypto.</p>
          </div>
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching} className="border-white/15 bg-black/20 text-white hover:bg-white/10"><RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />Refresh</Button>
        </div>
      </section>

      {!wallet?.depositsEnabled && (
        <section className="flex gap-3 rounded-2xl border border-amber-300/20 bg-amber-300/[0.08] p-4 text-sm text-amber-50">
          <LockKeyhole className="h-5 w-5 shrink-0 text-amber-300" />
          <p><strong>Wallet deposits are not open yet.</strong> Kryv is completing its live settlement and reconciliation controls before deposit addresses are exposed. Existing balances and ledger history remain visible.</p>
        </section>
      )}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {assets.map((asset) => {
          const balance = wallet?.balances.find((item) => item.currency === asset);
          return <button key={asset} onClick={() => setSelectedAsset(asset)} className={`rounded-2xl border p-4 text-left transition ${selectedAsset === asset ? 'border-primary bg-primary/10 shadow-[0_0_30px_rgba(197,255,0,0.08)]' : 'border-white/[0.08] bg-white/[0.025] hover:border-white/20'}`}>
            <span className="text-xs font-bold uppercase tracking-wider text-white/50">{asset}</span>
            <p className="mt-2 text-xl font-black text-white">{amount(balance?.availableAmount ?? '0')}</p>
            <p className="mt-1 text-xs text-white/50">{balance?.usdReferenceValue ? `$${balance.usdReferenceValue} reference` : 'Rate unavailable'}</p>
          </button>;
        })}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border border-white/[0.08] bg-white/[0.025] p-5 sm:p-6">
          <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 text-primary" /><div><h2 className="text-lg font-black text-white">Deposit {selectedAsset}</h2><p className="mt-1 text-sm text-white/55">Use this address only to send {selectedAsset}. Sending another asset can result in permanent loss.</p></div></div>
          {selectedAddress ? <div className="mt-5 space-y-3"><div className="break-all rounded-2xl border border-white/[0.08] bg-black/35 p-4 font-mono text-sm text-white">{selectedAddress.address}</div><Button onClick={copyAddress} className="w-full rounded-xl font-bold"><Copy className="mr-2 h-4 w-4" />Copy {selectedAsset} address</Button></div> : <div className="mt-5 rounded-2xl border border-dashed border-white/15 bg-black/20 p-5"><p className="text-sm text-white/60">Create your permanent Kryv deposit address for {selectedAsset} when wallet deposits are live.</p><Button onClick={() => createDepositAddress.mutate({ data: { currency: selectedAsset } })} disabled={!wallet?.depositsEnabled || createDepositAddress.isPending} className="mt-4 w-full rounded-xl font-bold">{createDepositAddress.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating secure address</> : `Create ${selectedAsset} deposit address`}</Button></div>}
        </div>

        <div className="rounded-3xl border border-white/[0.08] bg-white/[0.025] p-5 sm:p-6">
          <h2 className="text-lg font-black text-white">{selectedAsset} settlement</h2>
          <dl className="mt-5 space-y-4 text-sm"><div className="flex justify-between gap-4"><dt className="text-white/55">Available</dt><dd className="font-bold text-white">{amount(selectedBalance?.availableAmount ?? '0')} {selectedAsset}</dd></div><div className="flex justify-between gap-4"><dt className="text-white/55">Pending</dt><dd className="font-bold text-white">{amount(selectedBalance?.pendingAmount ?? '0')} {selectedAsset}</dd></div><div className="flex justify-between gap-4"><dt className="text-white/55">Held</dt><dd className="font-bold text-white">{amount(selectedBalance?.heldAmount ?? '0')} {selectedAsset}</dd></div></dl>
          <p className="mt-6 border-t border-white/[0.08] pt-4 text-xs leading-relaxed text-white/45">Kryv never asks for a seed phrase or private key. Any external withdrawal remains unavailable until the separate owner-controlled payout gates have been completed and reconciled.</p>
        </div>
      </section>

      <section className="rounded-3xl border border-white/[0.08] bg-white/[0.025] p-5 sm:p-6">
        <h2 className="text-lg font-black text-white">Recent wallet activity</h2>
        <div className="mt-4 divide-y divide-white/[0.07]">{wallet?.movements.length ? wallet.movements.map((movement) => <div key={movement.id} className="flex items-center justify-between gap-4 py-3 text-sm"><div><p className="font-semibold text-white">{movement.movementType.replaceAll('_', ' ')}</p><p className="mt-0.5 text-xs text-white/45">{new Date(movement.createdAt).toLocaleString()}</p></div><p className={Number(movement.availableDelta) >= 0 ? 'font-bold text-primary' : 'font-bold text-red-300'}>{Number(movement.availableDelta) >= 0 ? '+' : ''}{amount(movement.availableDelta)} {movement.currency}</p></div>) : <p className="py-8 text-center text-sm text-white/45">No completed wallet movements yet.</p>}</div>
      </section>
    </main>
  );
}
