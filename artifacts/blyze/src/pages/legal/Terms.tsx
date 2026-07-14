export default function Terms() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl relative z-10">
      <h1 className="text-4xl font-display font-bold text-white mb-2">Terms of Service</h1>
      <p className="text-muted-foreground mb-10">Last updated July 14, 2026</p>

      <div className="space-y-8 text-white/80 leading-relaxed">
        <p>
          These Terms of Service ("Terms") govern your access to and use of Kryv Live, Kryv Watch,
          and Kryv Cinema (together, "Kryv" or the "Service"). This is a working template modeled on
          common terms used by live-streaming and video platforms (such as Twitch and Kick); it is
          not legal advice and should be reviewed by a lawyer before use in a live product. By
          creating an account or using the Service, you agree to these Terms.
        </p>

        <section>
          <h2 className="text-xl font-bold text-white mb-2">1. Eligibility</h2>
          <p>You must be at least 13 years old to use Kryv. If you are under the age of majority in your jurisdiction, you may only use the Service with the involvement of a parent or guardian.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-2">2. Accounts</h2>
          <p>You are responsible for maintaining the confidentiality of your account credentials, including your stream key, which grants direct broadcasting access to your channel. You are responsible for all activity that occurs under your account.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-2">3. Content You Provide</h2>
          <p>
            You retain ownership of the content you broadcast, upload, or post ("User Content"). By
            submitting User Content, you grant Kryv a worldwide, non-exclusive, royalty-free license
            to host, store, reproduce, transmit, and display it solely for the purpose of operating
            and promoting the Service. You are solely responsible for your User Content and confirm
            you have the rights necessary to share it.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-2">4. Community Guidelines</h2>
          <p>You agree not to use Kryv to:</p>
          <ul className="list-disc pl-6 space-y-1 mt-2">
            <li>Broadcast or upload content that is illegal, infringes intellectual property rights, or violates the rights of others;</li>
            <li>Harass, threaten, or incite violence against any person or group;</li>
            <li>Stream or upload sexually explicit content involving minors, or any content exploiting minors;</li>
            <li>Distribute malware, spam, or engage in fraud, including fake viewership or engagement;</li>
            <li>Circumvent moderation, age restrictions, or platform security measures.</li>
          </ul>
          <p className="mt-2">Violations may result in content removal, channel suspension, or account termination at Kryv's discretion.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-2">5. Copyright &amp; DMCA</h2>
          <p>
            Kryv respects intellectual property rights and responds to properly submitted notices of
            alleged infringement under the Digital Millennium Copyright Act (DMCA) or equivalent local
            law. If you believe your copyrighted work has been used without authorization, submit a
            notice through the contact channels listed on the Service, including a description of the
            work, its location on the Service, and your contact information. Repeat infringers are
            subject to account termination.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-2">6. Live Streaming &amp; Video Infrastructure</h2>
          <p>
            Live broadcasts and video uploads are processed and delivered through Kryv's video
            infrastructure provider (Mux). Stream keys are unique per channel and must not be shared.
            Kryv is not responsible for interruptions caused by your broadcasting hardware, software,
            or network connection.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-2">7. Termination</h2>
          <p>Kryv may suspend or terminate your access to the Service at any time for violation of these Terms or our Community Guidelines. You may stop using the Service and delete your account at any time.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-2">8. Disclaimers &amp; Limitation of Liability</h2>
          <p>The Service is provided "as is" without warranties of any kind. To the maximum extent permitted by law, Kryv is not liable for indirect, incidental, or consequential damages arising from your use of the Service.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-2">9. Changes to These Terms</h2>
          <p>We may update these Terms from time to time. Continued use of the Service after changes take effect constitutes acceptance of the revised Terms.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-2">10. Contact</h2>
          <p>Questions about these Terms can be directed to the Kryv platform owner through the contact channels listed on the Service.</p>
        </section>
      </div>
    </div>
  );
}
