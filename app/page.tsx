import Link from "next/link";

const featureCards = [
  {
    title: "Verified Contact Matching",
    text: "Map every due record to the right accounts, finance, and recovery contacts before a reminder goes out."
  },
  {
    title: "Fast Excel-to-Queue Flow",
    text: "Upload the latest master and dues sheets, then let the system rebuild the active reminder queue in minutes."
  },
  {
    title: "Flexible Reminder Windows",
    text: "Run 15, 30, 45, 60, or custom day-based nudges with separate channel controls for email, WhatsApp, and SMS."
  },
  {
    title: "Dispatch Review Before Send",
    text: "Preview generated reminders and send only when the queue looks correct."
  }
];

const metricCards = [
  { value: "100+", label: "Client contacts organized" },
  { value: "50+", label: "Reminder batches coordinated" },
  { value: "95%", label: "Workflow clarity after setup" }
];

const workflowSteps = [
  {
    title: "Upload your master sheet",
    text: "Bring in the long-term customer contact database with decision-makers, finance contacts, and backup numbers."
  },
  {
    title: "Drop in current dues",
    text: "Refresh open invoices any time and keep the reminder queue aligned to the latest customer balances."
  },
  {
    title: "Generate, review, dispatch",
    text: "Create reminders using your day rules, review what will be sent, then trigger live dispatch."
  }
];

export default function HomePage() {
  return (
    <main className="marketing-shell">
      <header className="topbar marketing-topbar">
        <Link href="/" className="brand-lockup">
          <span className="brand-mark" />
          <span className="brand-text">
            <span className="brand-title">Auto Payment Reminder</span>
            <span className="brand-subtitle">Collections operating system</span>
          </span>
        </Link>

        <nav className="marketing-nav" aria-label="Homepage sections">
          <a href="#home">Home</a>
          <a href="#why">Why us</a>
          <a href="#workflow">Workflow</a>
          <a href="#contact">Contact</a>
        </nav>

        <div className="topbar-actions">
          <Link href="/login" className="button button-secondary">
            Login
          </Link>
          <Link href="/signup" className="button">
            Create Account
          </Link>
        </div>
      </header>

      <section id="home" className="landing-hero hero-frame">
        <div className="hero-copy-stack">
          <div>
            <p className="eyebrow">Connect invoices with action</p>
            <h1 className="landing-title">
              Turn scattered Excel reminders into a confident collections workflow.
            </h1>
            <p className="hero-copy">
              Upload master contacts, sync dues, build rule-based reminders, and dispatch from one
              workspace that feels clear for finance teams and easy to review before sending.
            </p>
          </div>

          <div className="hero-actions">
            <Link href="/signup" className="button">
              Start Free Setup
            </Link>
            <Link href="/dashboard" className="button button-secondary">
              Explore Dashboard
            </Link>
          </div>

          <div className="hero-badge-row">
            <span className="badge-pill">Master database sync</span>
            <span className="badge-pill">Multi-channel reminders</span>
            <span className="badge-pill">Manual live dispatch</span>
          </div>
        </div>

        <div className="product-preview">
          <div className="preview-browser">
            <div className="preview-header">
              <div className="preview-dots">
                <span />
                <span />
                <span />
              </div>
              <span className="preview-url">workspace.auto-payment-reminder</span>
            </div>

            <div className="preview-grid">
              <div className="preview-sidebar">
                <div className="preview-sidebar-card is-active">Overview</div>
                <div className="preview-sidebar-card">Master Database</div>
                <div className="preview-sidebar-card">Dues Upload</div>
                <div className="preview-sidebar-card">Rules</div>
                <div className="preview-sidebar-card">Dispatch</div>
              </div>

              <div className="preview-main">
                <div className="preview-stat-grid">
                  <div className="preview-stat-card">
                    <span>Contacts</span>
                    <strong>124</strong>
                  </div>
                  <div className="preview-stat-card">
                    <span>Due records</span>
                    <strong>58</strong>
                  </div>
                  <div className="preview-stat-card">
                    <span>Pending</span>
                    <strong>19</strong>
                  </div>
                </div>

                <div className="preview-activity">
                  <div className="preview-panel">
                    <div className="preview-panel-head">
                      <strong>Reminder performance</strong>
                      <span>Today</span>
                    </div>
                    <div className="preview-chart">
                      <span style={{ height: "52%" }} />
                      <span style={{ height: "70%" }} />
                      <span style={{ height: "44%" }} />
                      <span style={{ height: "82%" }} />
                      <span style={{ height: "60%" }} />
                    </div>
                  </div>

                  <div className="preview-panel">
                    <div className="preview-panel-head">
                      <strong>Latest queue</strong>
                      <span>Ready</span>
                    </div>
                    <div className="preview-table">
                      <div className="preview-row">
                        <span className="preview-bar short" />
                        <span className="preview-tag">Email</span>
                      </div>
                      <div className="preview-row">
                        <span className="preview-bar medium" />
                        <span className="preview-tag accent">WhatsApp</span>
                      </div>
                      <div className="preview-row">
                        <span className="preview-bar long" />
                        <span className="preview-tag">SMS</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="metric-strip">
        {metricCards.map((card) => (
          <article key={card.label} className="metric-card">
            <strong>{card.value}</strong>
            <span>{card.label}</span>
          </article>
        ))}
      </section>

      <section id="why" className="section-block">
        <div className="section-heading-xl">
          <p className="eyebrow">Why teams choose it</p>
          <h2>Made for teams that still live in spreadsheets but need a cleaner follow-up system.</h2>
          <p className="hero-copy">
            The product keeps the familiar upload workflow while giving you structure around
            matching, reminder generation, templates, and dispatch approval.
          </p>
        </div>

        <div className="feature-grid">
          {featureCards.map((card) => (
            <article key={card.title} className="feature-card">
              <h2>{card.title}</h2>
              <p>{card.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="workflow" className="story-grid">
        <article className="story-card story-card-dark">
          <p className="eyebrow">Our story</p>
          <h2>Built for teams who need control before every reminder leaves the system.</h2>
          <p className="hero-copy">
            Instead of forcing finance teams into a complicated CRM, the app starts with the files
            they already maintain and adds a clean operating layer on top: match contacts, apply
            reminder rules, preview the queue, and send with confidence.
          </p>
        </article>

        <article className="story-card">
          <p className="eyebrow">Workflow</p>
          <div className="workflow-stack">
            {workflowSteps.map((step, index) => (
              <div key={step.title} className="workflow-card">
                <span className="workflow-index">0{index + 1}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="section-block">
        <div className="section-heading-xl">
          <p className="eyebrow">What you get</p>
          <h2>A website and product experience that feels more trustworthy the moment it opens.</h2>
        </div>

        <div className="feature-grid">
          {[
            "Clear navigation across every workspace step",
            "Readable cards, tables, and action states",
            "Strong CTAs that stand out from the background",
            "A smoother route-loading experience between sections"
          ].map((item) => (
            <article key={item} className="feature-card feature-card-compact">
              <h3>{item}</h3>
            </article>
          ))}
        </div>
      </section>

      <section id="contact" className="cta-banner">
        <div>
          <p className="eyebrow">Ready to get started?</p>
          <h2>Bring your master sheet, current dues, and reminder rules into one cleaner flow.</h2>
          <p className="hero-copy">
            The setup is simple: create your workspace, upload both files, and start testing your
            reminder queue before going live.
          </p>
        </div>

        <div className="cta-actions">
          <Link href="/signup" className="button">
            Create Workspace
          </Link>
          <Link href="/login" className="button button-secondary">
            Login
          </Link>
        </div>
      </section>

      <footer className="site-footer">
        <div className="footer-brand">
          <div className="brand-lockup">
            <span className="brand-mark" />
            <span className="brand-text">
              <span className="brand-title">Auto Payment Reminder</span>
              <span className="brand-subtitle">Collections operating system</span>
            </span>
          </div>
          <p>Built for teams managing payment follow-ups with Excel-first workflows.</p>
        </div>

        <div className="footer-links">
          <a href="#home">Home</a>
          <a href="#why">Why us</a>
          <a href="#workflow">Workflow</a>
          <a href="#contact">Contact</a>
        </div>
      </footer>
    </main>
  );
}
