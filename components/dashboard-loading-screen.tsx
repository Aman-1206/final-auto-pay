export function DashboardLoadingScreen() {
  return (
    <div className="dashboard-grid dashboard-loading-page">
      <aside className="sidebar glass-panel dashboard-sidebar">
        <div className="sidebar-top">
          <div className="sidebar-brand">
            <span className="brand-mark sidebar-brand-mark" />
            <div className="sidebar-brand-copy">
              <div className="skeleton-line skeleton-line-short" />
              <div className="skeleton-line skeleton-line-title" />
              <div className="skeleton-line skeleton-line-medium" />
            </div>
          </div>

          <div className="nav-list">
            <div className="skeleton-block skeleton-nav" />
            <div className="skeleton-block skeleton-nav" />
            <div className="skeleton-block skeleton-nav" />
            <div className="skeleton-block skeleton-nav" />
            <div className="skeleton-block skeleton-nav" />
          </div>
        </div>

        <div className="skeleton-block skeleton-button" />
      </aside>

      <main className="dashboard-main">
        <section className="hero-panel dashboard-hero-panel">
          <div className="dashboard-hero-copy">
            <div className="skeleton-line skeleton-line-short" />
            <div className="skeleton-line skeleton-line-hero" />
            <div className="skeleton-line skeleton-line-long" />
            <div className="skeleton-line skeleton-line-medium" />
          </div>
        </section>

        <section className="stats-grid">
          <div className="skeleton-block skeleton-stat" />
          <div className="skeleton-block skeleton-stat" />
          <div className="skeleton-block skeleton-stat" />
          <div className="skeleton-block skeleton-stat" />
        </section>

        <section className="content-grid">
          <div className="skeleton-block skeleton-panel" />
          <div className="skeleton-block skeleton-panel" />
        </section>
      </main>
    </div>
  );
}
