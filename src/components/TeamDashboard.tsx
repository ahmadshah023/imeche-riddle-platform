"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Clock, Users, Trophy, X } from "lucide-react";
import { db } from "@/lib/firebase";
import {
  doc,
  onSnapshot,
  setDoc,
  addDoc,
  collection,
  query,
  where,
  deleteField,
  Timestamp,
} from "firebase/firestore";
import type {
  Competition,
  CompetitionTeam,
  TeamProgress,
} from "@/lib/competitionTypes";
import { RIDDLES } from "@/lib/riddles";
import { isAnswerCorrect } from "@/lib/answerUtils";
import type { AppUser } from "@/components/AuthProvider";
import { QueryForm } from "@/components/QueryForm";
import { GameMap } from "@/components/GameMap";
import type { Riddle } from "@/lib/riddles";
import { convertCustomRiddlesToRiddles } from "@/lib/riddleHelpers";

type Props = {
  competition: Competition;
  team: CompetitionTeam;
  user: AppUser;
};

export function TeamDashboard({ competition, team, user }: Props) {
  const [progress, setProgress] = useState<TeamProgress | null>(null);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [now, setNow] = useState<Date>(() => new Date());
  const [rankInfo, setRankInfo] = useState<{ rank: number; total: number } | null>(
    null,
  );
  const [viewMode, setViewMode] = useState<"riddle" | "map">("riddle");
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completionTime, setCompletionTime] = useState<number | null>(null);

  // Subscribe to team progress in real time
  useEffect(() => {
    const docId = `${competition.id}_${team.id}`;
    const ref = doc(db, "teamProgress", docId);

    const unsub = onSnapshot(ref, async (snap) => {
      if (!snap.exists()) {
        // If progress does not exist (e.g. team created before we added logic),
        // bootstrap it here with a full riddle order.
        const competitionRiddles =
          competition.customRiddles && competition.customRiddles.length > 0
            ? convertCustomRiddlesToRiddles(competition.customRiddles)
            : RIDDLES;
        const order = competitionRiddles.map((r) => r.id);
        const initial: TeamProgress = {
          id: docId,
          competitionId: competition.id,
          teamId: team.id,
          riddleOrder: order,
          currentRiddleIndex: 0,
          currentPartIndex: 0,
          completedParts: {},
          wrongStreak: 0,
          lastUpdatedAt: new Date().toISOString(),
        };
        await setDoc(ref, initial);
        setProgress(initial);
        return;
      }
      const data = snap.data() as any;
      setProgress({
        id: snap.id,
        competitionId: data.competitionId,
        teamId: data.teamId,
        riddleOrder: data.riddleOrder ?? (competition.customRiddles && competition.customRiddles.length > 0
          ? convertCustomRiddlesToRiddles(competition.customRiddles).map((r) => r.id)
          : RIDDLES.map((r) => r.id)),
        currentRiddleIndex: data.currentRiddleIndex ?? 0,
        currentPartIndex: data.currentPartIndex ?? 0,
        completedParts: data.completedParts ?? {},
        wrongStreak: data.wrongStreak ?? 0,
        penaltyUntil: data.penaltyUntil,
        lastUpdatedAt: data.lastUpdatedAt ?? new Date().toISOString(),
        completedAt: data.completedAt,
      });
    });

    return () => unsub();
  }, [competition.id, competition.customRiddles, team.id]);

  // Subscribe to standings for this competition and compute this team's rank
  useEffect(() => {
    const q = query(
      collection(db, "teamProgress"),
      where("competitionId", "==", competition.id),
    );
    const unsub = onSnapshot(q, (snap) => {
      const rows: { teamId: string; ridIndex: number; partIndex: number; ts: number }[] = [];
      const competitionRiddles =
        competition.customRiddles && competition.customRiddles.length > 0
          ? convertCustomRiddlesToRiddles(competition.customRiddles)
          : RIDDLES;
      
      snap.forEach((d) => {
        const data = d.data() as any;
        const riddleId =
          data.riddleOrder?.[data.currentRiddleIndex ?? 0] ?? "";
        const riddle = competitionRiddles.find((r) => r.id === riddleId);
        if (!riddle) return;
        const tsIso = data.lastUpdatedAt ?? new Date().toISOString();
        const tsNum = new Date(tsIso).getTime();
        rows.push({
          teamId: data.teamId,
          ridIndex: data.currentRiddleIndex ?? 0,
          partIndex: data.currentPartIndex ?? 0,
          ts: Number.isNaN(tsNum) ? Number.MAX_SAFE_INTEGER : tsNum,
        });
      });
      // Sort by riddle index (desc), part index (desc), then time (asc – earlier wins)
      rows.sort((a, b) => {
        if (a.ridIndex !== b.ridIndex) return b.ridIndex - a.ridIndex;
        if (a.partIndex !== b.partIndex) return b.partIndex - a.partIndex;
        return a.ts - b.ts;
      });
      const index = rows.findIndex((r) => r.teamId === team.id);
      if (index >= 0) {
        setRankInfo({ rank: index + 1, total: rows.length });
      } else {
        setRankInfo(null);
      }
    });
    return () => unsub();
  }, [competition.id, competition.customRiddles, team.id]);

  // Tick "now" every second for timers & penalties
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Get riddles for this competition (custom or static)
  const competitionRiddles = useMemo(() => {
    if (competition.customRiddles && competition.customRiddles.length > 0) {
      return convertCustomRiddlesToRiddles(competition.customRiddles);
    }
    return RIDDLES;
  }, [competition.customRiddles]);

  const { activeRiddle, activePart, isPenalty, penaltyRemaining, unlockedLevel, allRiddles } = useMemo(() => {
    if (!progress) {
      return {
        activeRiddle: null,
        activePart: null,
        isPenalty: false,
        penaltyRemaining: 0,
        unlockedLevel: 0,
        allRiddles: [] as Riddle[],
      };
    }
    const riddleId = progress.riddleOrder[progress.currentRiddleIndex];
    const activeRiddle = competitionRiddles.find((r) => r.id === riddleId) ?? null;
    const activePart =
      activeRiddle?.parts[progress.currentPartIndex] ?? null;

    let isPenalty = false;
    let penaltyRemaining = 0;
    if (progress.penaltyUntil) {
      const until = new Date(progress.penaltyUntil);
      const diff = until.getTime() - now.getTime();
      if (diff > 0) {
        isPenalty = true;
        penaltyRemaining = Math.ceil(diff / 1000);
      }
    }

    // Calculate unlocked level: current riddle index + 1 (since we're on it)
    const unlockedLevel = progress.currentRiddleIndex + 1;
    
    // Get all riddles in order
    const allRiddles = progress.riddleOrder
      .map((rid) => competitionRiddles.find((r) => r.id === rid))
      .filter((r): r is Riddle => r !== undefined)
      .map((r, idx) => ({ ...r, level: idx + 1 }));

    return { activeRiddle, activePart, isPenalty, penaltyRemaining, unlockedLevel, allRiddles };
  }, [progress, now, competitionRiddles]);

  // Compute competition countdown (basic; assumes running state)
  const competitionRemainingSeconds = useMemo(() => {
    if (!competition.startTime || competition.status !== "running") return 0;
    const baseDurationMs = (competition.durationMinutes ?? 180) * 60 * 1000;
    const extraMs = (competition.extraMinutesTotal ?? 0) * 60 * 1000;
    
    // Handle Firestore Timestamp objects or ISO strings
    let start: number;
    const startTime = competition.startTime as any;
    if (startTime instanceof Timestamp) {
      start = startTime.toMillis();
    } else if (typeof startTime === "string") {
      start = new Date(startTime).getTime();
    } else if (startTime?.toDate && typeof startTime.toDate === "function") {
      // Handle Timestamp-like objects with toDate method
      start = startTime.toDate().getTime();
    } else if (startTime?.seconds && typeof startTime.seconds === "number") {
      // Handle Timestamp-like objects with seconds property
      start = startTime.seconds * 1000;
    } else {
      return 0;
    }
    
    if (isNaN(start)) return 0;
    
    const end = start + baseDurationMs + extraMs;
    const diff = end - now.getTime();
    return Math.max(0, Math.floor(diff / 1000));
  }, [competition, now]);

  // When team progress document is marked as completed, show modal for all members
  useEffect(() => {
    if (!progress?.completedAt || !competition.startTime) return;

    const startTime = competition.startTime as any;
    let start: number;
    if (startTime instanceof Timestamp) {
      start = startTime.toMillis();
    } else if (typeof startTime === "string") {
      start = new Date(startTime).getTime();
    } else if (startTime?.toDate && typeof startTime.toDate === "function") {
      start = startTime.toDate().getTime();
    } else if (startTime?.seconds && typeof startTime.seconds === "number") {
      start = startTime.seconds * 1000;
    } else {
      return;
    }

    const completedAtMs = new Date(progress.completedAt).getTime();
    if (Number.isNaN(start) || Number.isNaN(completedAtMs)) return;

    const totalTimeSeconds = Math.max(
      0,
      Math.floor((completedAtMs - start) / 1000),
    );
    setCompletionTime(totalTimeSeconds);
    setShowCompletionModal(true);
  }, [progress?.completedAt, competition.startTime]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!progress || !activeRiddle || !activePart) return;
    if (!answer.trim()) return;

    setSubmitting(true);
    setFeedback(null);

    // Respect team penalty
    if (isPenalty) {
      setFeedback("Your team is under a penalty cooldown. Wait for the timer.");
      setSubmitting(false);
      return;
    }

    const correct = isAnswerCorrect(answer, activePart.answer);
    const docId = `${competition.id}_${team.id}`;
    const ref = doc(db, "teamProgress", docId);

    const updated: Partial<TeamProgress> & { lastUpdatedAt: string } = {
      lastUpdatedAt: new Date().toISOString(),
    };

    if (!correct) {
      const wrongStreak = (progress.wrongStreak ?? 0) + 1;
      updated.wrongStreak = wrongStreak;
      if (wrongStreak >= 3) {
        const penaltyUntil = new Date(Date.now() + 3 * 60 * 1000).toISOString();
        updated.penaltyUntil = penaltyUntil;
        updated.wrongStreak = 0;
        setFeedback("3 wrong attempts. Team locked for 3 minutes.");
      } else {
        setFeedback("Not quite. Think again, or adjust spelling.");
      }
      await setDoc(ref, updated, { merge: true });
      setSubmitting(false);
      return;
    }

    try {
      // Correct answer: reset wrong streak, advance part/riddle, log completion.
      const completedParts = { ...(progress.completedParts ?? {}) };
      const riddleEntry =
        completedParts[activeRiddle.id] ??
        (completedParts[activeRiddle.id] = {});
      riddleEntry[progress.currentPartIndex] = {
        completedAt: new Date().toISOString(),
      };

      // Determine next indices after this answer
      let nextRiddleIndex = progress.currentRiddleIndex;
      let nextPartIndex = progress.currentPartIndex + 1;

      const totalPartsForCurrent =
        activeRiddle.parts?.length ?? 0;
      const isLastPartOfCurrent =
        progress.currentPartIndex === totalPartsForCurrent - 1;

      if (isLastPartOfCurrent) {
        // Move to next riddle (or stay on last index)
        nextRiddleIndex = Math.min(
          progress.currentRiddleIndex + 1,
          progress.riddleOrder.length - 1,
        );
        nextPartIndex = 0;
      }

      updated.completedParts = completedParts;

      // Team has truly finished only when they just answered
      // the last part of the last riddle in their randomized order.
      const isOnFinalRiddle =
        progress.currentRiddleIndex === progress.riddleOrder.length - 1;
      const isAllComplete = isOnFinalRiddle && isLastPartOfCurrent;
      updated.currentRiddleIndex = nextRiddleIndex;
      updated.currentPartIndex = nextPartIndex;
      updated.wrongStreak = 0;
      // Remove penalty field if it exists (use deleteField to properly clear it)
      (updated as any).penaltyUntil = deleteField();

      // If all riddles completed, stamp completion time for whole team
      if (isAllComplete) {
        const completedAtIso = new Date().toISOString();
        (updated as any).completedAt = completedAtIso;
      }

      await setDoc(ref, updated, { merge: true });

      // Log entry for admin logs/standings
      await addDoc(collection(db, "competitionLogs"), {
        competitionId: competition.id,
        teamId: team.id,
        riddleId: activeRiddle.id,
        partIndex: progress.currentPartIndex,
        completedAt: new Date().toISOString(),
      });

      setFeedback(
        isAllComplete
          ? "Congratulations! You've completed all riddles!"
          : isLastPartOfCurrent
            ? "Riddle completed! Moving your team to the next challenge."
            : "Nice! Next part unlocked.",
      );
      setAnswer("");

      // Success sound (optional)
      try {
        const audio = new Audio("/sounds/success.mp3");
        audio.play().catch(() => {});
      } catch {
        // ignore
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!progress || !activeRiddle || !activePart) {
    return (
      <div className="w-full max-w-3xl rounded-3xl border border-slate-800 bg-slate-950/85 p-6 text-center">
        <p className="text-sm text-slate-300">
          Preparing your team&apos;s riddle path...
        </p>
      </div>
    );
  }

  const totalParts = activeRiddle.parts.length;

  function handleSelectRiddle(riddle: Riddle) {
    if (!progress) return;
    // Find the riddle in the team's order
    const riddleIndex = progress.riddleOrder.findIndex((rid) => rid === riddle.id);
    if (riddleIndex >= 0 && riddleIndex <= progress.currentRiddleIndex) {
      // Switch to riddle view and show this riddle
      setViewMode("riddle");
      // The active riddle will update based on currentRiddleIndex
    }
  }

  return (
    <div className="flex w-full max-w-6xl flex-col gap-4 px-2 md:px-0">
      {/* View Toggle */}
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-800 bg-slate-950/80 p-1">
        <button
          type="button"
          onClick={() => setViewMode("riddle")}
          className={`flex-1 rounded-xl px-4 py-2 text-xs font-medium transition ${
            viewMode === "riddle"
              ? "bg-emerald-500/20 text-emerald-300"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Current Riddle
        </button>
        <button
          type="button"
          onClick={() => setViewMode("map")}
          className={`flex-1 rounded-xl px-4 py-2 text-xs font-medium transition ${
            viewMode === "map"
              ? "bg-emerald-500/20 text-emerald-300"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Riddle Map
        </button>
      </div>

      <div className="flex w-full flex-col gap-4 md:flex-row">
        {viewMode === "map" ? (
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-1 rounded-3xl border border-slate-800 bg-slate-950/85 p-5"
          >
            <GameMap
              riddles={allRiddles}
              unlockedLevel={unlockedLevel}
              onSelectRiddle={handleSelectRiddle}
            />
          </motion.section>
        ) : (
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-1 rounded-3xl border border-slate-800 bg-slate-950/85 p-5"
          >
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-300">
              Riddle #{activeRiddle.numericId}
            </p>
            <h2 className="text-sm font-semibold text-slate-50">
              {activeRiddle.title}
            </h2>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <Clock className="h-3.5 w-3.5" />
            {competition.status === "ended" ? (
              <span>Competition ended</span>
            ) : competition.status === "waiting" ? (
              <span>Waiting for competition to start</span>
            ) : competition.status === "paused" ? (
              <span>Competition paused</span>
            ) : competition.status === "running" ? (
              competition.startTime ? (
                <span>
                  Time left:{" "}
                  {Math.floor(competitionRemainingSeconds / 60)}:
                  {String(competitionRemainingSeconds % 60).padStart(2, "0")}
                </span>
              ) : (
                <span>Competition running</span>
              )
            ) : (
              <span>Unknown status</span>
            )}
          </div>
          {rankInfo && (
            <div className="rounded-full bg-slate-900/80 px-3 py-1 text-[11px] text-emerald-300">
              Your rank: {rankInfo.rank} / {rankInfo.total}
            </div>
          )}
        </div>

        <p className="mb-2 text-[11px] text-slate-400">
          Part {progress.currentPartIndex + 1} of {totalParts}
        </p>
        <div className="rounded-2xl bg-slate-900/80 p-4">
          <p className="text-sm text-slate-50">{activePart.prompt}</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <input
            type="text"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            disabled={
              submitting ||
              isPenalty ||
              competition.status !== "running" ||
              competitionRemainingSeconds <= 0
            }
            placeholder={
              isPenalty
                ? "Team is under penalty..."
                : competition.status !== "running"
                  ? "Submissions are disabled until the competition is running..."
                  : "Type your team’s answer..."
            }
            className="w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3 py-2 text-base text-slate-50 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-800"
          />
          <button
            type="submit"
            disabled={
              submitting ||
              !answer.trim() ||
              isPenalty ||
              competition.status !== "running" ||
              competitionRemainingSeconds <= 0
            }
            className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-950 shadow-md shadow-emerald-500/40 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700"
          >
            {submitting
              ? "Checking answer..."
              : isPenalty
                ? "Penalty active"
                : "Submit team answer"}
          </button>
        </form>

        {feedback && (
          <p className="mt-3 text-xs text-emerald-300">{feedback}</p>
        )}

        {isPenalty && (
          <div className="mt-3 flex items-center gap-2 rounded-2xl border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            <AlertTriangle className="h-4 w-4" />
            <span>
              Team locked for{" "}
              {Math.floor(penaltyRemaining / 60)}:
              {String(penaltyRemaining % 60).padStart(2, "0")}
            </span>
          </div>
        )}
          </motion.section>
        )}

        <motion.aside
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm rounded-3xl border border-slate-800 bg-slate-950/85 p-5"
      >
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-slate-900 text-emerald-300">
            <Users className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-300">
              Team
            </p>
            <p className="text-sm font-semibold text-slate-50">
              {team.name}
            </p>
          </div>
        </div>
        <p className="mb-2 text-[11px] text-slate-400">
          Captain:{" "}
          <span className="font-medium text-slate-100">
            {team.members.find((m) => m.userId === team.captainUserId)?.name ??
              "Unknown"}
          </span>
        </p>
        <div className="rounded-2xl bg-slate-900/70 p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Members
          </p>
          <ul className="space-y-1.5 text-xs text-slate-100">
            {team.members.map((m) => (
              <li
                key={m.userId}
                className="flex items-center justify-between gap-2 rounded-xl bg-slate-900/80 px-2 py-1"
              >
                <span className="truncate">{m.name}</span>
                {m.userId === user.uid && (
                  <span className="text-[10px] text-emerald-300">You</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </motion.aside>
      </div>

      {/* Query Form */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full"
      >
        <QueryForm
          user={user}
          competitionId={competition.id}
          teamId={team.id}
          teamName={team.name}
        />
      </motion.div>

      {/* Completion Modal */}
      <AnimatePresence>
        {showCompletionModal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="relative w-full max-w-md rounded-3xl border border-emerald-500/50 bg-gradient-to-br from-slate-950 to-slate-900 p-8 shadow-2xl"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
            >
              <button
                className="absolute right-4 top-4 rounded-full bg-slate-800/80 p-1.5 text-slate-300 hover:bg-slate-700"
                onClick={() => setShowCompletionModal(false)}
              >
                <X className="h-4 w-4" />
              </button>
              
              <div className="flex flex-col items-center text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/50">
                  <Trophy className="h-8 w-8 text-slate-950" />
                </div>
                
                <h2 className="mb-2 text-2xl font-bold text-emerald-300">
                  Congratulations!
                </h2>
                <p className="mb-6 text-sm text-slate-300">
                  Your team has completed all riddles!
                </p>

                <div className="w-full space-y-3 rounded-2xl border border-slate-700 bg-slate-900/50 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Team Name</span>
                    <span className="text-sm font-semibold text-slate-100">
                      {team.name}
                    </span>
                  </div>

                  <div className="border-t border-slate-700 pt-3">
                    <span className="mb-2 block text-xs text-slate-400">Team Members</span>
                    <div className="space-y-1">
                      {team.members.map((member) => (
                        <div key={member.userId} className="text-sm text-slate-200">
                          {member.name}
                        </div>
                      ))}
                    </div>
                  </div>

                  {rankInfo && (
                    <div className="flex items-center justify-between border-t border-slate-700 pt-3">
                      <span className="text-xs text-slate-400">Your Rank</span>
                      <span className="text-lg font-bold text-emerald-300">
                        #{rankInfo.rank} / {rankInfo.total}
                      </span>
                    </div>
                  )}
                  
                  {completionTime !== null && (
                    <div className="flex items-center justify-between border-t border-slate-700 pt-3">
                      <span className="text-xs text-slate-400">Total Time</span>
                      <span className="text-lg font-bold text-emerald-300">
                        {Math.floor(completionTime / 60)}:
                        {String(completionTime % 60).padStart(2, "0")}
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-4 w-full rounded-xl border border-amber-400/50 bg-amber-500/10 p-3">
                  <p className="text-xs font-medium text-amber-200">
                    📸 Take a screenshot of this popup and send to admin for verification
                  </p>
                </div>

                <button
                  onClick={() => setShowCompletionModal(false)}
                  className="mt-6 w-full rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-md shadow-emerald-500/40 transition hover:bg-emerald-400"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

