import { Link } from 'wouter';

const supportedAssets = ['BTC', 'LTC', 'ETH', 'DOGE'];

export default function CreatorEconomics() {
  return (
    <main className="relative z-10 min-h-screen bg-black px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-10 border-b border-white/[0.08] pb-10 sm:mb-14">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-primary">Creator Economics</div>
          <h1 className="mb-4 text-3xl font-black tracking-tight text-white sm:text-5xl">Clear crypto economics. No hidden split.</h1>
          <p className="max-w-3xl text-sm font-medium leading-relaxed text-white/55 sm:text-base">Kryv is crypto-only. This page explains how eligible, provider-confirmed tips and subscriptions are allocated, what payment fees are separate from the creator split, how guest support is labeled, and what must happen before a creator payout can leave the platform.</p>
        </header>

        <div className="space-y-7 sm:space-y-10">
          <section className="overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/15 via-primary/[0.07] to-transparent">
            <div className="grid gap-px bg-primary/15 sm:grid-cols-2">
              <div className="bg-black/35 p-6 sm:p-8"><p className="text-[11px] font-black uppercase tracking-[0.18em] text-primary">Eligible creator share</p><p className="mt-3 text-5xl font-black tracking-tight text-white sm:text-6xl">95%</p><p className="mt-3 text-sm leading-relaxed text-white/60">From the confirmed crypto subtotal of an eligible tip or subscription.</p></div>
              <div className="bg-black/35 p-6 sm:p-8"><p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/45">Kryv platform share</p><p className="mt-3 text-5xl font-black tracking-tight text-white sm:text-6xl">5%</p><p className="mt-3 text-sm leading-relaxed text-white/60">Recorded separately in the settlement ledger. It is not a hidden deduction.</p></div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-6 sm:p-8">
            <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">How a crypto payment is settled</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <article className="rounded-xl border border-white/[0.08] bg-black/25 p-4"><span className="text-xs font-black text-primary">01</span><h3 className="mt-3 font-bold text-white">Exact invoice</h3><p className="mt-2 text-sm leading-relaxed text-white/55">A supporter selects {supportedAssets.join(', ')} and receives a Kryv-branded crypto invoice. Any USD amount is a reference quote, not settlement authority.</p></article>
              <article className="rounded-xl border border-white/[0.08] bg-black/25 p-4"><span className="text-xs font-black text-primary">02</span><h3 className="mt-3 font-bold text-white">Provider confirmation</h3><p className="mt-2 text-sm leading-relaxed text-white/55">Kryv waits for a signed provider event. A checkout redirect, browser screen, or estimated USD conversion never creates a creator balance.</p></article>
              <article className="rounded-xl border border-white/[0.08] bg-black/25 p-4"><span className="text-xs font-black text-primary">03</span><h3 className="mt-3 font-bold text-white">Immutable allocation</h3><p className="mt-2 text-sm leading-relaxed text-white/55">The confirmed crypto subtotal is allocated 95% to the creator and 5% to Kryv through separate asset-denominated ledger movements.</p></article>
            </div>
          </section>

          <section className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-6 sm:p-8"><h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">Guest support and identity labels</h2><div className="mt-4 space-y-3 text-sm leading-relaxed text-white/60"><p>Anyone may request an eligible one-time crypto-support invoice without a Kryv account. A guest may remain labeled <strong className="text-white">Kryv Anonymous</strong> or supply an optional display name. Both are unverified supporter labels and are not a verified Kryv account identity.</p><p>Gift memberships require a named existing Kryv recipient so the entitlement can be issued to an accountable account. After requesting a guest invoice, a supporter may choose to create an account; the later account action does not rewrite the original invoice or its immutable settlement record.</p></div></section>

          <section className="rounded-2xl border border-amber-300/15 bg-amber-300/[0.04] p-6 sm:p-8">
            <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">Fees are not all the same thing</h2>
            <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="border-b border-white/[0.08] text-[10px] font-black uppercase tracking-wider text-white/40"><tr><th className="pb-3 pr-4">Amount</th><th className="pb-3 pr-4">Who determines it</th><th className="pb-3">How Kryv treats it</th></tr></thead><tbody className="divide-y divide-white/[0.06] text-white/65"><tr><td className="py-4 pr-4 font-bold text-white">Confirmed crypto subtotal</td><td className="py-4 pr-4">Signed provider confirmation</td><td className="py-4">This is the basis for the 95% creator / 5% Kryv allocation.</td></tr><tr><td className="py-4 pr-4 font-bold text-white">Checkout commission</td><td className="py-4 pr-4">Provider invoice</td><td className="py-4">Shown separately to the supporter when applicable. It is client-borne and excluded from the 95/5 split.</td></tr><tr><td className="py-4 pr-4 font-bold text-white">Network or withdrawal execution fee</td><td className="py-4 pr-4">Provider and network conditions</td><td className="py-4">Estimated before an owner-approved payout and recorded with the provider result. It can change with asset and network conditions.</td></tr><tr><td className="py-4 pr-4 font-bold text-white">USD equivalent</td><td className="py-4 pr-4">Reference pricing only</td><td className="py-4">Never used as the source of truth for settlement, balances, or a payout amount.</td></tr></tbody></table></div>
          </section>

          <section className="grid gap-5 md:grid-cols-2">
            <article className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-6"><h2 className="text-xl font-black text-white">Creator payout protection</h2><p className="mt-3 text-sm leading-relaxed text-white/60">A payout destination is encrypted server-side and only its masked form is shown in Kryv. Each payout requires a confirmed destination, owner review, an exact available asset balance, owner approval, provider fee estimation, and an atomic execution claim. A request can be held when any control is not satisfied.</p></article>
            <article className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-6"><h2 className="text-xl font-black text-white">What Kryv does not provide today</h2><p className="mt-3 text-sm leading-relaxed text-white/60">Kryv does not provide card checkout, fiat checkout, customer crypto custody, deposit accounts, interest, scheduled creator payouts, or a guarantee that a crypto network or provider will be continuously available. Never share a private key or recovery phrase with anyone.</p></article>
          </section>

          <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 sm:p-8"><h2 className="text-2xl font-black tracking-tight text-white">Read this before relying on a payout</h2><p className="mt-3 text-sm leading-relaxed text-white/60">Crypto transfers can be delayed, rejected, irreversible, or affected by provider and network conditions. Payout availability is subject to security checks, feature controls, compliance review, owner approval, and provider acceptance. Kryv balances are not bank deposits or guarantees of value. This summary is product information, not legal, tax, investment, or financial advice.</p><div className="mt-5 flex flex-wrap gap-3"><Link href="/terms" className="rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-2.5 text-xs font-black text-white transition-colors hover:border-primary/40 hover:text-primary">Read Terms</Link><Link href="/privacy" className="rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-2.5 text-xs font-black text-white transition-colors hover:border-primary/40 hover:text-primary">Read Privacy Policy</Link></div></section>
        </div>
      </div>
    </main>
  );
}
