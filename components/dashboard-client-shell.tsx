"use client";

import { useEffect, useState, useTransition } from "react";
import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";

const navItems = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/master", label: "Master Database" },
  { href: "/dashboard/dues", label: "Dues Upload" },
  { href: "/dashboard/rules", label: "Rules & Templates" },
  { href: "/dashboard/dispatch", label: "Dispatch Center" }
] as const satisfies ReadonlyArray<{ href: Route; label: string }>;

export function DashboardClientShell({
  children,
  title,
  description,
  companyName,
  userName
}: {
  children: ReactNode;
  title: string;
  description: string;
  companyName: string;
  userName: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    navItems.forEach((item) => {
      router.prefetch(item.href);
    });
  }, [router]);

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  function handleNavigate(href: Route) {
    if (href === pathname || isPending) {
      return;
    }

    setPendingHref(href);
    startTransition(() => {
      router.push(href);
    });
  }

  return (
    <div className="dashboard-grid">
      <aside className="sidebar glass-panel dashboard-sidebar">
        <div className="sidebar-top">
          <div className="sidebar-brand">
            <span className="brand-mark sidebar-brand-mark" />
            <div className="sidebar-brand-copy">
              <p className="eyebrow">Auto Payment Reminder</p>
              <h2 className="sidebar-title">{companyName}</h2>
              <p className="muted-copy">Signed in as {userName}</p>
            </div>
          </div>

          <nav className="nav-list" aria-label="Dashboard sections">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const isTargetPending = pendingHref === item.href;

              return (
                <button
                  key={item.href}
                  type="button"
                  className={`nav-link ${isActive ? "is-active" : ""} ${
                    isTargetPending ? "is-pending" : ""
                  }`}
                  onClick={() => handleNavigate(item.href)}
                  onMouseEnter={() => router.prefetch(item.href)}
                  aria-current={isActive ? "page" : undefined}
                >
                  <span>{item.label}</span>
                  {isTargetPending ? <span className="nav-link-pulse" aria-hidden="true" /> : null}
                </button>
              );
            })}
          </nav>
        </div>

        <form action="/api/auth/logout" method="post">
          <button className="button button-secondary full-width" type="submit">
            Logout
          </button>
        </form>
      </aside>

      <main className="dashboard-main">
        <section className="hero-panel dashboard-hero-panel">
          <div className="dashboard-hero-copy">
            <p className="eyebrow">Workspace</p>
            <h1>{title}</h1>
            <p className="hero-copy">{description}</p>
          </div>

          <div className="hero-badge-cluster" aria-hidden="true">
            <span className="hero-badge">Fast switching</span>
            <span className="hero-badge">Live reminders</span>
            <span className="hero-badge">Clean uploads</span>
          </div>
        </section>

        <div className={`dashboard-content-shell ${isPending ? "is-loading" : ""}`}>
          {children}

          {isPending ? (
            <div className="route-loading-overlay" aria-live="polite" aria-busy="true">
              <div className="route-loading-card">
                <div className="route-loading-head">
                  <span className="route-loading-dot" />
                  <p>Loading next workspace...</p>
                </div>

                <div className="route-loading-grid">
                  <div className="skeleton-block skeleton-stat" />
                  <div className="skeleton-block skeleton-stat" />
                  <div className="skeleton-block skeleton-stat" />
                  <div className="skeleton-block skeleton-stat" />
                </div>

                <div className="route-loading-stack">
                  <div className="skeleton-block skeleton-panel" />
                  <div className="skeleton-block skeleton-panel" />
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
