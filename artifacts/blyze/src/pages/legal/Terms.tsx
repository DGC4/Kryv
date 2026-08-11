export default function Terms() {
  return (
    <div className="relative z-10 min-h-screen bg-black px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-14 border-b border-white/[0.08] pb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-4">
            Legal &amp; Terms
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white mb-4">Terms of Service</h1>
          <p className="text-sm font-medium text-white/50">Effective Date: August 11, 2026 · Kryv Platform Agreement</p>
        </div>

        {/* Content */}
        <div className="space-y-12 text-white/80 leading-relaxed font-sans text-base sm:text-lg">

          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 sm:p-8">
            <p className="text-white/90 font-medium leading-relaxed">
              Welcome to Kryv. These Terms of Service ("Terms") constitute a legally binding agreement between you and Kryv governing your access to and use of Kryv Live, Kryv Watch, Kryv Clips, Kryv Cinema, and associated creator monetization tools (collectively, the "Service"). By registering an account, streaming, uploading, or browsing, you unconditionally agree to be bound by these Terms.
            </p>
          </div>

          <section className="space-y-4">
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">1. Account Registration &amp; Eligibility</h2>
            <div className="space-y-4 text-white/70">
              <p>
                You must be at least 13 years of age to register an account or use the Service. Users under the age of majority in their jurisdiction must have parental or legal guardian supervision. You agree to provide accurate registration information and keep your credentials secure.
              </p>
              <p>
                Your stream key and account password grant direct administrative and broadcasting authority over your channel. You are solely responsible for all activity occurring under your account. Stream keys must remain strictly confidential and never shared.
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">2. User Content &amp; Intellectual Property Rights</h2>
            <div className="space-y-4 text-white/70">
              <p>
                Creators retain full ownership of all live broadcasts, VOD uploads, and native clips ("User Content") they create on Kryv. By submitting User Content, you grant Kryv a worldwide, non-exclusive, royalty-free license to host, transcode, distribute, display, and create technical clips or derivatives necessary to operate and promote the Platform.
              </p>
              <p>
                You represent that you own or have secured all necessary rights to your User Content and that your broadcasts and uploads do not infringe upon third-party intellectual property or violate applicable laws.
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">3. Creator Monetization</h2>
            <div className="space-y-4 text-white/70">
              <p>
                Kryv provides creator monetization features including channel subscriptions, tips, polls, and engagement mechanics. Payments, settlement, and any creator verification are handled through approved payment service providers when those features are enabled. Creators must complete any required verification before payouts can be requested. Kryv deducts applicable platform service fees as configured in creator dashboards prior to settlement.
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">4. Prohibited Conduct &amp; Content Moderation</h2>
            <div className="space-y-4 text-white/70">
              <p>To maintain a safe, high-quality entertainment ecosystem, users are strictly prohibited from transmitting or uploading:</p>
              <ul className="space-y-2 pl-4">
                <li className="list-disc">Illegal content, copyright infringement, or unauthorized pirated media (including unauthorized Cinema playback);</li>
                <li className="list-disc">Harassment, hate speech, malicious doxxing, or incitement of violence;</li>
                <li className="list-disc">Sexually explicit material or content endangering minors;</li>
                <li className="list-disc">Spam, automated bot traffic, or exploits designed to manipulate viewer counts, channel points, or predictions.</li>
              </ul>
              <p>
                Channel owners and appointed moderators possess administrative authority to timeout, ban, or delete abusive chat messages. Kryv reserves the right to suspend or terminate accounts violating these standards without notice.
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">5. Limitation of Liability &amp; Disclaimers</h2>
            <p className="text-white/70 leading-relaxed">
              The Service is provided on an "as is" and "as available" basis without warranties of any kind. Kryv, its officers, service providers, and affiliates disclaim all warranties, express or implied. Kryv shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising out of your use of or inability to use the Platform.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">6. Modifications &amp; Governing Law</h2>
            <p className="text-white/70 leading-relaxed">
              We reserve the right to modify these Terms at any time. Continued use of Kryv following any modification constitutes your binding acceptance of the revised Terms. These Terms are governed by applicable commercial laws without regard to conflict of law principles.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
