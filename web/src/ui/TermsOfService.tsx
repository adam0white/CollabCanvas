/**
 * Terms of Service page
 */

import styles from "./LegalPage.module.css";

export function TermsOfService() {
  return (
    <div className={styles.legalPage}>
      <div className={styles.container}>
        <h1>Terms of Service</h1>
        <p className={styles.lastUpdated}>Last Updated: January 2025</p>

        <section>
          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing and using CollabCanvas ("the Service"), you agree to be
            bound by these Terms of Service. If you do not agree to these terms,
            please do not use the Service.
          </p>
        </section>

        <section>
          <h2>2. Description of Service</h2>
          <p>
            CollabCanvas is a real-time collaborative canvas application that
            allows users to create and edit shapes together. The Service is
            provided free of charge during its MVP phase.
          </p>
        </section>

        <section>
          <h2>3. User Accounts</h2>
          <p>
            You may use CollabCanvas as a guest (view-only) or create an account
            to gain editing privileges. You are responsible for maintaining the
            confidentiality of your account credentials.
          </p>
        </section>

        <section>
          <h2>4. Acceptable Use</h2>
          <p>You agree not to:</p>
          <ul>
            <li>Use the Service for any illegal or unauthorized purpose</li>
            <li>
              Attempt to gain unauthorized access to the Service or its related
              systems
            </li>
            <li>
              Interfere with or disrupt the Service or servers or networks
              connected to the Service
            </li>
            <li>
              Upload or create content that is offensive, harmful, or violates
              others' rights
            </li>
          </ul>
        </section>

        <section>
          <h2>5. Content</h2>
          <p>
            You retain ownership of any content you create using CollabCanvas.
            By using the Service, you grant us a limited license to store and
            display your content as necessary to provide the Service.
          </p>
        </section>

        <section>
          <h2>6. Privacy</h2>
          <p>
            Your use of the Service is also governed by our Privacy Policy.
            Please review our Privacy Policy to understand our practices.
          </p>
        </section>

        <section>
          <h2>7. Disclaimer of Warranties</h2>
          <p>
            The Service is provided "as is" without warranties of any kind,
            either express or implied. We do not guarantee that the Service will
            be uninterrupted, secure, or error-free.
          </p>
        </section>

        <section>
          <h2>8. Limitation of Liability</h2>
          <p>
            In no event shall CollabCanvas be liable for any indirect,
            incidental, special, consequential, or punitive damages arising out
            of or relating to your use of the Service.
          </p>
        </section>

        <section>
          <h2>9. Changes to Terms</h2>
          <p>
            We reserve the right to modify these Terms of Service at any time.
            Continued use of the Service after changes constitutes acceptance of
            the modified terms.
          </p>
        </section>

        <section>
          <h2>10. Contact</h2>
          <p>
            For questions about these Terms, please contact us through our
            GitHub repository or website.
          </p>
        </section>
      </div>
    </div>
  );
}
