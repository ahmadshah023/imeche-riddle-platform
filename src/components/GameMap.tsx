"use client";

import { motion } from "framer-motion";
import { Lock, Play } from "lucide-react";
import React from "react";
import type { Riddle } from "@/lib/riddles";

type Props = {
  riddles: Riddle[];
  unlockedLevel: number;
  onSelectRiddle: (riddle: Riddle) => void;
};

export function GameMap({ riddles, unlockedLevel, onSelectRiddle }: Props) {
  return (
    <div className="relative mx-auto flex h-full max-h-[700px] w-full max-w-2xl flex-col items-center overflow-y-auto py-8">
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 opacity-60" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-[120%] w-1 -translate-x-1/2 bg-gradient-to-b from-emerald-400/80 via-cyan-400/70 to-fuchsia-400/80 blur-[2px]" />

      <div className="relative z-10 flex w-full flex-col gap-10 px-6 pb-16">
        {riddles
          .sort((a, b) => a.level - b.level)
          .map((riddle, index) => {
            const isUnlocked = riddle.level <= unlockedLevel;
            const isNext = riddle.level === unlockedLevel;
            const side = index % 2 === 0 ? "left" : "right";

            return (
              <motion.button
                key={riddle.id}
                onClick={() => isUnlocked && onSelectRiddle(riddle)}
                disabled={!isUnlocked}
                initial={{ opacity: 0, y: 40, x: side === "left" ? -40 : 40 }}
                animate={{ opacity: 1, y: 0, x: 0 }}
                transition={{ delay: index * 0.08, type: "spring", stiffness: 120 }}
                className={`group relative flex ${
                  side === "left" ? "justify-start" : "justify-end"
                }`}
              >
                <div
                  className={`w-full max-w-[240px] rounded-3xl border p-4 text-left shadow-lg transition-all duration-300 ${
                    isUnlocked
                      ? "cursor-pointer border-emerald-400/60 bg-slate-900/80 hover:-translate-y-1 hover:border-emerald-300 hover:shadow-emerald-500/40"
                      : "cursor-not-allowed border-slate-700/80 bg-slate-900/60 opacity-60"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-11 w-11 items-center justify-center rounded-2xl border text-lg font-bold ${
                          isUnlocked
                            ? "border-emerald-400/80 bg-emerald-500/20 text-emerald-300"
                            : "border-slate-600 bg-slate-800 text-slate-400"
                        }`}
                      >
                        {riddle.level}
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-400">
                          Level {riddle.level}
                        </p>
                        <p className="text-sm font-semibold text-slate-50">
                          {riddle.title}
                        </p>
                      </div>
                    </div>
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-slate-300">
                      {isUnlocked ? (
                        <Play className="h-4 w-4" />
                      ) : (
                        <Lock className="h-4 w-4" />
                      )}
                    </div>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs text-slate-400">
                    {riddle.description}
                  </p>
                  {isNext && (
                    <p className="mt-3 text-[11px] font-medium uppercase tracking-wide text-emerald-300">
                      Next challenge unlocked
                    </p>
                  )}
                </div>
              </motion.button>
            );
          })}
      </div>
    </div>
  );
}

