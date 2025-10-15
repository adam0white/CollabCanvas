/**
 * Privacy Policy page
 */

import styles from "./LegalPage.module.css";

export function PrivacyPolicy() {
  return (
    <div className={styles.legalPage}>
      <div className={styles.container}>
        <h1>Privacy Policy</h1>
        <p className={styles.lastUpdated}>Last Updated: January 2025</p>

        <section>
          <h2>1. Introduction</h2>
          <p>
            This Privacy Policy explains how CollabCanvas ("we", "us", "our")
            collects, uses, and protects your information when you use our
            collaborative canvas service.
          </p>
        </section>

        <section>
          <h2>2. Information We Collect</h2>

          <h3>2.1 Account Information</h3>
          <p>
            When you create an account through Clerk authentication, we collect:
          </p>
          <ul>
            <li>Email address</li>
            <li>Display name</li>
            <li>Profile picture (if provided)</li>
            <li>Authentication credentials managed by Clerk</li>
          </ul>

          <h3>2.2 Usage Information</h3>
          <p>When you use CollabCanvas, we automatically collect:</p>
          <ul>
            <li>Canvas content you create (shapes, positions, properties)</li>
            <li>Cursor position and presence information</li>
            <li>Connection metadata (timestamps, user actions)</li>
          </ul>

          <h3>2.3 Technical Information</h3>
          <p>We collect basic technical information including:</p>
          <ul>
            <li>IP address</li>
            <li>Browser type and version</li>
            <li>Device information</li>
          </ul>
        </section>

        <section>
          <h2>3. How We Use Your Information</h2>
          <p>We use collected information to:</p>
          <ul>
            <li>Provide and maintain the collaborative canvas service</li>
            <li>Authenticate users and manage access control</li>
            <li>Display your presence and contributions to other users</li>
            <li>Improve and optimize the Service</li>
            <li>Ensure security and prevent abuse</li>
          </ul>
        </section>

        <section>
          <h2>4. Data Storage and Security</h2>
          <p>
            Your data is stored on Cloudflare's infrastructure using Durable
            Objects. We implement industry-standard security measures including:
          </p>
          <ul>
            <li>Encrypted data transmission (HTTPS/WSS)</li>
            <li>JWT-based authentication</li>
            <li>Content Security Policy (CSP) headers</li>
            <li>Regular security updates and monitoring</li>
          </ul>
        </section>

        <section>
          <h2>5. Data Sharing</h2>
          <p>
            We do not sell your personal information. Your canvas content is
            visible to other users who access the same canvas room. We may share
            data with:
          </p>
          <ul>
            <li>
              <strong>Clerk</strong>: Authentication service provider
            </li>
            <li>
              <strong>Cloudflare</strong>: Hosting and infrastructure provider
            </li>
          </ul>
        </section>

        <section>
          <h2>6. Third-Party Services</h2>

          <h3>6.1 Clerk Authentication</h3>
          <p>
            We use Clerk for authentication. Please review{" "}
            <a
              href="https://clerk.com/legal/privacy"
              target="_blank"
              rel="noopener noreferrer"
            >
              Clerk's Privacy Policy
            </a>{" "}
            for information about their data practices.
          </p>

          <h3>6.2 Cloudflare</h3>
          <p>
            Our service is hosted on Cloudflare Workers. Please review{" "}
            <a
              href="https://www.cloudflare.com/privacypolicy/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Cloudflare's Privacy Policy
            </a>{" "}
            for their data practices.
          </p>
        </section>

        <section>
          <h2>7. Cookies and Local Storage</h2>
          <p>
            We use browser local storage and cookies for authentication and to
            maintain your session. You can control cookies through your browser
            settings.
          </p>
        </section>

        <section>
          <h2>8. Your Rights</h2>
          <p>You have the right to:</p>
          <ul>
            <li>Access your personal information</li>
            <li>Request correction of your data</li>
            <li>Request deletion of your account and data</li>
            <li>Opt out of future communications</li>
          </ul>
          <p>
            To exercise these rights, please contact us through our GitHub
            repository or website.
          </p>
        </section>

        <section>
          <h2>9. Children's Privacy</h2>
          <p>
            CollabCanvas is not intended for children under 13 years of age. We
            do not knowingly collect information from children under 13.
          </p>
        </section>

        <section>
          <h2>10. Changes to Privacy Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify
            users of any material changes by updating the "Last Updated" date.
          </p>
        </section>

        <section>
          <h2>11. Contact Us</h2>
          <p>
            For questions about this Privacy Policy or our data practices,
            please contact us through our GitHub repository at{" "}
            <a
              href="https://github.com/adam0white/CollabCanvas"
              target="_blank"
              rel="noopener noreferrer"
            >
              github.com/adam0white/CollabCanvas
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
