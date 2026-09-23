"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Brand } from "@/components/layout/Brand";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";

/**
 * The BizFlow entry form (Phase 6) — one component, two modes.
 * Login and signup both go through Supabase Auth (email + password);
 * BizFlow never sees or stores the password.
 */

const inputClass =
  "mt-1.5 w-full rounded-lg border border-zinc-300 bg-surface px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20";

/** Map Supabase's technical messages to plain, friendly sentences. */
function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) {
    return "Wrong email or password. Please try again.";
  }
  if (m.includes("email not confirmed")) {
    return "Please confirm your email address first — check your inbox for the confirmation link.";
  }
  if (m.includes("already registered") || m.includes("already exists")) {
    return "An account with this email already exists. Try logging in instead.";
  }
  if (m.includes("password should be at least")) {
    return "Your password is too short — please use at least 6 characters.";
  }
  if (m.includes("rate limit") || m.includes("too many requests")) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  if (m.includes("failed to fetch") || m.includes("network")) {
    return "Could not reach the server. Check your internet connection and try again.";
  }
  if (m.includes("valid email")) {
    return "Please enter a valid email address.";
  }
  // Never surface raw technical details to the user.
  return "Something went wrong. Please try again.";
}

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isSignup = mode === "signup";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }
    if (isSignup && password.length < 6) {
      setError("Please choose a password with at least 6 characters.");
      return;
    }
    if (!isSupabaseConfigured) {
      setError(
        "BizFlow is not connected to the database yet. Add your Supabase credentials to .env.local and restart the server.",
      );
      return;
    }

    setBusy(true);
    try {
      const supabase = getSupabaseClient();

      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) {
          setError(friendlyAuthError(error.message));
          return;
        }
        if (!data.session) {
          // Email confirmation is required by the project settings.
          setNotice("Account created! Check your inbox for a confirmation link, then log in.");
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) {
          setError(friendlyAuthError(error.message));
          return;
        }
      }

      // Success: full navigation so the server middleware sees the new
      // cookie session and the dashboard stores load fresh.
      const next = params.get("next");
      window.location.assign(next && next.startsWith("/dashboard") ? next : "/dashboard");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Brand />
        </div>

        <Card className="p-6 sm:p-8">
          <h1 className="text-lg font-semibold text-zinc-900">
            {isSignup ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {isSignup
              ? "Start managing your business in minutes."
              : "Log in to your BizFlow workspace."}
          </p>

          {error ? (
            <div
              role="alert"
              className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {error}
            </div>
          ) : null}
          {notice ? (
            <div
              role="status"
              className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
            >
              {notice}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label htmlFor="auth-email" className="text-sm font-medium text-zinc-700">
                Email
              </label>
              <input
                id="auth-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@yourbusiness.com"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="auth-password" className="text-sm font-medium text-zinc-700">
                Password
              </label>
              <input
                id="auth-password"
                type="password"
                autoComplete={isSignup ? "new-password" : "current-password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isSignup ? "At least 6 characters" : "Your password"}
                className={inputClass}
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy
                ? isSignup
                  ? "Creating account…"
                  : "Logging in…"
                : isSignup
                  ? "Sign Up"
                  : "Log In"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-zinc-500">
            {isSignup ? (
              <>
                Already have an account?{" "}
                <Link href="/login" className="font-medium text-brand-600 hover:text-brand-700">
                  Log in
                </Link>
              </>
            ) : (
              <>
                New to BizFlow?{" "}
                <Link href="/signup" className="font-medium text-brand-600 hover:text-brand-700">
                  Create an account
                </Link>
              </>
            )}
          </p>
        </Card>
      </div>
    </div>
  );
}
