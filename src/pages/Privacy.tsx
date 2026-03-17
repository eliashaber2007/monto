import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Privacy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <h1 className="text-2xl font-bold mb-1">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: March 2026</p>

        <div className="space-y-8 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">1. Who we are</h2>
            <p>
              Monto is a group money management application operated under a registered French company.
              Our website is <span className="text-foreground">montofinance.app</span>. For any privacy-related
              questions, contact us at{" "}
              <a href="mailto:monto75016@gmail.com" className="text-primary hover:underline">
                monto75016@gmail.com
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">2. What data we collect</h2>
            <p className="mb-2">We collect the following personal data when you use Monto:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Full name and display name</li>
              <li>Email address</li>
              <li>Gender (optional)</li>
              <li>Device and browser information</li>
              <li>IP address</li>
              <li>Bank account details (collected and processed exclusively by Stripe — we never store these directly)</li>
              <li>Transaction history within the app (amounts added, withdrawn, pot activity)</li>
              <li>Profile preferences (language, dark/light mode, avatar colour)</li>
              <li>Messages sent in pot chats</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">3. Why we collect it</h2>
            <p className="mb-2">We collect your data to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Create and manage your account</li>
              <li>Process payments and withdrawals via Stripe</li>
              <li>Send you notifications about pot activity</li>
              <li>Send transactional emails (verification, withdrawal approvals, reminders)</li>
              <li>Improve the app and fix bugs</li>
              <li>Comply with applicable financial regulations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">4. Who we share it with</h2>
            <p className="mb-2">We share your data with the following third parties only:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <span className="text-foreground font-medium">Stripe</span> — for payment processing and bank account
                verification. Stripe's privacy policy is available at{" "}
                <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  stripe.com/privacy
                </a>
              </li>
              <li>
                <span className="text-foreground font-medium">Supabase</span> — for secure data storage and
                authentication. Supabase's privacy policy is available at{" "}
                <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  supabase.com/privacy
                </a>
              </li>
              <li>
                <span className="text-foreground font-medium">Resend</span> — for transactional email delivery
              </li>
            </ul>
            <p className="mt-2 font-medium text-foreground">We do not sell your data to any third party, ever.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">5. How long we keep it</h2>
            <p>
              We keep your data for as long as your account is active. If you delete your account, your personal
              data is deleted within 30 days, except where we are required by law to retain it longer.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">6. Your rights (GDPR)</h2>
            <p className="mb-2">Under the General Data Protection Regulation (GDPR), you have the right to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Object to or restrict processing of your data</li>
              <li>Request a copy of your data in a portable format</li>
              <li>Withdraw consent at any time</li>
            </ul>
            <p className="mt-2">
              To exercise any of these rights, contact us at{" "}
              <a href="mailto:monto75016@gmail.com" className="text-primary hover:underline">
                monto75016@gmail.com
              </a>. We will respond within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">7. Cookies</h2>
            <p>
              Monto uses only essential cookies required for authentication and session management. We do not
              use advertising or tracking cookies.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">8. Data security</h2>
            <p>
              All data is encrypted in transit (HTTPS/TLS) and at rest. Authentication is handled via Supabase
              with industry-standard security practices. Payment data is handled exclusively by Stripe, which
              is PCI DSS Level 1 certified.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">9. Children</h2>
            <p>
              Monto is not intended for users under the age of 18. We do not knowingly collect data from minors.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">10. Changes to this policy</h2>
            <p>
              We may update this policy from time to time. We will notify you by email or in-app notification
              of any significant changes. Continued use of the app after changes constitutes acceptance of the
              new policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">11. Contact</h2>
            <p>
              For any privacy questions:{" "}
              <a href="mailto:monto75016@gmail.com" className="text-primary hover:underline">
                monto75016@gmail.com
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Privacy;
