"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  BarChart3,
  Users,
  LogOut,
  Megaphone,
  Mail,
  ListChecks,
  Activity,
  ScrollText,
  Play,
  Pause,
  Square,
  Clock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { signOut, db, serverTimestamp } from "@/lib/firebase";
import {
  collection,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  where,
  doc,
  updateDoc,
  addDoc,
  type DocumentData,
} from "firebase/firestore";
import { RIDDLES } from "@/lib/riddles";
import { convertCustomRiddlesToRiddles } from "@/lib/riddleHelpers";
import type {
  Competition,
  CompetitionTeam,
  TeamProgress,
} from "@/lib/competitionTypes";

type TeamRow = {
  id: string;
  name: string;
  members: number;
  currentLevel: string;
  competitionName?: string;
};

type QueryRow = {
  id: string;
  teamId?: string;
  teamName?: string;
  userName?: string;
  message: string;
  status: string;
};

type StandingRow = {
  teamId: string;
  teamName: string;
  competitionName: string;
  riddleLabel: string;
  scoreKey: string;
};

type LogRow = {
  id: string;
  competitionName: string;
  teamName: string;
  riddleLabel: string;
  timeLabel: string;
  completedAt: string;
};

export default function AdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<
    "competitions" | "teams" | "standings" | "logs" | "queries"
  >("competitions");

  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<string | null>(
    null,
  );
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [queries, setQueries] = useState<QueryRow[]>([]);
  const [broadcast, setBroadcast] = useState("");
  const [replyMessage, setReplyMessage] = useState("");
  const [replyTarget, setReplyTarget] = useState<QueryRow | null>(null);
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newCompetitionName, setNewCompetitionName] = useState("");
  const [newCompetitionPassword, setNewCompetitionPassword] = useState("");
  const [newCompetitionDuration, setNewCompetitionDuration] = useState(180);
  const [creatingCompetition, setCreatingCompetition] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [extendingCompetitionId, setExtendingCompetitionId] = useState<
    string | null
  >(null);
  const [extendMinutes, setExtendMinutes] = useState(10);
  
  // Custom riddles for competition creation
  type CustomRiddlePart = {
    prompt: string;
    answer: string;
    hint: string;
  };
  type CustomRiddle = {
    title: string;
    description: string;
    parts: CustomRiddlePart[];
  };
  const [customRiddles, setCustomRiddles] = useState<CustomRiddle[]>([
    { title: "", description: "", parts: [{ prompt: "", answer: "", hint: "" }] },
  ]);

  useEffect(() => {
    if (!loading) {
      if (!user) router.replace("/login");
      else if (!user.isAdmin) router.replace("/dashboard");
    }
  }, [user, loading, router]);

  // Load competitions list
  useEffect(() => {
    if (!user?.isAdmin) return;
    const col = collection(db, "competitions");
    const q = query(col, orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const list: Competition[] = [];
      snap.forEach((d) => {
        const data = d.data() as DocumentData;
        list.push({
          id: d.id,
          name: data.name ?? "Untitled",
          password: data.password ?? "",
          status: data.status ?? "waiting",
          durationMinutes: data.durationMinutes ?? 180,
          startTime: data.startTime,
          extraMinutesTotal: data.extraMinutesTotal ?? 0,
          customRiddles: data.customRiddles,
          createdAt: data.createdAt ?? new Date().toISOString(),
        });
      });
      setCompetitions(list);
      if (!selectedCompetitionId && list.length > 0) {
        setSelectedCompetitionId(list[0]!.id);
      }
    });
    return () => unsub();
  }, [user?.isAdmin, selectedCompetitionId]);

  const selectedCompetition = useMemo(
    () => competitions.find((c) => c.id === selectedCompetitionId) ?? null,
    [competitions, selectedCompetitionId],
  );

  // Load teams and progress
  useEffect(() => {
    if (!user?.isAdmin) return;

    async function loadTeamsAndProgress() {
      const teamSnap = await getDocs(collection(db, "competitionTeams"));
      const teamDocs: CompetitionTeam[] = [];
      teamSnap.forEach((d) => {
        const data = d.data() as any;
        teamDocs.push({
          id: d.id,
          competitionId: data.competitionId,
          name: data.name ?? "Unnamed",
          password: data.password ?? "",
          captainUserId: data.captainUserId,
          members: data.members ?? [],
          createdAt: data.createdAt ?? new Date().toISOString(),
        });
      });

      const progressSnap = await getDocs(collection(db, "teamProgress"));
      const progressByTeam: Record<string, TeamProgress> = {};
      progressSnap.forEach((d) => {
        const data = d.data() as any;
        progressByTeam[d.id] = {
          id: d.id,
          competitionId: data.competitionId,
          teamId: data.teamId,
          riddleOrder: data.riddleOrder ?? [],
          currentRiddleIndex: data.currentRiddleIndex ?? 0,
          currentPartIndex: data.currentPartIndex ?? 0,
          completedParts: data.completedParts ?? {},
          wrongStreak: data.wrongStreak ?? 0,
          penaltyUntil: data.penaltyUntil,
          lastUpdatedAt: data.lastUpdatedAt ?? new Date().toISOString(),
        };
      });

      const teamsRows: TeamRow[] = teamDocs.map((t) => {
        const comp = competitions.find((c) => c.id === t.competitionId);
        const progress = progressByTeam[`${t.competitionId}_${t.id}`];
        let label = "Not started";
        if (progress && progress.riddleOrder.length > 0) {
          const rid = progress.riddleOrder[progress.currentRiddleIndex] ?? "";
          const competitionRiddles =
            comp?.customRiddles && comp.customRiddles.length > 0
              ? convertCustomRiddlesToRiddles(comp.customRiddles)
              : RIDDLES;
          const riddle = competitionRiddles.find((r) => r.id === rid);
          if (riddle) {
            label = `Riddle #${riddle.numericId} Part ${progress.currentPartIndex + 1}`;
          }
        }
        return {
          id: t.id,
          name: t.name,
          members: t.members?.length ?? 0,
          currentLevel: label,
          competitionName: comp?.name,
        };
      });

      setTeams(teamsRows);
    }

    loadTeamsAndProgress().catch(() => {});
  }, [user?.isAdmin, competitions]);

  // Real-time standings for selected competition
  useEffect(() => {
    if (!user?.isAdmin || !selectedCompetitionId) return;
    const progressQ = query(
      collection(db, "teamProgress"),
      where("competitionId", "==", selectedCompetitionId),
    );
    const unsub = onSnapshot(progressQ, (snap) => {
      const rows: StandingRow[] = [];
      const comp = competitions.find((c) => c.id === selectedCompetitionId);
      const competitionRiddles =
        comp?.customRiddles && comp.customRiddles.length > 0
          ? convertCustomRiddlesToRiddles(comp.customRiddles)
          : RIDDLES;
      
      snap.forEach((d) => {
        const data = d.data() as any;
        const team = teams.find(
          (t) => `${data.competitionId}_${t.id}` === d.id,
        );
        if (!team) return;
        const riddleId =
          data.riddleOrder?.[data.currentRiddleIndex ?? 0] ?? "";
        const riddle = competitionRiddles.find((r) => r.id === riddleId);
        let label = "Not started";
        let ridIndex = data.currentRiddleIndex ?? 0;
        let partIndex = data.currentPartIndex ?? 0;
        let tsNum = Number.MAX_SAFE_INTEGER;
        if (riddle) {
          const part = (data.currentPartIndex ?? 0) + 1;
          label = `Riddle #${riddle.numericId} Part ${part}`;
          const tsIso = data.lastUpdatedAt ?? new Date().toISOString();
          const parsed = new Date(tsIso).getTime();
          tsNum = Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
        }
        rows.push({
          teamId: team.id,
          teamName: team.name,
          competitionName: team.competitionName ?? "",
          riddleLabel: label,
          // store sort fields inside scoreKey for compatibility
          scoreKey: JSON.stringify({
            ridIndex,
            partIndex,
            tsNum,
          }),
        } as any);
      });
      // Sort by riddle index desc, part index desc, timestamp asc (earlier win)
      rows.sort((a, b) => {
        const as = JSON.parse(a.scoreKey) as {
          ridIndex: number;
          partIndex: number;
          tsNum: number;
        };
        const bs = JSON.parse(b.scoreKey) as {
          ridIndex: number;
          partIndex: number;
          tsNum: number;
        };
        if (as.ridIndex !== bs.ridIndex) return bs.ridIndex - as.ridIndex;
        if (as.partIndex !== bs.partIndex) return bs.partIndex - as.partIndex;
        return as.tsNum - bs.tsNum;
      });
      setStandings(rows);
    });
    return () => unsub();
  }, [user?.isAdmin, selectedCompetitionId, teams, competitions]);

  // Real-time logs for selected competition
  useEffect(() => {
    if (!user?.isAdmin || !selectedCompetitionId) return;
    const logsQ = query(
      collection(db, "competitionLogs"),
      where("competitionId", "==", selectedCompetitionId),
    );
    const unsub = onSnapshot(logsQ, (snap) => {
      const list: LogRow[] = [];
      const comp = competitions.find((c) => c.id === selectedCompetitionId);
      const competitionRiddles =
        comp?.customRiddles && comp.customRiddles.length > 0
          ? convertCustomRiddlesToRiddles(comp.customRiddles)
          : RIDDLES;
      
      snap.forEach((d) => {
        const data = d.data() as any;
        const team = teams.find((t) => t.id === data.teamId);
        const riddle = competitionRiddles.find((r) => r.id === data.riddleId);
        const dt = new Date(data.completedAt ?? new Date().toISOString());
        const timeLabel = dt.toLocaleTimeString();
        list.push({
          id: d.id,
          competitionName: comp?.name ?? "",
          teamName: team?.name ?? data.teamId,
          riddleLabel: riddle
            ? `Riddle #${riddle.numericId} Part ${Number(data.partIndex) + 1}`
            : `Riddle ${data.riddleId} Part ${Number(data.partIndex) + 1}`,
          timeLabel,
          completedAt: data.completedAt ?? new Date().toISOString(),
        });
      });
      // Sort by completedAt descending (most recent first)
      list.sort((a, b) => (a.completedAt > b.completedAt ? -1 : 1));
      setLogs(list);
    });
    return () => unsub();
  }, [user?.isAdmin, selectedCompetitionId, competitions, teams]);

  // Player queries stream
  useEffect(() => {
    if (!user?.isAdmin) return;
    const q = query(
      collection(db, "queries"),
      orderBy("createdAt", "desc"),
    );
    const unsub = onSnapshot(q, (snap) => {
      const list: QueryRow[] = [];
      snap.forEach((d) => {
        const data = d.data() as any;
        list.push({
          id: d.id,
          teamId: data.teamId,
          teamName: data.teamName,
          userName: data.userName ?? data.userEmail,
          message: data.message,
          status: data.status ?? "open",
        });
      });
      setQueries(list);
    });
    return () => unsub();
  }, [user?.isAdmin]);

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  async function handleBroadcast(e: React.FormEvent) {
    e.preventDefault();
    if (!broadcast.trim() || !selectedCompetitionId) return;
    setSendingBroadcast(true);
    try {
      await addDoc(collection(db, "notifications"), {
        message: broadcast.trim(),
        type: "broadcast",
        competitionId: selectedCompetitionId,
        visibleTo: ["all"],
        createdAt: serverTimestamp(),
        fromAdmin: user?.email ?? "admin",
      });
      setBroadcast("");
    } finally {
      setSendingBroadcast(false);
    }
  }

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!replyTarget || !replyMessage.trim()) return;
    setSendingReply(true);
    try {
      // Ensure we use teamId (not teamName) for visibleTo
      const targetTeamId = replyTarget.teamId;
      if (!targetTeamId) {
        console.error("No teamId found for reply target");
        return;
      }
      
      await addDoc(collection(db, "notifications"), {
        message: replyMessage.trim(),
        type: "direct",
        teamId: targetTeamId,
        competitionId: selectedCompetitionId,
        visibleTo: [`team:${targetTeamId}`],
        createdAt: serverTimestamp(),
        fromAdmin: user?.email ?? "admin",
      });

      await updateDoc(doc(db, "queries", replyTarget.id), {
        status: "answered",
        answeredAt: serverTimestamp(),
      });

      setReplyMessage("");
      setReplyTarget(null);
    } finally {
      setSendingReply(false);
    }
  }

  async function handleCreateCompetition(e: React.FormEvent) {
    e.preventDefault();
    if (!newCompetitionName.trim() || !newCompetitionPassword.trim()) {
      setCreateError("Name and password are required.");
      return;
    }
    
    // Validate riddles: min 1, max 10, each must have title, description, and at least one part with prompt and answer
    const validRiddles = customRiddles.filter(
      (r) =>
        r.title.trim() &&
        r.description.trim() &&
        r.parts.some((p) => p.prompt.trim() && p.answer.trim())
    );
    
    if (validRiddles.length < 1) {
      setCreateError("At least 1 riddle is required (with title, description, and at least one part).");
      return;
    }
    
    if (validRiddles.length > 10) {
      setCreateError("Maximum 10 riddles allowed.");
      return;
    }
    
    // Clean up riddles: remove empty parts, ensure each riddle has valid parts
    const cleanedRiddles = validRiddles.map((r) => ({
      title: r.title.trim(),
      description: r.description.trim(),
      parts: r.parts
        .filter((p) => p.prompt.trim() && p.answer.trim())
        .map((p) => ({
          prompt: p.prompt.trim(),
          answer: p.answer.trim(),
          hint: p.hint.trim() || undefined,
        })),
    }));
    
    setCreatingCompetition(true);
    setCreateError(null);
    try {
      await addDoc(collection(db, "competitions"), {
        name: newCompetitionName.trim(),
        password: newCompetitionPassword.trim(),
        status: "waiting",
        durationMinutes: newCompetitionDuration,
        startTime: null,
        extraMinutesTotal: 0,
        customRiddles: cleanedRiddles,
        createdAt: serverTimestamp(),
      });
      setNewCompetitionName("");
      setNewCompetitionPassword("");
      setNewCompetitionDuration(180);
      setCustomRiddles([
        { title: "", description: "", parts: [{ prompt: "", answer: "", hint: "" }] },
      ]);
      setShowCreateForm(false);
    } catch (err: any) {
      setCreateError(err?.message ?? "Failed to create competition.");
    } finally {
      setCreatingCompetition(false);
    }
  }
  
  function addRiddle() {
    if (customRiddles.length >= 10) return;
    setCustomRiddles([
      ...customRiddles,
      { title: "", description: "", parts: [{ prompt: "", answer: "", hint: "" }] },
    ]);
  }
  
  function removeRiddle(index: number) {
    if (customRiddles.length <= 1) return;
    setCustomRiddles(customRiddles.filter((_, i) => i !== index));
  }
  
  function updateRiddle(index: number, field: keyof CustomRiddle, value: string) {
    const updated = [...customRiddles];
    updated[index] = { ...updated[index]!, [field]: value };
    setCustomRiddles(updated);
  }
  
  function addPart(riddleIndex: number) {
    if (customRiddles[riddleIndex]!.parts.length >= 3) return;
    const updated = [...customRiddles];
    updated[riddleIndex]!.parts.push({ prompt: "", answer: "", hint: "" });
    setCustomRiddles(updated);
  }
  
  function removePart(riddleIndex: number, partIndex: number) {
    const updated = [...customRiddles];
    if (updated[riddleIndex]!.parts.length <= 1) return;
    updated[riddleIndex]!.parts = updated[riddleIndex]!.parts.filter(
      (_, i) => i !== partIndex
    );
    setCustomRiddles(updated);
  }
  
  function updatePart(
    riddleIndex: number,
    partIndex: number,
    field: keyof CustomRiddlePart,
    value: string
  ) {
    const updated = [...customRiddles];
    updated[riddleIndex]!.parts[partIndex] = {
      ...updated[riddleIndex]!.parts[partIndex]!,
      [field]: value,
    };
    setCustomRiddles(updated);
  }

  async function handleStartCompetition(competitionId: string) {
    try {
      await updateDoc(doc(db, "competitions", competitionId), {
        status: "running",
        startTime: serverTimestamp(),
      });
    } catch (err: any) {
      console.error("Failed to start competition:", err);
    }
  }

  async function handlePauseCompetition(competitionId: string) {
    try {
      await updateDoc(doc(db, "competitions", competitionId), {
        status: "paused",
      });
    } catch (err: any) {
      console.error("Failed to pause competition:", err);
    }
  }

  async function handleResumeCompetition(competitionId: string) {
    try {
      await updateDoc(doc(db, "competitions", competitionId), {
        status: "running",
      });
    } catch (err: any) {
      console.error("Failed to resume competition:", err);
    }
  }

  async function handleEndCompetition(competitionId: string) {
    try {
      await updateDoc(doc(db, "competitions", competitionId), {
        status: "ended",
      });
    } catch (err: any) {
      console.error("Failed to end competition:", err);
    }
  }

  async function handleExtendCompetition(
    competitionId: string,
    extraMinutes: number,
  ) {
    try {
      const comp = competitions.find((c) => c.id === competitionId);
      if (!comp) return;
      const currentExtra = comp.extraMinutesTotal ?? 0;
      await updateDoc(doc(db, "competitions", competitionId), {
        extraMinutesTotal: currentExtra + extraMinutes,
      });
    } catch (err: any) {
      console.error("Failed to extend competition:", err);
    }
  }

  if (!user || !user.isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <p className="text-sm text-slate-300">Loading admin console...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-slate-50">
      <header className="flex items-center justify-between border-b border-slate-800/80 bg-slate-950/70 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-violet-500/20 text-violet-300">
            <BarChart3 className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-violet-300">
              Admin Console
            </p>
            <p className="text-xs text-slate-300">
              {user.email} • Live competition view
            </p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="inline-flex h-8 items-center justify-center rounded-full bg-slate-800/80 px-3 text-xs font-medium text-slate-100 hover:bg-slate-700"
        >
          <LogOut className="mr-1 h-3.5 w-3.5" />
          Logout
        </button>
      </header>

      <main className="flex flex-1 flex-col gap-4 px-3 pb-6 pt-3 md:px-6">
        {/* Competition selector and tabs */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-wide text-slate-400">
              Competition
            </span>
            <select
              value={selectedCompetitionId ?? ""}
              onChange={(e) =>
                setSelectedCompetitionId(e.target.value || null)
              }
              className="rounded-xl border border-slate-700 bg-slate-900/80 px-2 py-1 text-xs text-slate-100 focus:border-emerald-400 focus:outline-none"
            >
              {competitions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.status})
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-1 rounded-full border border-slate-800 bg-slate-950/80 p-1 text-[11px]">
            <button
              type="button"
              onClick={() => setActiveTab("competitions")}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ${
                activeTab === "competitions"
                  ? "bg-slate-800 text-slate-50"
                  : "text-slate-400"
              }`}
            >
              <ListChecks className="h-3 w-3" />
              Competitions
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("teams")}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ${
                activeTab === "teams"
                  ? "bg-slate-800 text-slate-50"
                  : "text-slate-400"
              }`}
            >
              <Users className="h-3 w-3" />
              Teams
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("standings")}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ${
                activeTab === "standings"
                  ? "bg-slate-800 text-slate-50"
                  : "text-slate-400"
              }`}
            >
              <Activity className="h-3 w-3" />
              Standings
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("logs")}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ${
                activeTab === "logs"
                  ? "bg-slate-800 text-slate-50"
                  : "text-slate-400"
              }`}
            >
              <ScrollText className="h-3 w-3" />
              Logs
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("queries")}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ${
                activeTab === "queries"
                  ? "bg-slate-800 text-slate-50"
                  : "text-slate-400"
              }`}
            >
              <Mail className="h-3 w-3" />
              Queries
            </button>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-4 md:flex-row">
          {/* Left side – main tab content */}
          <motion.section
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-1 flex-col gap-4"
          >
            {activeTab === "competitions" && (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ListChecks className="h-4 w-4 text-emerald-300" />
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-100">
                      Competitions
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(!showCreateForm)}
                    className="inline-flex items-center gap-1 rounded-xl bg-emerald-500/20 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/30 transition"
                  >
                    {showCreateForm ? (
                      <>
                        <span>Cancel</span>
                      </>
                    ) : (
                      <>
                        <span>+</span>
                        <span>Create Competition</span>
                      </>
                    )}
                  </button>
                </div>

                {showCreateForm && (
                  <motion.form
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    onSubmit={handleCreateCompetition}
                    className="mb-4 space-y-3 rounded-xl border border-emerald-500/30 bg-slate-900/50 p-4"
                  >
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-slate-300">
                        Competition Name
                      </label>
                      <input
                        type="text"
                        value={newCompetitionName}
                        onChange={(e) => setNewCompetitionName(e.target.value)}
                        placeholder="e.g., Spring 2024 Riddle Challenge"
                        className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-xs text-slate-50 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-slate-300">
                        Competition Password
                      </label>
                      <input
                        type="text"
                        value={newCompetitionPassword}
                        onChange={(e) =>
                          setNewCompetitionPassword(e.target.value)
                        }
                        placeholder="Enter password for participants"
                        className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-xs text-slate-50 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-slate-300">
                        Duration (minutes)
                      </label>
                      <input
                        type="number"
                        value={newCompetitionDuration}
                        onChange={(e) =>
                          setNewCompetitionDuration(
                            parseInt(e.target.value) || 180,
                          )
                        }
                        min="1"
                        max="1440"
                        className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-xs text-slate-50 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
                        required
                      />
                    </div>
                    
                    {/* Custom Riddles Builder */}
                    <div className="mt-4 space-y-3 border-t border-slate-700 pt-4">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-medium text-slate-300">
                          Custom Riddles ({customRiddles.length}/10)
                        </label>
                        <button
                          type="button"
                          onClick={addRiddle}
                          disabled={customRiddles.length >= 10}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/20 px-2 py-1 text-[11px] font-medium text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          + Add Riddle
                        </button>
                      </div>
                      <div className="max-h-[400px] space-y-3 overflow-y-auto pr-1">
                        {customRiddles.map((riddle, rIdx) => (
                          <div
                            key={rIdx}
                            className="rounded-xl border border-slate-700 bg-slate-950/70 p-3"
                          >
                            <div className="mb-2 flex items-center justify-between">
                              <span className="text-[11px] font-medium text-slate-300">
                                Riddle {rIdx + 1}
                              </span>
                              {customRiddles.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeRiddle(rIdx)}
                                  className="text-[10px] text-red-400 hover:text-red-300"
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                            <div className="space-y-2">
                              <input
                                type="text"
                                value={riddle.title}
                                onChange={(e) =>
                                  updateRiddle(rIdx, "title", e.target.value)
                                }
                                placeholder="Riddle title"
                                className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-2 py-1.5 text-xs text-slate-50 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
                              />
                              <textarea
                                value={riddle.description}
                                onChange={(e) =>
                                  updateRiddle(rIdx, "description", e.target.value)
                                }
                                placeholder="Riddle description"
                                className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-2 py-1.5 text-xs text-slate-50 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
                                rows={2}
                              />
                              <div className="space-y-2">
                                {riddle.parts.map((part, pIdx) => (
                                  <div
                                    key={pIdx}
                                    className="rounded-lg border border-slate-800 bg-slate-900/50 p-2"
                                  >
                                    <div className="mb-1 flex items-center justify-between">
                                      <span className="text-[10px] text-slate-400">
                                        Part {pIdx + 1}
                                      </span>
                                      {riddle.parts.length > 1 && (
                                        <button
                                          type="button"
                                          onClick={() => removePart(rIdx, pIdx)}
                                          className="text-[10px] text-red-400 hover:text-red-300"
                                        >
                                          Remove
                                        </button>
                                      )}
                                    </div>
                                    <textarea
                                      value={part.prompt}
                                      onChange={(e) =>
                                        updatePart(rIdx, pIdx, "prompt", e.target.value)
                                      }
                                      placeholder="Riddle prompt/question"
                                      className="mb-2 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-2 py-1.5 text-xs text-slate-50 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
                                      rows={2}
                                    />
                                    <input
                                      type="text"
                                      value={part.answer}
                                      onChange={(e) =>
                                        updatePart(rIdx, pIdx, "answer", e.target.value)
                                      }
                                      placeholder="Correct answer"
                                      className="mb-2 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-2 py-1.5 text-xs text-slate-50 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
                                    />
                                    <input
                                      type="text"
                                      value={part.hint}
                                      onChange={(e) =>
                                        updatePart(rIdx, pIdx, "hint", e.target.value)
                                      }
                                      placeholder="Hint (optional)"
                                      className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-2 py-1.5 text-xs text-slate-50 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
                                    />
                                  </div>
                                ))}
                                {riddle.parts.length < 3 && (
                                  <button
                                    type="button"
                                    onClick={() => addPart(rIdx)}
                                    className="w-full rounded-lg border border-dashed border-slate-600 bg-slate-900/30 px-2 py-1.5 text-[10px] text-slate-400 hover:border-slate-500 hover:text-slate-300"
                                  >
                                    + Add Part {riddle.parts.length + 1}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {createError && (
                      <p className="text-[11px] text-red-400">{createError}</p>
                    )}
                    <button
                      type="submit"
                      disabled={creatingCompetition}
                      className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-slate-950 shadow-md shadow-emerald-500/40 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700"
                    >
                      {creatingCompetition
                        ? "Creating..."
                        : "Create Competition"}
                    </button>
                  </motion.form>
                )}

                <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1 text-xs text-slate-200">
                  {competitions.map((c) => (
                    <div
                      key={c.id}
                      className={`rounded-xl border px-3 py-2 ${
                        c.id === selectedCompetitionId
                          ? "border-emerald-400/60 bg-slate-900"
                          : "border-slate-800 bg-slate-900/80"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-semibold">{c.name}</p>
                          <p className="text-[11px] text-slate-400">
                            Status:{" "}
                            <span
                              className={`font-medium ${
                                c.status === "running"
                                  ? "text-emerald-400"
                                  : c.status === "paused"
                                    ? "text-amber-400"
                                    : c.status === "ended"
                                      ? "text-red-400"
                                      : "text-slate-400"
                              }`}
                            >
                              {c.status}
                            </span>{" "}
                            • {c.durationMinutes} min
                            {c.extraMinutesTotal && c.extraMinutesTotal > 0 && (
                              <span className="text-amber-300">
                                {" "}
                                (+{c.extraMinutesTotal} extra)
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          {c.status === "waiting" && (
                            <button
                              type="button"
                              onClick={() => handleStartCompetition(c.id)}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/20 px-2 py-1 text-[11px] font-medium text-emerald-300 hover:bg-emerald-500/30 transition"
                              title="Start competition"
                            >
                              <Play className="h-3 w-3" />
                              Start
                            </button>
                          )}
                          {c.status === "running" && (
                            <>
                              <button
                                type="button"
                                onClick={() => handlePauseCompetition(c.id)}
                                className="inline-flex items-center gap-1 rounded-lg bg-amber-500/20 px-2 py-1 text-[11px] font-medium text-amber-300 hover:bg-amber-500/30 transition"
                                title="Pause competition"
                              >
                                <Pause className="h-3 w-3" />
                                Pause
                              </button>
                              <button
                                type="button"
                                onClick={() => handleEndCompetition(c.id)}
                                className="inline-flex items-center gap-1 rounded-lg bg-red-500/20 px-2 py-1 text-[11px] font-medium text-red-300 hover:bg-red-500/30 transition"
                                title="End competition"
                              >
                                <Square className="h-3 w-3" />
                                End
                              </button>
                            </>
                          )}
                          {c.status === "paused" && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleResumeCompetition(c.id)}
                                className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/20 px-2 py-1 text-[11px] font-medium text-emerald-300 hover:bg-emerald-500/30 transition"
                                title="Resume competition"
                              >
                                <Play className="h-3 w-3" />
                                Resume
                              </button>
                              <button
                                type="button"
                                onClick={() => handleEndCompetition(c.id)}
                                className="inline-flex items-center gap-1 rounded-lg bg-red-500/20 px-2 py-1 text-[11px] font-medium text-red-300 hover:bg-red-500/30 transition"
                                title="End competition"
                              >
                                <Square className="h-3 w-3" />
                                End
                              </button>
                            </>
                          )}
                          {(c.status === "running" || c.status === "paused") && (
                            <button
                              type="button"
                              onClick={() =>
                                setExtendingCompetitionId(
                                  extendingCompetitionId === c.id ? null : c.id,
                                )
                              }
                              className="inline-flex items-center gap-1 rounded-lg bg-sky-500/20 px-2 py-1 text-[11px] font-medium text-sky-300 hover:bg-sky-500/30 transition"
                              title="Extend competition time"
                            >
                              <Clock className="h-3 w-3" />
                              {extendingCompetitionId === c.id ? (
                                <ChevronUp className="h-3 w-3" />
                              ) : (
                                <ChevronDown className="h-3 w-3" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                      {extendingCompetitionId === c.id && (
                        <div className="mt-2 flex items-center gap-2 border-t border-slate-700 pt-2">
                          <input
                            type="number"
                            value={extendMinutes}
                            onChange={(e) =>
                              setExtendMinutes(
                                parseInt(e.target.value) || 10,
                              )
                            }
                            min="1"
                            max="60"
                            className="w-16 rounded-lg border border-slate-700 bg-slate-950/70 px-2 py-1 text-xs text-slate-50 focus:border-sky-400 focus:outline-none"
                            placeholder="10"
                          />
                          <span className="text-[11px] text-slate-400">
                            minutes
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              handleExtendCompetition(c.id, extendMinutes);
                              setExtendingCompetitionId(null);
                            }}
                            className="ml-auto inline-flex items-center gap-1 rounded-lg bg-sky-500 px-2 py-1 text-[11px] font-medium text-slate-950 hover:bg-sky-400 transition"
                          >
                            Add Time
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  {competitions.length === 0 && !showCreateForm && (
                    <p className="text-[11px] text-slate-400">
                      No competitions yet. Click "Create Competition" to get
                      started.
                    </p>
                  )}
                </div>
              </div>
            )}

            {activeTab === "teams" && (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Users className="h-4 w-4 text-emerald-300" />
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-100">
                    Teams & Progress
                  </h2>
                </div>
                <div className="max-h-[360px] overflow-y-auto">
                  <table className="min-w-full border-separate border-spacing-y-1 text-xs">
                    <thead className="text-[11px] uppercase tracking-wide text-slate-400">
                      <tr>
                        <th className="text-left">Team</th>
                        <th className="text-left">Competition</th>
                        <th className="text-center">Members</th>
                        <th className="text-center">Progress</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teams.map((t) => (
                        <tr key={t.id}>
                          <td className="rounded-l-xl bg-slate-900/80 px-2 py-1.5">
                            {t.name}
                          </td>
                          <td className="bg-slate-900/80 px-2 py-1.5">
                            {t.competitionName ?? "-"}
                          </td>
                          <td className="bg-slate-900/80 px-2 py-1.5 text-center">
                            {t.members}
                          </td>
                          <td className="rounded-r-xl bg-slate-900/80 px-2 py-1.5 text-center">
                            {t.currentLevel}
                          </td>
                        </tr>
                      ))}
                      {teams.length === 0 && (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-2 py-3 text-center text-[11px] text-slate-400"
                          >
                            No teams yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === "standings" && (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-sky-300" />
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-100">
                    Standings (by team)
                  </h2>
                </div>
                <div className="max-h-[360px] overflow-y-auto">
                  <table className="min-w-full border-separate border-spacing-y-1 text-xs">
                    <thead className="text-[11px] uppercase tracking-wide text-slate-400">
                      <tr>
                        <th className="text-left">Rank</th>
                        <th className="text-left">Team</th>
                        <th className="text-left">Progress</th>
                      </tr>
                    </thead>
                    <tbody>
                      {standings.map((s, idx) => (
                        <tr key={s.teamId}>
                          <td className="rounded-l-xl bg-slate-900/80 px-2 py-1.5">
                            #{idx + 1}
                          </td>
                          <td className="bg-slate-900/80 px-2 py-1.5">
                            {s.teamName}
                          </td>
                          <td className="rounded-r-xl bg-slate-900/80 px-2 py-1.5">
                            {s.riddleLabel}
                          </td>
                        </tr>
                      ))}
                      {standings.length === 0 && (
                        <tr>
                          <td
                            colSpan={3}
                            className="px-2 py-3 text-center text-[11px] text-slate-400"
                          >
                            No progress yet for this competition.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === "logs" && (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <ScrollText className="h-4 w-4 text-amber-300" />
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-100">
                    Completion Logs
                  </h2>
                </div>
                <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1 text-xs">
                  {logs.map((l) => (
                    <div
                      key={l.id}
                      className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3"
                    >
                      <p className="text-[11px] text-slate-300">
                        <span className="font-semibold">{l.teamName}</span>{" "}
                        completed{" "}
                        <span className="font-semibold">
                          {l.riddleLabel}
                        </span>{" "}
                        at {l.timeLabel}
                      </p>
                    </div>
                  ))}
                  {logs.length === 0 && (
                    <p className="text-[11px] text-slate-400">
                      No log entries yet for this competition.
                    </p>
                  )}
                </div>
              </div>
            )}
          </motion.section>

          {/* Right side – broadcast + queries */}
          <section className="mt-4 w-full max-w-md shrink-0 space-y-4 md:mt-0">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4"
            >
              <div className="mb-2 flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-amber-300" />
                <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-100">
                  Broadcast Message
                </h2>
              </div>
              <form onSubmit={handleBroadcast} className="space-y-2">
                <textarea
                  value={broadcast}
                  onChange={(e) => setBroadcast(e.target.value)}
                  placeholder="Send a hint, timing update, or urgent announcement to all teams in the selected competition..."
                  className="min-h-[70px] w-full resize-none rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-50 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={
                    sendingBroadcast || !broadcast.trim() || !selectedCompetition
                  }
                  className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-slate-950 shadow-md shadow-emerald-500/40 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700"
                >
                  {sendingBroadcast ? "Sending..." : "Send to competition"}
                </button>
              </form>
            </motion.div>

            {activeTab === "queries" && (
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4"
              >
                <div className="mb-2 flex items-center gap-2">
                  <Mail className="h-4 w-4 text-sky-300" />
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-100">
                    Player Queries
                  </h2>
                </div>
                <div className="max-h-[260px] space-y-2 overflow-y-auto pr-1 text-xs">
                  {queries.map((q) => (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => setReplyTarget(q)}
                      className="w-full rounded-2xl border border-slate-800 bg-slate-900/80 p-3 text-left hover:border-sky-400/50"
                    >
                      <p className="mb-1 text-[11px] font-medium text-slate-200">
                        {q.teamName ?? "Unknown team"} •{" "}
                        <span className="text-slate-400">{q.userName}</span>
                      </p>
                      <p className="line-clamp-2 text-[11px] text-slate-300">
                        {q.message}
                      </p>
                      <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-500">
                        Status: {q.status}
                      </p>
                    </button>
                  ))}
                  {queries.length === 0 && (
                    <p className="text-[11px] text-slate-400">
                      No player queries yet.
                    </p>
                  )}
                </div>

                {replyTarget && (
                  <form
                    onSubmit={handleReply}
                    className="mt-3 space-y-2 border-t border-slate-800 pt-3"
                  >
                    <p className="text-[11px] text-slate-300">
                      Replying to{" "}
                      <span className="font-semibold">
                        {replyTarget.teamName ?? "Unknown team"}
                      </span>{" "}
                      ({replyTarget.userName})
                    </p>
                    <textarea
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                      placeholder="Type a clear, competition-safe answer or hint..."
                      className="min-h-[70px] w-full resize-none rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-50 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setReplyTarget(null);
                          setReplyMessage("");
                        }}
                        className="inline-flex flex-1 items-center justify-center rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-[11px] font-medium text-slate-100 hover:bg-slate-800"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={sendingReply || !replyMessage.trim()}
                        className="inline-flex flex-1 items-center justify-center rounded-xl bg-sky-500 px-3 py-2 text-[11px] font-semibold text-slate-950 shadow-md shadow-sky-500/40 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700"
                      >
                        {sendingReply ? "Sending..." : "Send reply"}
                      </button>
                    </div>
                  </form>
                )}
              </motion.div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

