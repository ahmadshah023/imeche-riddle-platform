"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles } from "lucide-react";
import type { Riddle } from "@/lib/riddles";
import { isAnswerCorrect } from "@/lib/answerUtils";
import { db } from "@/lib/firebase";
import {
  doc,
  getDoc,
  setDoc,
  type DocumentData,
} from "firebase/firestore";
import type { AppUser } from "@/components/AuthProvider";

type Props = {
  open: boolean;
  riddle: Riddle | null;
  user: AppUser;
  onClose: () => void;
  onLevelCompleted: () => void;
};

type ProgressDoc = {
  teamId: string;
  levels: Record<
    string,
    {
      highestPartIndex: number;
      completed: boolean;
    }
  >;
};

export function RiddleModal({
  open,
  riddle,
  user,
  onClose,
  onLevelCompleted,
}: Props) {
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [currentPartIndex, setCurrentPartIndex] = useState(0);

  const activePart = useMemo(
    () => (riddle ? riddle.parts[currentPartIndex] : null),
    [riddle, currentPartIndex],
  );

  useEffect(() => {
    if (!open || !riddle || !user.teamId) return;

    async function loadProgress() {
      const ref = doc(db, "teamProgress", user.teamId!);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        setCurrentPartIndex(0);
        return;
      }
      const data = snap.data() as ProgressDoc;
      if (!riddle) return;
      const levelData = data.levels?.[riddle.id];
      if (!levelData) {
        setCurrentPartIndex(0);
      } else if (levelData.completed) {
        setCurrentPartIndex(riddle.parts.length - 1);
      } else {
        setCurrentPartIndex(levelData.highestPartIndex);
      }
    }

    loadProgress().catch(() => {});
  }, [open, riddle, user.teamId]);

  useEffect(() => {
    if (open) {
      setAnswer("");
      setFeedback(null);
    }
  }, [open, riddle, currentPartIndex]);

  if (!riddle || !user.teamId) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activePart || !answer.trim() || !user.teamId || !riddle) return;
    setSubmitting(true);
    setFeedback(null);

    const correct = isAnswerCorrect(answer, activePart.answer);

    if (!correct) {
      setFeedback("Almost there! Check your spelling or try a variant.");
      setSubmitting(false);
      return;
    }

    // Correct answer – update progress in Firestore
    try {
      const ref = doc(db, "teamProgress", user.teamId);
      const snap = await getDoc(ref);
      let data: ProgressDoc;
      if (!snap.exists()) {
        data = {
          teamId: user.teamId,
          levels: {},
        };
      } else {
        data = snap.data() as DocumentData as ProgressDoc;
      }

      const nextIndex = Math.min(
        currentPartIndex + 1,
        riddle.parts.length - 1,
      );
      const completed = nextIndex === riddle.parts.length;

      data.levels[riddle.id] = {
        highestPartIndex: nextIndex - 1,
        completed,
      };

      await setDoc(ref, data, { merge: true });

      // Play success sound if available
      try {
        const audio = new Audio("/sounds/success.mp3");
        audio.play().catch(() => {});
      } catch {
        // ignore
      }

      if (completed) {
        setFeedback("Level complete! Next level unlocked on the map.");
        onLevelCompleted();
      } else {
        setFeedback("Nice! Next part unlocked.");
        setCurrentPartIndex(nextIndex);
      }

      setAnswer("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="relative w-full max-w-xl rounded-3xl border border-emerald-400/30 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-6 shadow-2xl"
            initial={{ opacity: 0, scale: 0.9, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", stiffness: 150, damping: 18 }}
          >
            <button
              className="absolute right-4 top-4 rounded-full bg-slate-800/80 p-1.5 text-slate-300 hover:bg-slate-700"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-300">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-emerald-300">
                  Level {riddle.level}
                </p>
                <h2 className="text-lg font-semibold text-slate-50">
                  {riddle.title}
                </h2>
              </div>
            </div>

            <p className="mt-2 text-xs text-slate-400">{riddle.description}</p>

            {activePart && (
              <div className="mt-5 rounded-2xl bg-slate-900/80 p-4">
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  Part {currentPartIndex + 1} of {riddle.parts.length}
                </p>
                <p className="mt-2 text-sm text-slate-50">
                  {activePart.prompt}
                </p>
                {activePart.hint && (
                  <p className="mt-2 text-xs text-emerald-300/90">
                    Hint: {activePart.hint}
                  </p>
                )}

                <form onSubmit={handleSubmit} className="mt-4 space-y-3">
                  <input
                    type="text"
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder="Type your answer..."
                    className="w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={submitting || !answer.trim()}
                    className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-950 shadow-md shadow-emerald-500/40 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700"
                  >
                    {submitting ? "Checking..." : "Submit answer"}
                  </button>
                </form>

                {feedback && (
                  <p className="mt-3 text-xs text-emerald-300">{feedback}</p>
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

