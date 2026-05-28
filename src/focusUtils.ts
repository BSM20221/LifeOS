import type { FocusMode, FocusSession, FocusStats, FocusStatus, Task } from "./types";

export const focusModeDurations: Record<FocusMode, number> = {
  pomodoro: 25,
  "short-break": 5,
  "long-break": 15,
  custom: 25,
};

export function getFocusModeLabel(mode: FocusMode) {
  switch (mode) {
    case "pomodoro":
      return "Pomodoro";
    case "short-break":
      return "Short break";
    case "long-break":
      return "Long break";
    case "custom":
      return "Custom";
  }
}

export function formatTimerSeconds(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function calculateElapsedSeconds(session: FocusSession, now = new Date()) {
  const storedSeconds = Math.max(0, Math.round(Number(session.actualMinutes || 0) * 60));

  if (session.status !== "running") {
    return storedSeconds;
  }

  const startedAt = new Date(session.startedAt);
  if (Number.isNaN(startedAt.getTime())) {
    return storedSeconds;
  }

  return storedSeconds + Math.max(0, Math.floor((now.getTime() - startedAt.getTime()) / 1000));
}

export function calculateRemainingSeconds(session: FocusSession, now = new Date()) {
  return Math.max(0, session.plannedMinutes * 60 - calculateElapsedSeconds(session, now));
}

export function secondsToStoredMinutes(seconds: number) {
  return Math.round(Math.max(0, seconds) / 60 * 100) / 100;
}

export function getTodayFocusStats(sessions: FocusSession[], dateId: string): FocusStats {
  const completedSessions = sessions.filter((session) => session.dailyPlanDate === dateId && session.status === "completed");

  return completedSessions.reduce<FocusStats>(
    (stats, session) => {
      const roundedMinutes = Math.max(0, Math.round(Number(session.actualMinutes || 0)));
      stats.completedSessions += 1;
      stats.totalFocusedMinutes += roundedMinutes;

      if (session.projectId) {
        stats.minutesByProject[session.projectId] = (stats.minutesByProject[session.projectId] ?? 0) + roundedMinutes;
      }

      if (session.taskId) {
        stats.minutesByTask[session.taskId] = (stats.minutesByTask[session.taskId] ?? 0) + roundedMinutes;
      }

      return stats;
    },
    {
      completedSessions: 0,
      totalFocusedMinutes: 0,
      minutesByProject: {},
      minutesByTask: {},
    }
  );
}

export function createFocusSessionPayload({
  id,
  userId,
  task,
  dailyPlanDate,
  mode,
  plannedMinutes,
  notes,
  startedAt,
}: {
  id: string;
  userId: string;
  task: Task | null;
  dailyPlanDate: string;
  mode: FocusMode;
  plannedMinutes: number;
  notes: string;
  startedAt: string;
}) {
  return {
    id,
    userId,
    taskId: task?.id ?? null,
    projectId: task?.projectId ?? null,
    dailyPlanDate,
    mode,
    plannedMinutes,
    actualMinutes: 0,
    status: "running" as FocusStatus,
    startedAt,
    pausedAt: null,
    completedAt: null,
    cancelledAt: null,
    notes,
  };
}

export function isFocusMode(value: unknown): value is FocusMode {
  return value === "pomodoro" || value === "short-break" || value === "long-break" || value === "custom";
}

export function isFocusStatus(value: unknown): value is FocusStatus {
  return value === "running" || value === "paused" || value === "completed" || value === "cancelled";
}
