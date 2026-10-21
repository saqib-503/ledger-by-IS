import { login } from "./submit";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="login">
      <section className="login-story">
        <div className="brand">
          <span className="brand-icon">L</span> ledger
          <span className="brand-dot">.</span>
        </div>
        <div>
          <span className="eyebrow">LESS PAPERWORK. MORE POSSIBILITY.</span>
          <h1>
            Your business,
            <br />
            beautifully
            <br />
            in order.
          </h1>
          <p>
            From the first quotation to the final invoice.
            <br />
            One considered workspace for every detail.
          </p>
        </div>
        <small>INVOICES & QUOTATIONS · BUILT FOR YOUR BUSINESS</small>
      </section>
      <section className="login-form">
        <div>
          <span className="eyebrow">WELCOME BACK</span>
          <h2>Let’s get to work.</h2>
          <p className="muted">Sign in to your document workspace.</p>
          <form action={login}>
            <label>
              Email address
              <input
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                required
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                minLength={6}
                required
                placeholder="Enter your password"
              />
            </label>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <button className="primary" type="submit">
              Sign in <span>→</span>
            </button>
          </form>
          <p className="login-note">
            Access is managed by your administrator.
            <br />
            Your documents are securely saved in Supabase.
          </p>
        </div>
      </section>
    </main>
  );
}
