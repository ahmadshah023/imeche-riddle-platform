// Shared types and helpers for competitions, teams, progress, standings and logs.

export type CompetitionStatus = "waiting" | "running" | "paused" | "ended";

export type CustomRiddlePart = {
  prompt: string;
  answer: string;
  hint?: string;
};

export type CustomRiddle = {
  title: string;
  description: string;
  parts: CustomRiddlePart[];
};

export type Competition = {
  id: string;
  name: string;
  password: string; // For simplicity stored as plain text; consider hashing for production.
  status: CompetitionStatus;
  durationMinutes: number; // base duration (e.g. 180)
  startTime?: string; // ISO
  extraMinutesTotal?: number; // additional minutes added by admin
  customRiddles?: CustomRiddle[]; // Custom riddles for this competition
  createdAt: string; // ISO
};

export type CompetitionMembership = {
  id: string;
  competitionId: string;
  userId: string;
  teamId?: string;
  createdAt: string;
};

export type CompetitionTeamMember = {
  userId: string;
  name: string;
};

export type CompetitionTeam = {
  id: string;
  competitionId: string;
  name: string;
  password: string; // Only captain should see this in UI.
  captainUserId: string;
  members: CompetitionTeamMember[];
  createdAt: string;
};

export type TeamProgressPartInfo = {
  completedAt?: string; // ISO timestamp
};

export type TeamProgress = {
  id: string;
  competitionId: string;
  teamId: string;
  riddleOrder: string[]; // randomized riddle IDs for this team
  currentRiddleIndex: number; // index into riddleOrder
  currentPartIndex: number; // index into parts array of current riddle
  completedParts: Record<string, Record<number, TeamProgressPartInfo>>;
  wrongStreak: number;
  penaltyUntil?: string; // ISO time until which team is locked from answering
  lastUpdatedAt: string;
};

export type CompetitionLogEntry = {
  id: string;
  competitionId: string;
  teamId: string;
  riddleId: string;
  partIndex: number;
  completedAt: string;
};

