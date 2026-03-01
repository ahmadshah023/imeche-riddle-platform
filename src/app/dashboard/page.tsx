"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { LogOut, ListChecks, Trophy, User } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { signOut, db } from "@/lib/firebase";
import {
  collection,
  onSnapshot,
  query,
  where,
  type DocumentData,
} from "firebase/firestore";
import type { Competition } from "@/lib/competitionTypes";

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [passwordInput, setPasswordInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;

    const col = collection(db, "competitions");
    const q = query(col, where("status", "!=", "ended"));

    const unsub = onSnapshot(q, (snap) => {
      const list: Competition[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data() as DocumentData;
        list.push({
          id: docSnap.id,
          name: data.name ?? "Untitled Competition",
          password: data.password ?? "",
          status: data.status ?? "waiting",
          durationMinutes: data.durationMinutes ?? 180,
          startTime: data.startTime,
          extraMinutesTotal: data.extraMinutesTotal ?? 0,
          createdAt: data.createdAt ?? new Date().toISOString(),
        });
      });
      setCompetitions(list);
    });

    return () => unsub();
  }, [user]);

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  function handleJoinCompetition(comp: Competition) {
    setJoiningId(comp.id);
    setPasswordInput("");
    setError(null);
  }

  async function confirmJoin() {
    if (!joiningId || !user) return;
    const target = competitions.find((c) => c.id === joiningId);
    if (!target) return;

    if (passwordInput.trim() !== target.password) {
      setError("Incorrect competition password.");
      return;
    }

    const { doc, setDoc } = await import("firebase/firestore");
    const membershipId = `${joiningId}_${user.uid}`;
    const ref = doc(db, "competitionMemberships", membershipId);
    await setDoc(
      ref,
      {
        competitionId: joiningId,
        userId: user.uid,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );

    router.push(`/competition/${joiningId}`);
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <p className="text-sm text-slate-300">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-slate-50">
      <header className="flex items-center justify-between border-b border-slate-800/80 bg-slate-950/70 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-300">
            <Trophy className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-300">
              Competitions
            </p>
            <p className="text-xs text-slate-300">
              Choose a live event to join with its password.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 rounded-full border border-slate-800 bg-slate-900/70 px-2 py-1 text-xs text-slate-200 sm:flex">
            <User className="h-3.5 w-3.5" />
            <span className="max-w-[140px] truncate">
              {user.displayName || user.email}
            </span>
          </div>
          <button
            onClick={handleSignOut}
            className="inline-flex h-8 items-center justify-center rounded-full bg-slate-800/80 px-3 text-xs font-medium text-slate-100 hover:bg-slate-700"
          >
            <LogOut className="mr-1 h-3.5 w-3.5" />
            Logout
          </button>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center px-3 pb-8 pt-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-3xl rounded-3xl border border-slate-800 bg-slate-950/80 p-5 shadow-[0_0_40px_rgba(16,185,129,0.18)]"
        >
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-sky-500/20 text-sky-300">
              <ListChecks className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-slate-50">
                Active competitions
              </h1>
              <p className="text-[11px] text-slate-400">
                Join a competition with its entry password before you pick a
                team and start solving.
              </p>
            </div>
          </div>

          {competitions.length === 0 ? (
            <p className="text-xs text-slate-400">
              No competitions are currently configured. Ask an admin to create
              one from the admin dashboard.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {competitions.map((comp) => (
                <button
                  key={comp.id}
                  type="button"
                  onClick={() => handleJoinCompetition(comp)}
                  className="group flex flex-col rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-4 text-left shadow-md hover:border-emerald-400/60 hover:shadow-emerald-500/30"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-100">
                      {comp.name}
                    </p>
                    <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-300">
                      {comp.status}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Duration: {comp.durationMinutes} min
                  </p>
                </button>
              ))}
            </div>
          )}

          {joiningId && (
            <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/90 p-4">
              <p className="text-xs font-semibold text-slate-100">
                Enter competition password
              </p>
              <p className="mb-2 text-[11px] text-slate-400">
                Ask an organizer for the password for this specific event.
              </p>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => {
                  setError(null);
                  setPasswordInput(e.target.value);
                }}
                className="mb-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-50 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
                placeholder="Competition password"
              />
              {error && (
                <p className="mb-2 text-[11px] text-rose-400">{error}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setJoiningId(null);
                    setPasswordInput("");
                    setError(null);
                  }}
                  className="inline-flex flex-1 items-center justify-center rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-[11px] font-medium text-slate-100 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmJoin}
                  disabled={!passwordInput.trim()}
                  className="inline-flex flex-1 items-center justify-center rounded-xl bg-emerald-500 px-3 py-2 text-[11px] font-semibold text-slate-950 shadow-md shadow-emerald-500/40 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700"
                >
                  Join competition
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}

