import Link from "next/link";

const featureCards = [
  {
    title: "Upload Master Contacts",
    text: "Keep one living company directory with email, WhatsApp, SMS, and notes for every client."
  },
  {
    title: "Refresh Dues Anytime",
    text: "Drop in the latest dues sheet every few days and the app re-matches everything automatically."
  },
  {
    title: "Automate Reminder Timing",
    text: "Create reminder windows like 90, 45, and 30 days before the due date with channel-wise control."
  },
  {
    title: "Edit Message Templates",
    text: "Customize email, WhatsApp, and SMS wording for each reminder rule before you send."
  }
];

export default function HomePage() {
  return (
    <div className="marketing-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark" />
          <span>Auto Payment Reminder</span>
        </div>

        <div className="topbar-actions">
          <Link href="/login" className="button button-secondary">
            Login
          </Link>
          <Link href="/signup" className="button">
            Create Account
          </Link>
        </div>
      </header>

      <section className="landing-hero glass-panel">
        <div>
          <p className="eyebrow">Collections workflow, simplified</p>
          <h1 className="landing-title">
            Turn changing Excel files into a clean reminder system your team can trust.
          </h1>
          <p className="hero-copy">
            Clients land on your homepage, sign up, upload the master contact file and the current
            dues sheet, then generate reminders based on the timelines you define.
          </p>

          <div className="hero-actions">
            <Link href="/signup" className="button">
              Start Building
            </Link>
            <Link href="/dashboard" className="button button-secondary">
              View Dashboard
            </Link>
          </div>
        </div>

        <div className="highlight-card">
          <p className="eyebrow">Built for finance teams</p>
          <ul className="plain-list">
            <li>Two-file workflow: master database + dues upload</li>
            <li>Flexible reminder bands like 30, 45, and 90 days</li>
            <li>Editable templates for email, WhatsApp, and SMS</li>
            <li>Manual send or auto-send ready dispatch center</li>
          </ul>
        </div>
      </section>

      <section className="feature-grid">
        {featureCards.map((card) => (
          <article key={card.title} className="feature-card glass-panel">
            <h2>{card.title}</h2>
            <p>{card.text}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
