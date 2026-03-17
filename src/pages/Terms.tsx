import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Terms = () => {
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

        <h1 className="text-2xl font-bold mb-1">Terms of Service</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: March 2026</p>

        <div className="space-y-8 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">1. Acceptance of terms</h2>
            <p>
              By creating an account and using Monto, you agree to these Terms of Service. If you do not agree, do not use the app.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">2. What Monto is</h2>
            <p>
              Monto is a group money management application that allows users to create shared money pots, invite members, collect contributions, and manage withdrawals. Monto is not a bank, not a payment institution, and does not hold your funds directly. All funds are held and processed by Stripe, a licensed payment service provider.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">3. Eligibility</h2>
            <p>
              You must be at least 18 years old to use Monto. By using the app, you confirm that you are 18 or older.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">4. Your account</h2>
            <p>
              You are responsible for maintaining the security of your account credentials. You must not share your password or allow others to access your account. You are responsible for all activity that occurs under your account.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">5. Payments and withdrawals</h2>
            <p>
              All payments are processed by Stripe. By using Monto's payment features, you agree to Stripe's Terms of Service available at{" "}
              <a href="https://stripe.com/legal" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                stripe.com/legal
              </a>. Monto does not store your card or bank account details. Withdrawals are subject to the rules set by the pot creator. Monto is not responsible for disputes between pot creators and members regarding withdrawal approvals or rejections.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">6. Pot creator responsibilities</h2>
            <p className="mb-2">If you create a pot, you are responsible for:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Managing withdrawal approvals fairly and transparently</li>
              <li>Ensuring members are aware of the pot's withdrawal rules</li>
              <li>Using the funds for the stated purpose of the pot</li>
              <li>Ensuring that all expense justifications are accurate</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">7. Prohibited use</h2>
            <p className="mb-2">You may not use Monto to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Collect or distribute funds for illegal purposes</li>
              <li>Launder money or engage in financial fraud</li>
              <li>Impersonate another person</li>
              <li>Circumvent payment processing rules</li>
              <li>Harass, threaten or abuse other users in the pot chat</li>
            </ul>
            <p className="mt-2">
              Monto reserves the right to suspend or terminate any account found in violation of these rules without notice.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">8. Limitation of liability</h2>
            <p className="mb-2">
              Monto is provided "as is", without warranty of any kind. To the maximum extent permitted by law, Monto and its operators are not liable for:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Loss of funds due to user error</li>
              <li>Disputes between pot members</li>
              <li>Interruptions in payment processing caused by Stripe or other third parties</li>
              <li>Data loss or security breaches caused by third-party infrastructure providers</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">9. Intellectual property</h2>
            <p>
              All content, design, code and branding within Monto is the property of its operators. You may not copy, reproduce or redistribute any part of the app without written permission.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">10. Termination</h2>
            <p>
              You may delete your account at any time. Monto reserves the right to suspend or terminate accounts that violate these terms. Upon termination, your data will be deleted in accordance with our Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">11. Governing law</h2>
            <p>
              These terms are governed by French law. Any disputes shall be subject to the exclusive jurisdiction of the courts of Paris, France.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">12. Changes to these terms</h2>
            <p>
              We may update these terms from time to time. Continued use of the app after changes constitutes acceptance of the updated terms. We will notify you of significant changes by email or in-app notification.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">13. Contact</h2>
            <p>
              For any questions regarding these terms:{" "}
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

export default Terms;
