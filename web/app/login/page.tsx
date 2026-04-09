"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Token entry form. POSTs to /api/login which sets the session cookie
 * on success. Then bounces to ?redirect=<path> if present, otherwise
 * to /brands. Renders full-screen because it lives outside the (app)
 * group's sidebar layout.
 *
 * useSearchParams() requires a Suspense boundary during static
 * prerendering, so the form is split into an inner client component
 * and the page exports a Suspense wrapper.
 */
export default function LoginPage() {
  return (
    <Suspense fallback={<LoginShell />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginShell({ children }: { children?: React.ReactNode }) {
  return (
    <main className="relative flex min-h-screen items-center justify-center px-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(139,92,246,0.18),transparent_60%)]" />
      <div className="relative w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-accent to-info text-sm font-bold text-white shadow-lg shadow-accent/40">
            V
          </span>
          <span className="text-base font-semibold tracking-tight text-fg">
            VibePrinting
          </span>
        </div>
        <div className="card p-6">
          <h1 className="text-base font-semibold tracking-tight text-fg">
            Sign in
          </h1>
          <p className="mt-1 text-xs text-fg-muted">
            Enter the admin token to continue.
          </p>
          {children}
        </div>
      </div>
    </main>
  );
}

function LoginForm() {
  const params = useSearchParams();
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? `Login failed (${res.status})`);
        setPending(false);
        return;
      }
      const dest = params.get("redirect") || "/brands";
      window.location.href = dest;
    } catch (err) {
      setError((err as Error).message ?? "Network error");
      setPending(false);
    }
  }

  return (
    <LoginShell>
      <form onSubmit={onSubmit} className="mt-5 space-y-4">
        <label className="block">
          <span className="label">Token</span>
          <input
            type="password"
            autoComplete="current-password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="input input-sm mt-1.5 font-mono"
            autoFocus
          />
        </label>

        {error && <p className="alert-error">{error}</p>}

        <button
          type="submit"
          disabled={pending || token.length === 0}
          className="btn-primary w-full"
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </LoginShell>
  );
}
