"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { LogIn, Mail, Lock, Sparkles, Globe2 } from "lucide-react";
import { emailPasswordSignIn, emailPasswordSignUp, signInWithGoogle } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) return;

    if (user.isAdmin) {
      router.replace("/admin");
    } else {
      router.replace("/dashboard");
    }
  }, [user, authLoading, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (isSignUp) {
        await emailPasswordSignUp(email, password);
      } else {
        await emailPasswordSignIn(email, password);
      }
      // routing handled by root page after auth state change
      router.replace("/");
    } catch (err: any) {
      setError(err?.message ?? "Authentication failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
      router.replace("/");
    } catch (err: any) {
      setError(err?.message ?? "Google sign in failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-950/80 p-6 shadow-2xl shadow-emerald-500/20 backdrop-blur-xl"
      >
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-300">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">
              IMechE Riddles
            </p>
            <h1 className="text-lg font-semibold text-slate-50">
              Log in to start your run
            </h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-300">
              <Mail className="h-3.5 w-3.5" />
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
              placeholder="you@example.com"
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-300">
              <Lock className="h-3.5 w-3.5" />
              Password
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-xs text-rose-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/40 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700"
          >
            <LogIn className="h-4 w-4" />
            {loading ? "Please wait..." : isSignUp ? "Create account" : "Log in"}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={handleGoogle}
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs font-medium text-slate-100 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Globe2 className="h-3.5 w-3.5" />
            Continue with Google
          </button>
        </div>

        <div className="mt-4 text-center text-[11px] text-slate-400">
          <button
            type="button"
            className="underline-offset-2 hover:underline"
            onClick={() => setIsSignUp((v) => !v)}
          >
            {isSignUp
              ? "Already registered? Switch to log in"
              : "First time here? Create your player account"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

