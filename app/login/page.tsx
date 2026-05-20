import Link from "next/link";

export default function LoginPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <main className="auth-shell">
      <section className="auth-panel glass-panel">
        <p className="eyebrow">Welcome back</p>
        <h1>Access your reminder dashboard</h1>
        <p className="hero-copy">
          Upload the latest dues file, review the reminder queue, and send from one place.
        </p>

        <StatusBanner searchParams={searchParams} />

        <form action="/api/auth/login" method="post" className="form-stack">
          <label className="field">
            <span>Email</span>
            <input name="email" type="email" placeholder="you@company.com" required />
          </label>

          <label className="field">
            <span>Password</span>
            <input name="password" type="password" required />
          </label>

          <button className="button full-width" type="submit">
            Login
          </button>
        </form>

        <p className="muted-copy">
          New here? <Link href="/signup">Create an account</Link>.
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
  const message = typeof params.message === "string" ? params.message : "";

  if (!error && !message) {
    return null;
  }

  return (
    <p className={`status-banner ${error ? "status-error" : "status-success"}`}>
      {decodeURIComponent(error || message)}
    </p>
  );
}
