"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  LogOut,
  Users,
  Shield,
  User,
  Swords,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { signOut, db } from "@/lib/firebase";
import {
  collection,
  doc,
  onSnapshot,
  query,
  setDoc,
  where,
  type DocumentData,
} from "firebase/firestore";
import type {
  Competition,
  CompetitionTeam,
  CompetitionMembership,
} from "@/lib/competitionTypes";
import { buildRandomRiddleOrder } from "@/lib/riddleHelpers";
import { TeamDashboard } from "@/components/TeamDashboard";
import { NotificationsPanel } from "@/components/NotificationsPanel";

type CompetitionRouteParams = {
  competitionId: string;
};

export default function CompetitionPage() {
  const router = useRouter();
  const params = useParams() as CompetitionRouteParams;
  const { user, loading } = useAuth();

  const [competition, setCompetition] = useState<Competition | null>(null);
  const [teams, setTeams] = useState<CompetitionTeam[]>([]);
  const [membership, setMembership] = useState<CompetitionMembership | null>(
    null,
  );
  const [loadingMembership, setLoadingMembership] = useState(true);
  const [teamPasswordInput, setTeamPasswordInput] = useState("");
  const [teamNameInput, setTeamNameInput] = useState("");
  const [teamError, setTeamError] = useState<string | null>(null);
  const [joiningTeamId, setJoiningTeamId] = useState<string | null>(null);

  const isInTeam = !!membership?.teamId;
  const myTeam = useMemo(
    () => teams.find((t) => t.id === membership?.teamId),
    [teams, membership?.teamId],
  );

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    const compId = params.competitionId;
    if (!compId) return;

    // Subscribe to competition
    const compRef = doc(db, "competitions", compId);
    const unsubComp = onSnapshot(compRef, (snap) => {
      if (!snap.exists()) {
        setCompetition(null);
        return;
      }
      const data = snap.data() as DocumentData;
      setCompetition({
        id: snap.id,
        name: data.name ?? "Untitled Competition",
        password: data.password ?? "",
        status: data.status ?? "waiting",
        durationMinutes: data.durationMinutes ?? 180,
        startTime: data.startTime,
        extraMinutesTotal: data.extraMinutesTotal ?? 0,
        customRiddles: data.customRiddles,
        createdAt: data.createdAt ?? new Date().toISOString(),
      });
    });

    // Subscribe to teams for this competition
    const teamsCol = collection(db, "competitionTeams");
    const teamsQ = query(teamsCol, where("competitionId", "==", compId));
    const unsubTeams = onSnapshot(teamsQ, (snap) => {
      const list: CompetitionTeam[] = [];
      snap.forEach((d) => {
        const data = d.data() as any;
        list.push({
          id: d.id,
          competitionId: data.competitionId,
          name: data.name,
          password: data.password,
          captainUserId: data.captainUserId,
          members: data.members ?? [],
          createdAt: data.createdAt,
        });
      });
      setTeams(list);
    });

    // Subscribe to membership for this competition+user
    const membershipId = `${compId}_${user.uid}`;
    const membershipRef = doc(db, "competitionMemberships", membershipId);
    const unsubMembership = onSnapshot(membershipRef, (snap) => {
      if (!snap.exists()) {
        setMembership(null);
        setLoadingMembership(false);
        return;
      }
      const data = snap.data() as any;
      setMembership({
        id: snap.id,
        competitionId: data.competitionId,
        userId: data.userId,
        teamId: data.teamId,
        createdAt: data.createdAt ?? new Date().toISOString(),
      });
      setLoadingMembership(false);
    });

    return () => {
      unsubComp();
      unsubTeams();
      unsubMembership();
    };
  }, [user, params.competitionId]);

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  async function handleCreateTeam(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !competition) return;
    const name = teamNameInput.trim();
    const password = teamPasswordInput.trim();
    if (!name || !password) {
      setTeamError("Team name and password are required.");
      return;
    }
    try {
      setTeamError(null);
      const teamsCol = collection(db, "competitionTeams");
      const newTeamRef = doc(teamsCol); // auto ID
      const teamId = newTeamRef.id;

      await setDoc(newTeamRef, {
        competitionId: competition.id,
        name,
        password,
        captainUserId: user.uid,
        members: [
          {
            userId: user.uid,
            name: user.displayName || user.email || "Player",
          },
        ],
        createdAt: new Date().toISOString(),
      });

      // Initialize team progress with randomized riddle order
      const progressRef = doc(db, "teamProgress", `${competition.id}_${teamId}`);
      await setDoc(progressRef, {
        competitionId: competition.id,
        teamId,
        riddleOrder: buildRandomRiddleOrder(competition.customRiddles),
        currentRiddleIndex: 0,
        currentPartIndex: 0,
        completedParts: {},
        wrongStreak: 0,
        lastUpdatedAt: new Date().toISOString(),
      });

      // Update membership to attach to this team
      const membershipRef = doc(
        db,
        "competitionMemberships",
        `${competition.id}_${user.uid}`,
      );
      await setDoc(
        membershipRef,
        {
          competitionId: competition.id,
          userId: user.uid,
          teamId,
          createdAt: new Date().toISOString(),
        },
        { merge: true },
      );

      setTeamNameInput("");
      setTeamPasswordInput("");
    } catch (err: any) {
      setTeamError(err?.message ?? "Failed to create team.");
    }
  }

  async function handleJoinTeam(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !competition || !joiningTeamId) return;
    const password = teamPasswordInput.trim();
    const team = teams.find((t) => t.id === joiningTeamId);
    if (!team) {
      setTeamError("Team not found.");
      return;
    }
    if (password !== team.password) {
      setTeamError("Incorrect team password.");
      return;
    }

    try {
      setTeamError(null);
      const teamRef = doc(db, "competitionTeams", team.id);
      const updatedMembers = [
        ...(team.members ?? []),
        {
          userId: user.uid,
          name: user.displayName || user.email || "Player",
        },
      ];
      await setDoc(
        teamRef,
        {
          members: updatedMembers,
        },
        { merge: true },
      );

      const membershipRef = doc(
        db,
        "competitionMemberships",
        `${competition.id}_${user.uid}`,
      );
      await setDoc(
        membershipRef,
        {
          competitionId: competition.id,
          userId: user.uid,
          teamId: team.id,
        },
        { merge: true },
      );

      setJoiningTeamId(null);
      setTeamPasswordInput("");
    } catch (err: any) {
      setTeamError(err?.message ?? "Failed to join team.");
    }
  }

  if (!user || !competition) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <p className="text-sm text-slate-300">Loading competition...</p>
      </div>
    );
  }

  // Waiting state before membership is loaded
  if (loadingMembership) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <p className="text-sm text-slate-300">Loading your slot...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-slate-50">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 bg-slate-950/70 px-3 py-3 backdrop-blur">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-300">
            <Swords className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-300">
              {competition.name}
            </p>
            <p className="text-xs text-slate-300">
              Status: {competition.status} • {competition.durationMinutes} min
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {membership?.teamId && (
            <NotificationsPanel
              user={user}
              competitionId={competition.id}
              teamId={membership.teamId}
            />
          )}
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

      {!isInTeam ? (
        <main className="flex flex-1 flex-col gap-4 px-3 pb-8 pt-6 md:flex-row md:px-6">
          <motion.section
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-1 rounded-3xl border border-slate-800 bg-slate-950/80 p-5"
          >
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-sky-500/20 text-sky-300">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-50">
                  Pick a team
                </h2>
                <p className="text-[11px] text-slate-400">
                  Join an existing squad with its password, or create a new
                  team and become captain.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {teams.map((team, index) => {
                const isCaptain = team.captainUserId === user.uid;
                const colorClasses = [
                  "from-emerald-500/20 via-emerald-400/10 to-slate-900",
                  "from-sky-500/20 via-sky-400/10 to-slate-900",
                  "from-fuchsia-500/20 via-fuchsia-400/10 to-slate-900",
                  "from-amber-500/20 via-amber-400/10 to-slate-900",
                ];
                const bg = colorClasses[index % colorClasses.length];
                return (
                  <button
                    key={team.id}
                    type="button"
                    onClick={() => {
                      setJoiningTeamId(team.id);
                      setTeamPasswordInput("");
                      setTeamError(null);
                    }}
                    className={`group flex flex-col rounded-2xl border border-slate-800 bg-gradient-to-br ${bg} p-4 text-left shadow-md hover:border-emerald-400/60 hover:shadow-emerald-500/30`}
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-50">
                        {team.name}
                      </p>
                      {isCaptain && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-900/70 px-2 py-0.5 text-[10px] text-amber-300">
                          <Shield className="h-3 w-3" />
                          Captain
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-200">
                      Members: {team.members?.length ?? 0}
                    </p>
                    <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-400">
                      Tap to join with password
                    </p>
                  </button>
                );
              })}
              {teams.length === 0 && (
                <p className="text-xs text-slate-400">
                  No teams yet. Be the first to create one for this competition.
                </p>
              )}
            </div>

            {joiningTeamId && (
              <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/90 p-4">
                <p className="text-xs font-semibold text-slate-100">
                  Join team
                </p>
                <p className="mb-2 text-[11px] text-slate-400">
                  Ask the captain for the team password, then enter it below.
                </p>
                <form onSubmit={handleJoinTeam} className="space-y-2">
                  <input
                    type="password"
                    value={teamPasswordInput}
                    onChange={(e) => {
                      setTeamError(null);
                      setTeamPasswordInput(e.target.value);
                    }}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-50 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
                    placeholder="Team password"
                  />
                  {teamError && (
                    <p className="text-[11px] text-rose-400">{teamError}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setJoiningTeamId(null);
                        setTeamPasswordInput("");
                        setTeamError(null);
                      }}
                      className="inline-flex flex-1 items-center justify-center rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-[11px] font-medium text-slate-100 hover:bg-slate-800"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!teamPasswordInput.trim()}
                      className="inline-flex flex-1 items-center justify-center rounded-xl bg-emerald-500 px-3 py-2 text-[11px] font-semibold text-slate-950 shadow-md shadow-emerald-500/40 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700"
                    >
                      Join team
                    </button>
                  </div>
                </form>
              </div>
            )}
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 w-full max-w-md rounded-3xl border border-slate-800 bg-slate-950/85 p-5 md:mt-0"
          >
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-300">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-slate-50">
                  Create a new team
                </h3>
                <p className="text-[11px] text-slate-400">
                  You will become the captain. Share the team password only with
                  your teammates.
                </p>
              </div>
            </div>
            <form onSubmit={handleCreateTeam} className="space-y-2">
              <input
                type="text"
                value={teamNameInput}
                onChange={(e) => {
                  setTeamError(null);
                  setTeamNameInput(e.target.value);
                }}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-50 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
                placeholder="Team name"
              />
              <input
                type="password"
                value={teamPasswordInput}
                onChange={(e) => {
                  setTeamError(null);
                  setTeamPasswordInput(e.target.value);
                }}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-50 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
                placeholder="Team password"
              />
              {teamError && (
                <p className="text-[11px] text-rose-400">{teamError}</p>
              )}
              <button
                type="submit"
                disabled={!teamNameInput.trim() || !teamPasswordInput.trim()}
                className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-500 px-3 py-2 text-[11px] font-semibold text-slate-950 shadow-md shadow-emerald-500/40 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700"
              >
                Create team
              </button>
            </form>
          </motion.section>
        </main>
      ) : (
        <main className="flex flex-1 flex-col items-center px-3 pb-8 pt-6">
          {myTeam ? (
            <TeamDashboard
              competition={competition}
              team={myTeam}
              user={user}
            />
          ) : (
            <div className="w-full max-w-3xl rounded-3xl border border-slate-800 bg-slate-950/85 p-6 text-center">
              <p className="text-sm text-slate-300">
                You are assigned to a team, but it could not be loaded. Try refreshing.
              </p>
            </div>
          )}
        </main>
      )}
    </div>
  );
}

