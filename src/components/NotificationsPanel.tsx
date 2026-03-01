"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, X } from "lucide-react";
import { db } from "@/lib/firebase";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  type DocumentData,
} from "firebase/firestore";
import type { AppUser } from "@/components/AuthProvider";

export type Notification = {
  id: string;
  message: string;
  createdAt?: { seconds: number; nanoseconds: number };
  type: "broadcast" | "direct";
  teamId?: string;
};

type Props = {
  user: AppUser;
  competitionId?: string;
  teamId?: string; // Team ID for this competition
};

export function NotificationsPanel({ user, competitionId, teamId }: Props) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    // Use teamId prop if provided, otherwise fall back to user.teamId
    const effectiveTeamId = teamId || user.teamId;
    if (!effectiveTeamId) return;

    const col = collection(db, "notifications");
    const q = query(
      col,
      where("visibleTo", "array-contains-any", [
        "all",
        `team:${effectiveTeamId}`,
        `user:${user.uid}`,
      ]),
    );

    const unsub = onSnapshot(q, (snap) => {
      const list: Notification[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data() as DocumentData;
        if (competitionId && data.competitionId !== competitionId) {
          return;
        }
        list.push({
          id: docSnap.id,
          message: data.message ?? "",
          createdAt: data.createdAt,
          type: data.type ?? "broadcast",
          teamId: data.teamId,
        });
      });
      // Sort newest first without requiring Firestore composite index.
      list.sort((a, b) => {
        const at = a.createdAt?.seconds ?? 0;
        const bt = b.createdAt?.seconds ?? 0;
        return bt - at;
      });
      setNotifications(list);
    });

    return () => unsub();
  }, [teamId, user.teamId, user.uid, competitionId]);

  const unreadCount = notifications.length;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative inline-flex h-9 items-center gap-2 rounded-full bg-slate-800/80 px-3 text-xs font-medium text-slate-100 shadow-sm hover:bg-slate-700"
      >
        <Bell className="h-4 w-4" />
        Notifications
        {unreadCount > 0 && (
          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-bold text-slate-950">
            {unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="relative w-full max-w-md rounded-3xl border border-slate-700 bg-slate-950/95 p-5 shadow-xl"
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 15, scale: 0.95 }}
            >
              <button
                className="absolute right-3 top-3 rounded-full bg-slate-800/80 p-1.5 text-slate-300 hover:bg-slate-700"
                onClick={() => setOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
              <div className="mb-3 flex items-center gap-2">
                <Bell className="h-4 w-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-slate-50">
                  Event Notifications
                </h3>
              </div>
              <div className="max-h-[320px] space-y-3 overflow-y-auto pr-1">
                {notifications.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    No messages yet. Keep an eye here for hints, updates, and
                    announcements from the admin team.
                  </p>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className="rounded-2xl border border-slate-700 bg-slate-900/80 p-3"
                    >
                      <p className="text-xs text-slate-100">{n.message}</p>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

