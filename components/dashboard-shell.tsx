import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth";

const navItems = [
  { href: "/dashboard" as const, label: "Overview" },
  { href: "/dashboard/master" as const, label: "Master Database" },
  { href: "/dashboard/dues" as const, label: "Dues Upload" },
  { href: "/dashboard/rules" as const, label: "Rules & Templates" },
  { href: "/dashboard/dispatch" as const, label: "Dispatch Center" }
];

export async function DashboardShell({
  children,
  title,
  description
}: {
  children: ReactNode;
  title: string;
  description: string;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="dashboard-grid">
      <aside className="sidebar glass-panel">
        <div>
          <p className="eyebrow">Auto Payment Reminder</p>
          <h2 className="sidebar-title">{user.companyName}</h2>
          <p className="muted-copy">Signed in as {user.name}</p>
        </div>

        <nav className="nav-list">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="nav-link">
              {item.label}
            </Link>
          ))}
        </nav>

        <form action="/api/auth/logout" method="post">
          <button className="button button-secondary full-width" type="submit">
            Logout
          </button>
        </form>
      </aside>

      <main className="dashboard-main">
        <section className="hero-panel">
          <p className="eyebrow">Workspace</p>
          <h1>{title}</h1>
          <p className="hero-copy">{description}</p>
        </section>
        {children}
      </main>
    </div>
  );
}
