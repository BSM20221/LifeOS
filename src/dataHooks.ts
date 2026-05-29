import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "./firebase";
import type { DailyPlan, FavoriteQuote, FocusSession, Habit, HabitCompletion, HabitFrequency, Project, ProjectStats, SavedFilter, Task, WeeklyReview } from "./types";
import { isFilterCriteria, normalizeTags } from "./filterUtils";
import { getFriendlyError, isEnergyLevel, isProjectArea, isProjectStatus, isTaskPriority, isTaskStatus } from "./utils";
import { createEmptyDailyPlan, normalizeReflection, normalizeTimeBlock } from "./todayUtils";
import { isFocusMode, isFocusStatus } from "./focusUtils";
import { createEmptyWeeklyReview } from "./weeklyUtils";

export function useUserTasks(user: User) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");

    const taskQuery = query(collection(db, "users", user.uid, "tasks"), orderBy("createdAt", "desc"));
    return onSnapshot(
      taskQuery,
      (snapshot) => {
        setTasks(snapshot.docs.map(mapTaskDocument));
        setLoading(false);
      },
      (snapshotError) => {
        setError(getFriendlyError(snapshotError));
        setLoading(false);
      }
    );
  }, [user.uid]);

  return { tasks, loading, error };
}

export function useUserProjects(user: User) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");

    const projectQuery = query(collection(db, "users", user.uid, "projects"), orderBy("updatedAt", "desc"));
    return onSnapshot(
      projectQuery,
      (snapshot) => {
        setProjects(snapshot.docs.map(mapProjectDocument));
        setLoading(false);
      },
      (snapshotError) => {
        setError(getFriendlyError(snapshotError));
        setLoading(false);
      }
    );
  }, [user.uid]);

  return { projects, loading, error };
}

export function useUserSavedFilters(user: User) {
  const [filters, setFilters] = useState<SavedFilter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");

    const filterQuery = query(collection(db, "users", user.uid, "filters"), orderBy("updatedAt", "desc"));
    return onSnapshot(
      filterQuery,
      (snapshot) => {
        setFilters(snapshot.docs.map(mapSavedFilterDocument));
        setLoading(false);
      },
      (snapshotError) => {
        setError(getFriendlyError(snapshotError));
        setLoading(false);
      }
    );
  }, [user.uid]);

  return { filters, loading, error };
}

export function useDailyPlan(user: User, dateId: string) {
  const [plan, setPlan] = useState<DailyPlan>(() => createEmptyDailyPlan(user.uid, dateId));
  const [exists, setExists] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    setPlan(createEmptyDailyPlan(user.uid, dateId));

    return onSnapshot(
      doc(db, "users", user.uid, "dailyPlans", dateId),
      (snapshot) => {
        setExists(snapshot.exists());
        setPlan(snapshot.exists() ? mapDailyPlanDocument(snapshot.id, snapshot.data(), user.uid, dateId) : createEmptyDailyPlan(user.uid, dateId));
        setLoading(false);
      },
      (snapshotError) => {
        setError(getFriendlyError(snapshotError));
        setLoading(false);
      }
    );
  }, [dateId, user.uid]);

  return { plan, exists, loading, error };
}

export function useUserDailyPlans(user: User) {
  const [plans, setPlans] = useState<DailyPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");

    const planQuery = query(collection(db, "users", user.uid, "dailyPlans"), orderBy("date", "desc"));
    return onSnapshot(
      planQuery,
      (snapshot) => {
        setPlans(snapshot.docs.map((snapshot) => mapDailyPlanDocument(snapshot.id, snapshot.data(), user.uid, snapshot.id)));
        setLoading(false);
      },
      (snapshotError) => {
        setError(getFriendlyError(snapshotError));
        setLoading(false);
      }
    );
  }, [user.uid]);

  return { plans, loading, error };
}

export function useUserFocusSessions(user: User) {
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");

    const sessionQuery = query(collection(db, "users", user.uid, "focusSessions"), orderBy("createdAt", "desc"));
    return onSnapshot(
      sessionQuery,
      (snapshot) => {
        setSessions(snapshot.docs.map(mapFocusSessionDocument));
        setLoading(false);
      },
      (snapshotError) => {
        setError(getFriendlyError(snapshotError));
        setLoading(false);
      }
    );
  }, [user.uid]);

  return { sessions, loading, error };
}

export function useUserFavoriteQuotes(user: User) {
  const [favorites, setFavorites] = useState<FavoriteQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");

    const favoriteQuery = query(collection(db, "users", user.uid, "favoriteQuotes"), orderBy("createdAt", "desc"));
    return onSnapshot(
      favoriteQuery,
      (snapshot) => {
        setFavorites(snapshot.docs.map(mapFavoriteQuoteDocument));
        setLoading(false);
      },
      (snapshotError) => {
        setError(getFriendlyError(snapshotError));
        setLoading(false);
      }
    );
  }, [user.uid]);

  return { favorites, loading, error };
}

export function useUserHabits(user: User) {
  const [baseHabits, setBaseHabits] = useState<Habit[]>([]);
  const [completionsByHabit, setCompletionsByHabit] = useState<Record<string, HabitCompletion[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    let completionUnsubs: Array<() => void> = [];

    const habitQuery = query(collection(db, "users", user.uid, "habits"));
    const habitUnsub = onSnapshot(
      habitQuery,
      (snapshot) => {
        completionUnsubs.forEach((unsubscribe) => unsubscribe());
        completionUnsubs = [];
        const nextHabits = snapshot.docs.map(mapHabitDocument);
        setBaseHabits(nextHabits);
        setCompletionsByHabit({});

        nextHabits.forEach((habit) => {
          const completionQuery = query(collection(db, "users", user.uid, "habits", habit.id, "completions"));
          completionUnsubs.push(
            onSnapshot(
              completionQuery,
              (completionSnapshot) => {
                setCompletionsByHabit((current) => ({
                  ...current,
                  [habit.id]: completionSnapshot.docs.map(mapHabitCompletionDocument),
                }));
              },
              (completionError) => {
                setError(getFriendlyError(completionError));
              }
            )
          );
        });

        setLoading(false);
      },
      (snapshotError) => {
        setError(getFriendlyError(snapshotError));
        setLoading(false);
      }
    );

    return () => {
      habitUnsub();
      completionUnsubs.forEach((unsubscribe) => unsubscribe());
    };
  }, [user.uid]);

  const habits = baseHabits.map((habit) => {
    const completions = completionsByHabit[habit.id] ?? [];
    const completionDates = [...new Set([...habit.completionDates, ...completions.map((completion) => completion.date)])].sort();
    return {
      ...habit,
      completions,
      completionDates,
      streak: calculateHabitStreak(completionDates),
    };
  });

  return { habits, loading, error };
}

export function useWeeklyReview(user: User, weekId: string) {
  const [review, setReview] = useState<WeeklyReview>(() => createEmptyWeeklyReview(user.uid, weekId));
  const [exists, setExists] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    setReview(createEmptyWeeklyReview(user.uid, weekId));

    return onSnapshot(
      doc(db, "users", user.uid, "weeklyReviews", weekId),
      (snapshot) => {
        setExists(snapshot.exists());
        setReview(snapshot.exists() ? mapWeeklyReviewDocument(snapshot.id, snapshot.data(), user.uid, weekId) : createEmptyWeeklyReview(user.uid, weekId));
        setLoading(false);
      },
      (snapshotError) => {
        setError(getFriendlyError(snapshotError));
        setLoading(false);
      }
    );
  }, [user.uid, weekId]);

  return { review, exists, loading, error };
}

export function getProjectStats(projectId: string, tasks: Task[]): ProjectStats {
  const projectTasks = tasks.filter((task) => task.projectId === projectId && task.status !== "archived");
  const completedTasks = projectTasks.filter((task) => task.status === "done").length;
  const openTasks = projectTasks.filter((task) => task.status !== "done").length;
  const totalTasks = openTasks + completedTasks;

  return {
    openTasks,
    completedTasks,
    totalTasks,
    progress: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
  };
}

function mapTaskDocument(snapshot: QueryDocumentSnapshot<DocumentData>): Task {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    title: String(data.title ?? "Untitled task"),
    description: String(data.description ?? ""),
    status: isTaskStatus(data.status) ? data.status : "inbox",
    priority: isTaskPriority(data.priority) ? data.priority : "medium",
    dueDate: String(data.dueDate ?? ""),
    tags: Array.isArray(data.tags) ? normalizeTags(data.tags.map(String)) : [],
    estimatedMinutes: Number(data.estimatedMinutes ?? 25),
    energyLevel: isEnergyLevel(data.energyLevel) ? data.energyLevel : "medium",
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
    completedAt: data.completedAt ?? null,
    notes: String(data.notes ?? ""),
    userId: String(data.userId ?? ""),
    projectId: typeof data.projectId === "string" ? data.projectId : null,
    emoji: typeof data.emoji === "string" && data.emoji ? data.emoji : null,
    icon: typeof data.icon === "string" && data.icon ? data.icon : null,
    isDemoData: Boolean(data.isDemoData),
  };
}

function mapSavedFilterDocument(snapshot: QueryDocumentSnapshot<DocumentData>): SavedFilter {
  const data = snapshot.data();
  return {
    id: typeof data.id === "string" ? data.id : snapshot.id,
    userId: String(data.userId ?? ""),
    name: String(data.name ?? "Untitled view"),
    description: String(data.description ?? ""),
    query: isFilterCriteria(data.query) ? data.query : {},
    color: String(data.color ?? "#2a5f48"),
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
  };
}

function mapDailyPlanDocument(id: string, data: DocumentData | undefined, userId: string, dateId: string): DailyPlan {
  const planData = data ?? {};
  const timeBlocks = Array.isArray(planData.timeBlocks)
    ? planData.timeBlocks.map(normalizeTimeBlock).filter((block): block is NonNullable<typeof block> => Boolean(block))
    : [];

  return {
    id,
    userId: String(planData.userId ?? userId),
    date: String(planData.date ?? dateId),
    topTaskIds: Array.isArray(planData.topTaskIds) ? planData.topTaskIds.map(String).slice(0, 3) : [],
    deepWorkTaskId: typeof planData.deepWorkTaskId === "string" ? planData.deepWorkTaskId : null,
    timeBlocks,
    reflection: normalizeReflection(planData.reflection),
    createdAt: planData.createdAt ?? null,
    updatedAt: planData.updatedAt ?? null,
    isDemoData: Boolean(planData.isDemoData),
  };
}

function mapFocusSessionDocument(snapshot: QueryDocumentSnapshot<DocumentData>): FocusSession {
  const data = snapshot.data();
  return {
    id: typeof data.id === "string" ? data.id : snapshot.id,
    userId: String(data.userId ?? ""),
    taskId: typeof data.taskId === "string" ? data.taskId : null,
    projectId: typeof data.projectId === "string" ? data.projectId : null,
    dailyPlanDate: String(data.dailyPlanDate ?? ""),
    mode: isFocusMode(data.mode) ? data.mode : "pomodoro",
    plannedMinutes: Math.max(1, Number(data.plannedMinutes ?? 25)),
    actualMinutes: Math.max(0, Number(data.actualMinutes ?? 0)),
    status: isFocusStatus(data.status) ? data.status : "cancelled",
    startedAt: String(data.startedAt ?? ""),
    pausedAt: typeof data.pausedAt === "string" ? data.pausedAt : null,
    completedAt: typeof data.completedAt === "string" ? data.completedAt : null,
    cancelledAt: typeof data.cancelledAt === "string" ? data.cancelledAt : null,
    notes: String(data.notes ?? ""),
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
    isDemoData: Boolean(data.isDemoData),
  };
}

function mapProjectDocument(snapshot: QueryDocumentSnapshot<DocumentData>): Project {
  const data = snapshot.data();
  return {
    id: typeof data.id === "string" ? data.id : snapshot.id,
    userId: String(data.userId ?? ""),
    name: String(data.name ?? "Untitled project"),
    description: String(data.description ?? ""),
    color: String(data.color ?? "#2a5f48"),
    status: isProjectStatus(data.status) ? data.status : "active",
    area: isProjectArea(data.area) ? data.area : "Other",
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
    archivedAt: typeof data.archivedAt === "string" ? data.archivedAt : null,
    completedAt: typeof data.completedAt === "string" ? data.completedAt : null,
    emoji: typeof data.emoji === "string" && data.emoji ? data.emoji : null,
    icon: typeof data.icon === "string" && data.icon ? data.icon : null,
    isDemoData: Boolean(data.isDemoData),
  };
}

function mapHabitDocument(snapshot: QueryDocumentSnapshot<DocumentData>): Habit {
  const data = snapshot.data();
  const frequency = isHabitFrequency(data.frequency) ? data.frequency : "daily";
  return {
    id: typeof data.id === "string" ? data.id : snapshot.id,
    userId: String(data.userId ?? ""),
    name: String(data.name ?? data.title ?? "Untitled habit"),
    description: String(data.description ?? ""),
    emoji: typeof data.emoji === "string" && data.emoji ? data.emoji : null,
    color: String(data.color ?? "#10b981"),
    frequency,
    targetPerWeek: Math.max(1, Math.min(7, Number(data.targetPerWeek ?? (frequency === "weekly" ? 1 : 7)))),
    active: typeof data.active === "boolean" ? data.active : data.status !== "archived",
    archived: Boolean(data.archived) || data.status === "archived",
    archivedAt: typeof data.archivedAt === "string" ? data.archivedAt : null,
    completionDates: normalizeHabitCompletionDates(data),
    completions: [],
    streak: Math.max(0, Number(data.streak ?? data.currentStreak ?? 0)),
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
  };
}

function mapHabitCompletionDocument(snapshot: QueryDocumentSnapshot<DocumentData>): HabitCompletion {
  const data = snapshot.data();
  return {
    id: typeof data.id === "string" ? data.id : snapshot.id,
    habitId: String(data.habitId ?? ""),
    userId: String(data.userId ?? ""),
    date: String(data.date ?? snapshot.id),
    completedAt: data.completedAt ?? null,
    note: String(data.note ?? ""),
  };
}

function mapWeeklyReviewDocument(id: string, data: DocumentData | undefined, userId: string, weekId: string): WeeklyReview {
  const reviewData = data ?? {};
  const emptyReview = createEmptyWeeklyReview(userId, weekId);

  return {
    ...emptyReview,
    id: String(reviewData.id ?? id),
    userId: String(reviewData.userId ?? userId),
    weekId: String(reviewData.weekId ?? weekId),
    weekStartDate: String(reviewData.weekStartDate ?? emptyReview.weekStartDate),
    weekEndDate: String(reviewData.weekEndDate ?? emptyReview.weekEndDate),
    completedTaskIds: toStringArray(reviewData.completedTaskIds),
    reviewedProjectIds: toStringArray(reviewData.reviewedProjectIds),
    topWins: String(reviewData.topWins ?? ""),
    biggestStruggles: String(reviewData.biggestStruggles ?? ""),
    lessonsLearned: String(reviewData.lessonsLearned ?? ""),
    whatToStopDoing: String(reviewData.whatToStopDoing ?? ""),
    whatToContinueDoing: String(reviewData.whatToContinueDoing ?? ""),
    whatToStartDoing: String(reviewData.whatToStartDoing ?? ""),
    improveNextWeek: String(reviewData.whatToImproveNextWeek ?? reviewData.improveNextWeek ?? ""),
    whatToImproveNextWeek: String(reviewData.whatToImproveNextWeek ?? reviewData.improveNextWeek ?? ""),
    nextWeekPriorityTaskIds: toStringArray(reviewData.nextWeekPriorityTaskIds).slice(0, 5),
    nextWeekProjectIds: toStringArray(reviewData.nextWeekProjectIds).slice(0, 3),
    nextWeekNotes: String(reviewData.nextWeekNotes ?? ""),
    projectReviewActions: normalizeProjectReviewActions(reviewData.projectReviewStates ?? reviewData.projectReviewActions),
    projectReviewStates: normalizeProjectReviewStates(reviewData.projectReviewStates ?? reviewData.projectReviewActions),
    habitReflection: String(reviewData.habitReflection ?? ""),
    focusReflection: String(reviewData.focusReflection ?? ""),
    moodSummary: String(reviewData.moodSummary ?? ""),
    energySummary: String(reviewData.energySummary ?? ""),
    rating: typeof reviewData.rating === "number" ? reviewData.rating : null,
    createdAt: reviewData.createdAt ?? null,
    updatedAt: reviewData.updatedAt ?? null,
    completedAt: typeof reviewData.completedAt === "string" ? reviewData.completedAt : null,
  };
}

function mapFavoriteQuoteDocument(snapshot: QueryDocumentSnapshot<DocumentData>): FavoriteQuote {
  const data = snapshot.data();
  return {
    id: typeof data.id === "string" ? data.id : snapshot.id,
    userId: String(data.userId ?? ""),
    quoteId: String(data.quoteId ?? snapshot.id),
    createdAt: data.createdAt ?? null,
  };
}

function toStringArray(value: unknown) {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function normalizeProjectReviewActions(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, "continue" | "pause" | "cleanup">>((actions, [projectId, action]) => {
    if (action === "continue" || action === "pause" || action === "cleanup") {
      actions[projectId] = action;
    }
    return actions;
  }, {});
}

function normalizeProjectReviewStates(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, "continue" | "pause" | "cleanup" | null>>((actions, [projectId, action]) => {
    if (action === "continue" || action === "pause" || action === "cleanup" || action === null) {
      actions[projectId] = action;
    }
    return actions;
  }, {});
}

function normalizeHabitCompletionDates(data: DocumentData) {
  const directDates = [data.completionDates, data.completedDates, data.dates].find(Array.isArray);
  if (Array.isArray(directDates)) {
    return directDates.map(String).filter(isDateIdLike);
  }

  const record = [data.completions, data.entries, data.logs, data.checkIns].find((candidate) => candidate && typeof candidate === "object" && !Array.isArray(candidate));
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    return [];
  }

  return Object.entries(record as Record<string, unknown>)
    .filter(([, entry]) => entry === true || (entry !== null && typeof entry === "object" && "completed" in entry && Boolean((entry as { completed?: unknown }).completed)))
    .map(([dateId]) => dateId)
    .filter(isDateIdLike);
}

function isDateIdLike(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isHabitFrequency(value: unknown): value is HabitFrequency {
  return value === "daily" || value === "weekly" || value === "custom";
}

function calculateHabitStreak(completionDates: string[]) {
  const dates = new Set(completionDates);
  let streak = 0;
  let cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  while (dates.has(toDateId(cursor))) {
    streak += 1;
    cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000);
  }

  return streak;
}

function toDateId(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
