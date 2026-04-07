"use client";

import { Suspense, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

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
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold tracking-tight text-neutral-900">VibePrinting Admin</h1>
        <p className="mt-1 text-xs text-neutral-500">Enter the admin token to continue.</p>
        {children}
      </div>
    </main>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Login failed (${res.status})`);
        return;
      }
      const dest = params.get("redirect") || "/brands";
      startTransition(() => {
        router.push(dest);
        router.refresh();
      });
    } catch (err) {
      setError((err as Error).message ?? "Network error");
    }
  }

  return (
    <LoginShell>
      <form onSubmit={onSubmit}>
        <label className="mt-5 block text-xs font-medium text-neutral-700">Token</label>
        <input
          type="password"
          autoComplete="current-password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 font-mono text-sm text-neutral-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          autoFocus
        />

        {error && (
          <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending || token.length === 0}
          className="mt-5 w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </LoginShell>
  );
}
