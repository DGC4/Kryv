export default function Privacy() {
  return (
      <div className="relative z-10 min-h-screen bg-gradient-to-b from-black via-black to-primary/5 px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-12 text-center">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white mb-4">Privacy Policy</h1>
            <p className="text-xs sm:text-sm text-white/60">Last updated: August 3, 2026</p>
          </div>

          {/* Content */}
          <div className="space-y-8 text-white/80 leading-relaxed">

          <p className="text-base sm:text-lg text-white/90 font-medium">
            This Privacy Policy explains how Kryv ("we," "us," "our") collects, uses, stores, and shares your information when you use the Kryv platform, including Kryv Live (live streaming), Kryv Watch (on-demand videos), and Kryv Cinema (curated library) (collectively, the "Service").
          </p>

          <section className="space-y-4">
            <h2 className="text-2xl sm:text-3xl font-black text-white">1. Information We Collect</h2>
            <div className="space-y-4 text-base sm:text-lg">
              <div>
                <h3 className="text-white font-bold mb-2">Account Information</h3>
                <p>When you create an account, we collect your username, email address (optional), and a hashed password. We do not store passwords in plain text. If you provide an avatar URL, we store that as well. Your account role (user or owner) is also stored.</p>
              </div>
              <div>
                <h3 className="text-white font-bold mb-2">Content You Create</h3>
                <p>We collect and store all content you create on Kryv, including channel profiles, stream titles, descriptions, uploaded videos, chat messages, and any metadata you provide. This content is stored in our Neon PostgreSQL database and delivered via FastPix.</p>
              </div>
              <div>
                <h3 className="text-white font-bold mb-2">Viewing &amp; Interaction Data</h3>
                <p>We track your viewing history (which videos you watch), watch progress (how far you've watched), follows (which channels you follow), and interactions (likes, comments, subscriptions). This data powers personalization features like the Discover page and recommendations.</p>
              </div>
              <div>
                <h3 className="text-white font-bold mb-2">Live Stream &amp; Upload Data</h3>
                <p>When you go live or upload a video, the media file is sent to FastPix (our video infrastructure provider) for ingest, transcoding, and delivery. Stream metadata (title, category, duration) is stored in our database. Stream sessions are tracked, including start time, end time, peak viewer count, and average viewers.</p>
              </div>
              <div>
                <h3 className="text-white font-bold mb-2">Technical &amp; Device Data</h3>
                <p>We automatically collect your IP address, browser type, operating system, device type, and user agent. We use browser fingerprinting to identify unique visitors. We also collect your approximate location (country, city) based on IP geolocation. This data is stored in our visitors table.</p>
              </div>
              <div>
                <h3 className="text-white font-bold mb-2">Stream Keys &amp; Authentication</h3>
                <p>If you are a creator, we generate and store a unique stream key for your channel. This key is used to authenticate your OBS/streaming software with our FastPix RTMP ingest server. Stream keys are sensitive and should never be shared. We also store information about when your stream key was generated.</p>
              </div>
              <div>
                <h3 className="text-white font-bold mb-2">Activity Logs</h3>
                <p>We log platform activities including signups, logins, channel creation, stream starts/stops, video uploads, follows, and subscriptions. These logs are used for security, fraud detection, and platform analytics.</p>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl sm:text-3xl font-black text-white">2. How We Use Your Information</h2>
            <ul className="space-y-3 text-base sm:text-lg">
              <li className="flex gap-3">
                <span className="text-primary font-bold shrink-0">•</span>
                <span><span className="text-white font-bold">Operating the Service:</span> To authenticate your account, deliver live streams and on-demand video, process uploads, and maintain platform infrastructure.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-primary font-bold shrink-0">•</span>
                <span><span className="text-white font-bold">Personalization:</span> To power the Discover page, show recommendations, track your watch history, and customize your experience.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-primary font-bold shrink-0">•</span>
                <span><span className="text-white font-bold">Analytics:</span> To understand how creators and viewers use Kryv, measure engagement, and improve features.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-primary font-bold shrink-0">•</span>
                <span><span className="text-white font-bold">Safety &amp; Security:</span> To detect fraud, prevent abuse, enforce our Terms of Service and Community Guidelines, and protect the rights and safety of our users.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-primary font-bold shrink-0">•</span>
                <span><span className="text-white font-bold">Communication:</span> To send you important updates about your account, the Service, or changes to our policies.</span>
              </li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl sm:text-3xl font-black text-white">3. How We Share Your Information</h2>
            <div className="space-y-4 text-base sm:text-lg">
              <p>
                We do not sell your personal information. We share information only in the following circumstances:
              </p>
              <div>
                <h3 className="text-white font-bold mb-2">Service Providers</h3>
                <p>We share information with third-party service providers who help us operate Kryv, including FastPix (video infrastructure), Neon (database hosting), and Render (application hosting). These providers process data on our behalf under strict confidentiality agreements.</p>
              </div>
              <div>
                <h3 className="text-white font-bold mb-2">Public Content</h3>
                <p>Your channel profile, live streams, uploaded videos, and chat messages are public by default and visible to anyone visiting Kryv. Do not share sensitive information in public content.</p>
              </div>
              <div>
                <h3 className="text-white font-bold mb-2">Legal Requirements</h3>
                <p>We may disclose information if required by law, court order, or government request. We will notify you of such requests when legally permissible.</p>
              </div>
              <div>
                <h3 className="text-white font-bold mb-2">Safety &amp; Enforcement</h3>
                <p>We may disclose information to protect the rights, privacy, safety, or property of Kryv, our users, or the public; to enforce our Terms of Service; or to prevent or investigate possible wrongdoing.</p>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl sm:text-3xl font-black text-white">4. Data Retention</h2>
            <p className="text-base sm:text-lg">
              We retain your account information, content, and activity logs for as long as your account is active. If you delete your account, we will delete associated personal data within 30 days, except where we are required to retain it by law or for legitimate business purposes (such as resolving disputes or enforcing agreements). Deleted content may remain in backups for up to 90 days.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl sm:text-3xl font-black text-white">5. Your Privacy Rights</h2>
            <div className="space-y-4 text-base sm:text-lg">
              <p>Depending on your location, you may have the following rights:</p>
              <ul className="space-y-3">
                <li className="flex gap-3">
                  <span className="text-primary font-bold shrink-0">•</span>
                  <span><span className="text-white font-bold">Access:</span> Request a copy of the personal information we hold about you.</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-primary font-bold shrink-0">•</span>
                  <span><span className="text-white font-bold">Correction:</span> Request that we correct inaccurate information.</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-primary font-bold shrink-0">•</span>
                  <span><span className="text-white font-bold">Deletion:</span> Request that we delete your account and associated data.</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-primary font-bold shrink-0">•</span>
                  <span><span className="text-white font-bold">Portability:</span> Request your data in a portable format.</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-primary font-bold shrink-0">•</span>
                  <span><span className="text-white font-bold">Opt-Out:</span> Opt out of certain data processing activities.</span>
                </li>
              </ul>
              <p>To exercise these rights, contact us through the channels listed in Section 9.</p>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl sm:text-3xl font-black text-white">6. Children's Privacy</h2>
            <p className="text-base sm:text-lg">
              Kryv is not directed to children under 13. We do not knowingly collect personal information from children under 13. If we learn that we have collected information from a child under 13, we will delete it promptly. If you believe a child has provided us information, please contact us immediately.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl sm:text-3xl font-black text-white">7. Security</h2>
            <p className="text-base sm:text-lg">
              We implement industry-standard security measures to protect your information, including encryption, secure authentication, and rate limiting. However, no security system is impenetrable. We cannot guarantee absolute security of your data. You are responsible for maintaining the confidentiality of your account credentials and stream keys.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl sm:text-3xl font-black text-white">8. Third-Party Links</h2>
            <p className="text-base sm:text-lg">
              Kryv may contain links to third-party websites and services. This Privacy Policy does not apply to third-party sites. We are not responsible for their privacy practices. Please review their privacy policies before providing your information.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl sm:text-3xl font-black text-white">9. Changes to This Policy</h2>
            <p className="text-base sm:text-lg">
              We may update this Privacy Policy from time to time. Material changes will be reflected by an updated "Last updated" date above. Your continued use of the Service after changes take effect constitutes acceptance of the revised Privacy Policy.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl sm:text-3xl font-black text-white">10. Contact Us</h2>
            <p className="text-base sm:text-lg">
              If you have questions about this Privacy Policy or our privacy practices, please contact the Kryv platform owner through the contact channels listed on the Service. We will respond to your inquiry within 30 days.
            </p>
          </section>

          {/* Footer Notice */}
          <div className="mt-12 pt-8 border-t border-white/10">
            <p className="text-xs sm:text-sm text-white/50">
              This Privacy Policy is a working template modeled on common practices at live-streaming and video platforms. It is not legal advice. You should have it reviewed by a qualified privacy attorney before relying on it for a live product.
            </p>
          </div>
          </div>
        </div>
      </div>
  );
}
