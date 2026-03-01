"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Users } from "lucide-react";
import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  doc,
  setDoc,
} from "firebase/firestore";
import type { AppUser } from "@/components/AuthProvider";

type Props = {
  user: AppUser;
  onTeamAssigned: (teamId: string, teamName: string) => void;
};

export function TeamSetup({ user, onTeamAssigned }: Props) {
  const [teamName, setTeamName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreateTeam(e: React.FormEvent) {
    e.preventDefault();
    if (!teamName.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const teamsCol = collection(db, "teams");
      const teamDoc = await addDoc(teamsCol, {
        name: teamName.trim(),
        createdAt: new Date().toISOString(),
        ownerId: user.uid,
      });

      // attach user to team
      const userRef = doc(db, "users", user.uid);
      await setDoc(
        userRef,
        {
          teamId: teamDoc.id,
          teamName: teamName.trim(),
        },
        { merge: true },
      );

      onTeamAssigned(teamDoc.id, teamName.trim());
    } catch (err: any) {
      setError(err?.message ?? "Could not create team. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-md rounded-3xl border border-slate-800 bg-slate-950/80 p-6 shadow-xl shadow-emerald-500/20"
    >
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-300">
          <Users className="h-4 w-4" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">
            Squad Up
          </p>
          <h2 className="text-sm font-semibold text-slate-50">
            Create your team to start playing
          </h2>
        </div>
      </div>
      <p className="text-[11px] text-slate-400 mb-3">
        Each player belongs to a team. Team progress is shared, so coordinate
        with your teammates before choosing a name.
      </p>
      <form onSubmit={handleCreateTeam} className="space-y-3">
        <input
          type="text"
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
          placeholder="Team Brabers Ninjas"
          className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-base text-slate-50 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
        />
        {error && <p className="text-xs text-rose-400">{error}</p>}
        <button
          type="submit"
          disabled={loading || !teamName.trim()}
          className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-950 shadow-md shadow-emerald-500/40 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700"
        >
          {loading ? "Creating..." : "Create team and start"}
        </button>
      </form>
    </motion.div>
  );
}

