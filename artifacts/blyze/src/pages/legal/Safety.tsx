import { Link } from 'wouter';
import { AlertTriangle, Flag, ShieldCheck, Scale, Wallet } from 'lucide-react';

const prohibitedConduct = [
  'Child sexual abuse material, grooming, exploitation of minors, or any content that endangers a child.',
  'Credible threats, incitement of violence, terrorism or violent extremism, serious self-harm encouragement, or graphic harmful conduct.',
  'Hate, targeted harassment, sexual harassment, malicious brigading, doxxing, swatting, or sharing another person’s private information without authorization.',
  'Fraud, impersonation, phishing, botting, engagement manipulation, account or moderation evasion, credential theft, or unlawful automation.',
  'Unlawful, infringing, pirated, deceptive, or rights-violating content, including Cinema material published without the necessary authorization.',
];

export default function Safety() {
  return (
    <main className="relative z-10 min-h-screen bg-black px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-14 border-b border-white/[0.08] pb-10">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-primary">
            <ShieldCheck className="h-3.5 w-3.5" /> Safety &amp; Community
          </div>
          <h1 className="mb-4 text-3xl font-black tracking-tight text-white sm:text-5xl">Safety and Community Standards</h1>
          <p className="text-sm font-medium text-white/50">Effective Date: August 13, 2026 · Kryv Platform Standards</p>
          <p className="mt-3 text-xs leading-relaxed text-amber-100/70">Draft for jurisdiction-specific legal review before reliance. These standards describe Kryv&apos;s current product controls and do not promise a particular review time, automated detection capability, or enforcement outcome.</p>
        </header>

        <div className="space-y-12 text-base leading-relaxed text-white/80 sm:text-lg">
          <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 sm:p-8">
            <p className="font-medium leading-relaxed text-white/90">Kryv is a live, watch, clips, and Cinema service. These Standards apply to public and private interactions on Kryv, including broadcasts, uploads, channel pages, clips, Cinema metadata, chat, messages, profile information, promotions, creator tools, and reports. They work together with the <Link href="/terms" className="font-bold text-primary hover:underline">Terms of Service</Link>, <Link href="/privacy" className="font-bold text-primary hover:underline">Privacy Policy</Link>, and <Link href="/creator-economics" className="font-bold text-primary hover:underline">Creator Economics disclosure</Link>.</p>
          </section>

          <section className="grid gap-4 sm:grid-cols-3">
            <article className="rounded-2xl border border-primary/25 bg-primary/[0.06] p-5"><Flag className="h-5 w-5 text-primary" /><h2 className="mt-3 text-lg font-black text-white">Report in context</h2><p className="mt-2 text-sm leading-relaxed text-white/60">Use the report controls available on the live channel or the applicable content surface. A report should identify the content, behavior, and reason as accurately as possible.</p></article>
            <article className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5"><Scale className="h-5 w-5 text-white/70" /><h2 className="mt-3 text-lg font-black text-white">Review and action</h2><p className="mt-2 text-sm leading-relaxed text-white/60">Reports can create a moderation case for authorized review. Context, severity, evidence, prior enforcement, and legal obligations may affect the response.</p></article>
            <article className="rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.05] p-5"><Wallet className="h-5 w-5 text-emerald-200" /><h2 className="mt-3 text-lg font-black text-white">Value safety</h2><p className="mt-2 text-sm leading-relaxed text-white/60">Kryv never asks for a private key or seed phrase. Do not use tips, subscriptions, or any crypto interaction to exploit distress or deceive another person.</p></article>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">1. Content and conduct we do not allow</h2>
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 sm:p-8">
              <ul className="space-y-4 text-white/70">
                {prohibitedConduct.map((item) => <li key={item} className="flex gap-3"><AlertTriangle className="mt-1 h-4 w-4 shrink-0 text-primary" /><span>{item}</span></li>)}
              </ul>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">2. Creator, channel, and chat responsibility</h2>
            <div className="space-y-4 text-white/70"><p>Creators are responsible for the content they choose to stream, upload, title, categorize, promote, or publish through their channels. Channel owners and authorized moderators can use available tools to remove messages, apply timeouts, ban users, configure eligible chat participation settings, and review channel activity. Those channel-level actions do not limit Kryv&apos;s authority to apply service-wide safety, rights, account, or commerce controls.</p><p>Live content is unpredictable. If harmful material appears, creators should take reasonable steps available to them to reduce ongoing exposure, such as ending or changing the broadcast, muting the relevant audio, or using channel moderation tools. Viewer reports should be made in good faith and must not be used to harass, silence criticism, or manipulate enforcement.</p></div>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">3. Rights, Cinema, and advertising</h2>
            <div className="space-y-4 text-white/70"><p>Only publish content that you have the necessary rights, permissions, releases, and legal authority to distribute. That includes music, video, artwork, clips, likenesses, trademarks, and promotional material. Kryv Cinema is owner- and administrator-governed; ordinary accounts cannot independently publish Cinema assets or obtain Cinema upload URLs.</p><p>Advertising controls may be available to authorized operators, but ad delivery remains disabled unless Kryv has an approved, funded, measured flight. Any creator-sponsored, branded, or paid promotion must be lawful, accurate, and clearly disclosed where required. Do not use the Service to run deceptive promotions, illegal solicitation, or unapproved advertising campaigns.</p></div>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">4. Crypto interactions and financial integrity</h2>
            <div className="space-y-4 text-white/70"><p>Kryv&apos;s active payment model is crypto-only for BTC, LTC, ETH, and DOGE. The USD display is a reference quote only; the provider-confirmed crypto amount is the settlement authority. A creator balance is not a bank account or a promise of value. Eligible confirmed tips and subscriptions use the disclosed 95% creator / 5% Kryv allocation of the confirmed crypto subtotal; a separately disclosed provider checkout commission may be charged to the viewer.</p><p>Do not use crypto support, subscriptions, payout destinations, or related communications to mislead, pressure, exploit vulnerable people, conceal fraud, or evade legal obligations. Creator payout destinations are protected server-side and owner-approved payout requests remain subject to controls, review, provider conditions, and applicable law.</p></div>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">5. Enforcement, appeals, and urgent risk</h2>
            <div className="space-y-4 text-white/70"><p>When Kryv determines that content, activity, or an account violates these Standards or the Terms, it may remove or restrict content, limit chat or feature access, reverse improperly granted entitlements where permitted, place money movement into a review hold, suspend an account, or take other proportionate action consistent with the service and applicable law. Severe or repeated conduct may result in permanent restrictions. Kryv may preserve or disclose relevant information where required by law or needed to protect rights, safety, and security.</p><p>If you believe a moderation decision was made in error, use Kryv&apos;s official support channel with the relevant channel, content, or case details. Appeals are reviewed based on the available record and do not guarantee a reversal. If there is an immediate threat to life or safety, contact local emergency services first; platform reporting is not an emergency-response service.</p></div>
          </section>
        </div>
      </div>
    </main>
  );
}
