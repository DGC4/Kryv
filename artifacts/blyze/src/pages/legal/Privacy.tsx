export default function Privacy() {
  return (
    <div className="relative z-10 min-h-screen bg-black px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-14 border-b border-white/[0.08] pb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-4">
            Legal &amp; Privacy
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white mb-4">Privacy Policy</h1>
          <p className="text-sm font-medium text-white/50">Effective Date: August 11, 2026 · Kryv Platform Governance</p>
        </div>

        {/* Content */}
        <div className="space-y-12 text-white/80 leading-relaxed font-sans text-base sm:text-lg">
          
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 sm:p-8">
            <p className="text-white/90 font-medium leading-relaxed">
              Kryv ("we," "our," or "the Platform") operates a multi-modal live-entertainment, video-on-demand, and cinematic streaming ecosystem (incorporating Kryv Live, Kryv Watch, Kryv Clips, and Kryv Cinema). We respect your privacy and are committed to safeguarding personal information through rigorous technical and organizational controls. This Privacy Policy details how we collect, process, secure, and share information when you access or interact with our services.
            </p>
          </div>

          <section className="space-y-4">
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">1. Information Architecture &amp; Collection Scope</h2>
            <div className="space-y-6 text-white/70">
              <div className="rounded-xl border border-white/[0.06] bg-black/40 p-5">
                <h3 className="text-white font-bold text-lg mb-2">Account &amp; Authentication Data</h3>
                <p className="text-sm sm:text-base leading-relaxed">
                  When you register an account, we record your chosen username, email address, and a cryptographically salted and hashed password (never stored in plain text). We also record account creation timestamps, avatar URLs, role assignments (user, creator, or platform owner), and audit metadata regarding your acceptance of our terms.
                </p>
              </div>

              <div className="rounded-xl border border-white/[0.06] bg-black/40 p-5">
                <h3 className="text-white font-bold text-lg mb-2">Creator Infrastructure &amp; Streaming Records</h3>
                <p className="text-sm sm:text-base leading-relaxed">
                  For creators broadcasting on Kryv Live, we store channel metadata, stream titles, category assignments, peak and average concurrent viewer counts, and private stream keys used exclusively for RTMPS ingest via FastPix. Operational stream lifecycle events and session metrics are stored in our secure Neon PostgreSQL database.
                </p>
              </div>

              <div className="rounded-xl border border-white/[0.06] bg-black/40 p-5">
                <h3 className="text-white font-bold text-lg mb-2">Monetization &amp; Financial Compliance</h3>
                <p className="text-sm sm:text-base leading-relaxed">
                  Kryv utilizes Stripe Connect for secure creator monetization, subscriptions, and tips. We never collect, process, or store raw credit card numbers or identity verification documents on Kryv servers. Stripe handles all PCI-DSS compliant payment processing and identity verification. Kryv records only opaque provider identifiers, subscription status, payout eligibility flags, and transaction ledgers.
                </p>
              </div>

              <div className="rounded-xl border border-white/[0.06] bg-black/40 p-5">
                <h3 className="text-white font-bold text-lg mb-2">Engagement, Moderation &amp; Telemetry</h3>
                <p className="text-sm sm:text-base leading-relaxed">
                  We process chat messages, moderation actions (timeouts, bans, message deletions), channel point balances, poll votes, prediction entries, raid/host logs, follow relationships, and notification preferences. Technical telemetry includes IP-derived geographic data, device user agents, view history, and anonymous visitor sessions.
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">2. Operational Use of Information</h2>
            <p className="text-white/70">We process collected data strictly to deliver, secure, and enhance the Platform experience:</p>
            <ul className="space-y-3 text-white/75">
              <li className="flex items-start gap-3">
                <span className="text-primary font-bold mt-1">▪</span>
                <span><strong className="text-white">Service Delivery:</strong> Powering low-latency HLS video playback via FastPix, real-time chat dispatch, and channel discovery ranking.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-primary font-bold mt-1">▪</span>
                <span><strong className="text-white">Trust &amp; Safety:</strong> Enforcing rate limits, chat moderation rules, spam filters, and channel ban lists.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-primary font-bold mt-1">▪</span>
                <span><strong className="text-white">Monetization &amp; Payouts:</strong> Administering creator revenue shares, subscription tiers, and payout compliance through Stripe Connect.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-primary font-bold mt-1">▪</span>
                <span><strong className="text-white">Platform Analytics:</strong> Providing creators with actionable stream analytics, viewer engagement metrics, and session summaries.</span>
              </li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">3. Data Disclosure &amp; Infrastructure Partners</h2>
            <p className="text-white/70 leading-relaxed">
              We do not sell, rent, or monetize personal user data. Information is disclosed only to essential enterprise infrastructure partners bound by strict data protection agreements:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 text-center">
                <p className="font-black text-white">FastPix</p>
                <p className="text-xs text-white/40 mt-1">Video ingest, transcoding, HLS delivery &amp; clipping</p>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 text-center">
                <p className="font-black text-white">Neon PostgreSQL</p>
                <p className="text-xs text-white/40 mt-1">Encrypted relational database storage</p>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 text-center">
                <p className="font-black text-white">Stripe Connect</p>
                <p className="text-xs text-white/40 mt-1">Secure payment processing &amp; creator payouts</p>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">4. Security &amp; Data Retention</h2>
            <p className="text-white/70 leading-relaxed">
              Kryv employs industry-standard cryptographic protocols, HTTPS-enforced transit, parameterized query protection against SQL injection, and structured JWT authentication. Account data and logs are retained as long as your account remains active or as required by financial and legal compliance standards. Users may request account deletion at any time.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">5. User Rights &amp; Contact</h2>
            <p className="text-white/70 leading-relaxed">
              You possess statutory rights to access, correct, export, or delete your personal data. For privacy inquiries, data export requests, or account termination, contact the Kryv Platform Governance team through your account settings or official platform support channels.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
