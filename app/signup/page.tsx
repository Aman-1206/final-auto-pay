import Link from "next/link";

export default function SignupPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <main className="auth-shell">
      <section className="auth-panel glass-panel">
        <p className="eyebrow">Create account</p>
        <h1>Launch your reminder workspace</h1>
        <p className="hero-copy">
          After signup you will land directly in the dashboard with starter reminder rules and
          editable templates.
        </p>

        <StatusBanner searchParams={searchParams} />

        <form action="/api/auth/signup" method="post" className="form-stack">
          <label className="field">
            <span>Name</span>
            <input name="name" type="text" placeholder="Aman Kumar" required />
          </label>

          <label className="field">
            <span>Business email</span>
            <input name="email" type="email" placeholder="you@company.com" required />
          </label>

          <label className="field">
            <span>Company name</span>
            <input name="companyName" type="text" placeholder="Northwind Finance" required />
          </label>

          <label className="field">
            <span>Password</span>
            <input name="password" type="password" minLength={8} required />
          </label>

          <button className="button full-width" type="submit">
            Create account
          </button>
        </form>

        <p className="muted-copy">
          Already have an account? <Link href="/login">Login here</Link>.
        </p>
      </section>
    </main>
  );
}

async function StatusBanner({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : "";

  if (!error) {
    return null;
  }

  return <p className="status-banner status-error">{decodeURIComponent(error)}</p>;
}
