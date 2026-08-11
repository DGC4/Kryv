export default function Privacy() {
  return (
      <div className="relative z-10 min-h-screen bg-gradient-to-b from-black via-black to-primary/5 px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-12 text-center">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white mb-4">Privacy Policy</h1>
            <p className="text-xs sm:text-sm text-white/60">Last updated: August 11, 2026</p>
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
                <p>When you create an account, we collect your username, email address, and a securely hashed password; we do not store passwords in plain text. We may also store an avatar URL, account role, account-status information, your last-login time, and timestamps recording acceptance of our Terms, Privacy Policy, or a data-deletion request.</p>
              </div>
              <div>
                <h3 className="text-white font-bold mb-2">Content You Create</h3>
                <p>We collect and store the content and settings you create on Kryv, including channel profiles, stream titles, descriptions, uploaded videos, live-session records, chat messages, channel tags, goals, polls, predictions, and metadata you provide. We store application records in Neon PostgreSQL and use FastPix to ingest, process, and deliver video.</p>
              </div>
              <div>
                <h3 className="text-white font-bold mb-2">Viewing &amp; Interaction Data</h3>
                <p>For signed-in users, we may store video watch history and progress, channel follows, subscriptions, blocks, chat activity, and participation in platform features such as polls, predictions, channel points, tips, and clip reactions. For live streams, we may record viewer-session information, including whether a session is anonymous or associated with an account. This data supports discovery, creator analytics, service operation, and safety controls.</p>
              </div>
              <div>
                <h3 className="text-white font-bold mb-2">Live Stream &amp; Upload Data</h3>
                <p>When you go live or upload a video, media is sent to FastPix, our video infrastructure provider, for secure ingest, processing, playback, and delivery. Kryv stores stream metadata and operational records such as start and end times, stream titles, categories, peak and average viewer counts, and creator stream credentials. Public FastPix playback identifiers are used to deliver public live broadcasts to guests; a stream key is kept private and must never be shared.</p>
              </div>
              <div>
                <h3 className="text-white font-bold mb-2">Technical &amp; Device Data</h3>
                <p>We automatically collect technical information such as IP address, user agent, browser, operating system, device type, optional browser fingerprint, approximate country and city inferred from IP, last visited page, visit count, and timestamps. For signed-in use, we may also maintain device-history records such as device name, browser, operating system, IP address, login count, and last-seen time.</p>
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
              We retain account information, content, and operational logs for as long as reasonably necessary to operate the Service, meet legal obligations, resolve disputes, enforce agreements, and maintain security. You may request deletion of your account and associated data. We will assess and handle verified requests in accordance with applicable law; limited records may be retained where legally required or reasonably necessary for safety, fraud prevention, or dispute resolution, and backup systems may retain information for a limited period.
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
