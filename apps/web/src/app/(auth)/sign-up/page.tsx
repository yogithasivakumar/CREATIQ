"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AuthCard } from "@/components/auth/AuthCard";

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setLoading(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    setSubmitted(true);
  }

  if (submitted) {
    return (
      <AuthCard title="Check your email">
        <p className="text-sm text-aubergine/80">
          We sent a confirmation link to <strong>{email}</strong>. Follow it
          to activate your account.
        </p>
        <Link
          href="/sign-in"
          className="mt-6 inline-block text-sm font-medium text-marigold hover:underline"
        >
          Back to sign in
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Create your account" subtitle="Start creating with CREATIQ.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-aubergine">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1 w-full rounded-xl border border-aubergine/20 px-4 py-2.5 outline-none focus:border-marigold"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-aubergine">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1 w-full rounded-xl border border-aubergine/20 px-4 py-2.5 outline-none focus:border-marigold"
          />
          <p className="mt-1 text-xs text-aubergine/60">At least 8 characters.</p>
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-aubergine px-4 py-2.5 font-semibold text-white transition hover:bg-aubergine/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Creating account..." : "Sign up"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-aubergine/70">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-medium text-marigold hover:underline">
          Sign in
        </Link>
      </p>
    </AuthCard>
  );
}
