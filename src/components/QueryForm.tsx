"use client";

import React, { useState } from "react";
import { HelpCircle } from "lucide-react";
import { db, serverTimestamp } from "@/lib/firebase";
import { collection, addDoc } from "firebase/firestore";
import type { AppUser } from "@/components/AuthProvider";

type Props = {
  user: AppUser;
  competitionId?: string;
  teamId?: string;
  teamName?: string;
};

export function QueryForm({ user, competitionId, teamId, teamName }: Props) {
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const finalTeamId = teamId ?? user.teamId;
    const finalTeamName = teamName ?? user.teamName;
    if (!message.trim() || !finalTeamId) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const col = collection(db, "queries");
      await addDoc(col, {
        userId: user.uid,
        userEmail: user.email,
        userName: user.displayName,
        teamId: finalTeamId,
        teamName: finalTeamName,
        competitionId: competitionId,
        message: message.trim(),
        status: "open",
        createdAt: serverTimestamp(),
      });
      setMessage("");
      setFeedback("Your query has been sent to the admins.");

      try {
        const audio = new Audio("/sounds/notify.mp3");
        audio.play().catch(() => {});
      } catch {
        // ignore
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-6 rounded-3xl border border-slate-800 bg-slate-950/80 p-4">
      <div className="mb-2 flex items-center gap-2">
        <HelpCircle className="h-4 w-4 text-emerald-300" />
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-100">
          Stuck? Ask the admins
        </h3>
      </div>
      <p className="mb-2 text-[11px] text-slate-400">
        Explain where you are stuck or what is ambiguous. The reply will arrive
        in your team&apos;s notifications tab.
      </p>
      <form onSubmit={handleSubmit} className="space-y-2">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Describe the riddle, your attempt, and what is confusing..."
          className="min-h-[70px] w-full resize-none rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-50 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
        />
        <button
          type="submit"
          disabled={submitting || !message.trim()}
          className="inline-flex w-full items-center justify-center rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-950 shadow-sm hover:bg-white disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-200"
        >
          {submitting ? "Sending..." : "Send query"}
        </button>
      </form>
      {feedback && (
        <p className="mt-2 text-[11px] text-emerald-300">{feedback}</p>
      )}
    </div>
  );
}

