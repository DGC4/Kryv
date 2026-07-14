export default function Privacy() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl relative z-10">
      <h1 className="text-4xl font-display font-bold text-white mb-2">Privacy Policy</h1>
      <p className="text-muted-foreground mb-10">Last updated July 14, 2026</p>

      <div className="space-y-8 text-white/80 leading-relaxed">
        <p>
          This Privacy Policy explains how Kryv ("Kryv", "we", "us") collects, uses, and shares
          information when you use the Kryv platform — Kryv Live, Kryv Watch, and Kryv Cinema
          (together, the "Service"). This is a working policy template modeled on common practices
          at live-streaming and video platforms; it is not a substitute for legal advice, and you
          should have it reviewed by a lawyer before relying on it for a live product.
        </p>

        <section>
          <h2 className="text-xl font-bold text-white mb-2">1. Information We Collect</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li><span className="text-white font-medium">Account information:</span> your username, and — if provided — an email address, used for sign-in and account recovery.</li>
            <li><span className="text-white font-medium">Content you create:</span> channel profiles, stream titles, uploaded videos, chat messages, and any other content you post.</li>
            <li><span className="text-white font-medium">Usage data:</span> viewing history, follows, and interactions used to operate features like Discover and view counts.</li>
            <li><span className="text-white font-medium">Broadcast &amp; upload data:</span> live stream and video files you send to our streaming infrastructure provider (Mux) for ingest, transcoding, and delivery.</li>
            <li><span className="text-white font-medium">Technical data:</span> IP address, device/browser information, and log data collected automatically to secure and operate the Service.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-2">2. How We Use Information</h2>
          <p>We use collected information to: operate and improve the Service; authenticate accounts; deliver live streams and on-demand video; power chat, follows, and recommendations; enforce our Terms of Service and Community Guidelines; and communicate with you about your account.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-2">3. How We Share Information</h2>
          <p>
            We share information with service providers who help us run Kryv, most notably our
            authentication provider (Clerk) and our video infrastructure provider (Mux), who process
            data on our behalf under their own privacy and security commitments. We do not sell your
            personal information. We may disclose information if required by law, to protect the
            rights and safety of our users, or to enforce our Terms.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-2">4. Public Content</h2>
          <p>
            Channels, live streams, uploaded videos, and chat messages are generally public and
            visible to any visitor to the Service, similar to other live-streaming platforms such as
            Twitch or Kick. Do not share information in public content or chat that you do not want
            publicly visible.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-2">5. Data Retention</h2>
          <p>We retain account and content data for as long as your account is active, or as needed to comply with legal obligations, resolve disputes, and enforce our agreements. You may request deletion of your account and associated data by contacting us.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-2">6. Children's Privacy</h2>
          <p>Kryv is not directed to children under 13, and we do not knowingly collect personal information from children under 13. If you believe a child has provided us information, contact us and we will remove it.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-2">7. Your Choices</h2>
          <p>You can update your profile information, delete uploaded videos, and end your channel at any time from your dashboard. You may also contact us to request access to, correction of, or deletion of your personal information.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-2">8. Changes to This Policy</h2>
          <p>We may update this Privacy Policy from time to time. Material changes will be reflected by an updated "Last updated" date above.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-2">9. Contact Us</h2>
          <p>Questions about this policy can be directed to the Kryv platform owner through the contact channels listed on the Service.</p>
        </section>
      </div>
    </div>
  );
}
