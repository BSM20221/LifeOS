import {
  BarChart3,
  CalendarClock,
  CalendarDays,
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock3,
  FolderKanban,
  Inbox,
  LayoutDashboard,
  ListFilter,
  LogOut,
  Plus,
  Settings,
  ShieldCheck,
  Sparkles,
  Timer,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { deleteUser, EmailAuthProvider, onAuthStateChanged, reauthenticateWithCredential, signOut, type User } from "firebase/auth";
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { auth, db } from "./firebase";
import { starterProjects } from "./constants";
import {
  getProjectStats,
  useDailyPlan,
  useUserDailyPlans,
  useUserFavoriteQuotes,
  useUserFocusSessions,
  useUserHabits,
  useUserProjects,
  useUserSavedFilters,
  useUserSettings,
  useUserTasks,
  useWeeklyReview,
} from "./dataHooks";
import { parseQuickCapture } from "./taskParser";
import type {
  DailyPlan,
  DailyReflection,
  ConfirmDialogState,
  FilterCriteria,
  FocusMode,
  FocusSession,
  Habit,
  HabitFormValues,
  AreaPerformance,
  Project,
  ProjectFormValues,
  ProjectPerformance,
  ProjectStats,
  SavedFilter,
  SavedFilterFormValues,
  Reminder,
  SnoozeOption,
  Task,
  TaskFormValues,
  TaskStatus,
  TimeBlock,
  TimeBlockFormValues,
  UserSettings,
  WeeklyReview,
} from "./types";
import { applyTaskFilters, cleanFilterCriteria, getTaskCountsByFilter, getTaskCountsByTag, getDueDateGroup, normalizeTags } from "./filterUtils";
import { formatProjectDate, getFriendlyError, getNowISOString, getTodayISODate } from "./utils";
import { calculateTodayStats, formatMinutes, getTodayDateId } from "./todayUtils";
import { calculateElapsedSeconds, createFocusSessionPayload, getStoredCompletedMinutes, getTodayFocusStats, secondsToStoredMinutes } from "./focusUtils";
import {
  generateInsightMessages,
  generatePerformanceRecommendations,
  getAreaPerformance,
  getCompletedTasksInRange,
  getDateRange,
  getFocusMinutesInRange,
  getProjectPerformance,
} from "./insightsUtils";
import { displayWithEmoji } from "./emojiPresets";
import { getDailyQuote, getRandomQuote } from "./quotes";
import { AuthScreen } from "./components/AuthScreen";
import { EmptyState, FullScreenState, MetricCard, StatusBanner } from "./components/Common";
import { FocusPage } from "./components/FocusComponents";
import { HabitForm, HabitsPage } from "./components/HabitComponents";
import { InsightsPage, InsightMessageList, RecommendationList } from "./components/InsightsComponents";
import { ConfirmDialog } from "./components/ModalComponents";
import { ProjectForm, ProjectsPage } from "./components/ProjectComponents";
import { DailyQuoteCard } from "./components/QuoteComponents";
import { SavedViewForm, SavedViewsPage } from "./components/SavedViewsComponents";
import { QuickCapture, TaskEditor, TaskSection } from "./components/TaskComponents";
import { TagList } from "./components/TaskBrowseComponents";
import { TodayPage } from "./components/TodayComponents";
import { WeeklyReviewPage } from "./components/WeeklyReviewComponents";
import { calculateWeeklyStats, getCompletedTasksForWeek, getCurrentWeekId, getWeekRange } from "./weeklyUtils";
import { ReminderCenter } from "./components/ReminderComponents";
import { calculateNextDueDate, getStatusForNextDueDate, isTaskOverdue, shouldStopRecurrence } from "./recurrenceUtils";
import { calculateReminderTime, dismissReminder, getDueReminders, markReminderFired, snoozeReminder } from "./reminderUtils";
import { SettingsPage } from "./components/settings/SettingsPage";
import { PrivacyPage, PublicLegalShell, TermsPage } from "./pages/LegalPages";
import {
  countBackupData,
  downloadBackup,
  prepareImportedDoc,
  serializeForBackup,
  toBackupArray,
  validateBackup,
  type ImportPreviewState,
  type LifeOSBackup,
} from "./utils/backupUtils";
import { getAppIconDataUrl, getDerivedThemeColors, getEffectiveAccentColor, getResolvedThemeMode } from "./themeUtils";

type PageId =
  | "dashboard"
  | "inbox"
  | "today"
  | "upcoming"
  | "projects"
  | "saved-views"
  | "focus"
  | "insights"
  | "habits"
  | "weekly-review"
  | "settings"
  | "privacy"
  | "terms";

type NavItem = {
  id: PageId;
  label: string;
  icon: LucideIcon;
};

type TaskEditorState = {
  task: Task | null;
  defaultStatus: TaskStatus;
  defaultProjectId: string | null;
};

type ProjectEditorState = {
  project: Project | null;
};

type SavedFilterEditorState = {
  filter: SavedFilter | null;
};

type HabitEditorState = {
  habit: Habit | null;
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const navItems: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "today", label: "Today", icon: CheckCircle2 },
  { id: "upcoming", label: "Upcoming", icon: CalendarClock },
  { id: "projects", label: "Projects", icon: FolderKanban },
  { id: "saved-views", label: "Saved Views", icon: ListFilter },
  { id: "focus", label: "Focus", icon: Timer },
  { id: "insights", label: "Insights", icon: BarChart3 },
  { id: "habits", label: "Habits", icon: Check },
  { id: "weekly-review", label: "Weekly Review", icon: CalendarDays },
  { id: "settings", label: "Settings", icon: Settings },
];

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [publicPage, setPublicPage] = useState<PageId>(() => getPageFromHash());

  useEffect(() => {
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthLoading(false);
    });
  }, []);

  useEffect(() => {
    const handleHashChange = () => setPublicPage(getPageFromHash());
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  if (authLoading) {
    return <FullScreenState title="Loading LifeOS" message="Checking your secure session." />;
  }

  if (!user) {
    if (publicPage === "privacy" || publicPage === "terms") {
      return <PublicLegalShell page={publicPage} />;
    }

    return <AuthScreen />;
  }

  return <ProtectedLifeOS user={user} />;
}

function ProtectedLifeOS({ user }: { user: User }) {
  const [activePage, setActivePage] = useState<PageId>(() => getPageFromHash());
  const [taskEditor, setTaskEditor] = useState<TaskEditorState | null>(null);
  const [projectEditor, setProjectEditor] = useState<ProjectEditorState | null>(null);
  const [savedFilterEditor, setSavedFilterEditor] = useState<SavedFilterEditorState | null>(null);
  const [habitEditor, setHabitEditor] = useState<HabitEditorState | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedSavedFilterId, setSelectedSavedFilterId] = useState<string | null>(null);
  const [selectedFocusTaskId, setSelectedFocusTaskId] = useState<string | null>(null);
  const [taskFilters, setTaskFilters] = useState<FilterCriteria>({});
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [quoteOffset, setQuoteOffset] = useState(0);
  const [creatingStarterProjects, setCreatingStarterProjects] = useState(false);
  const [selectedWeekId, setSelectedWeekId] = useState(() => getCurrentWeekId());
  const [weeklySaveState, setWeeklySaveState] = useState<{ status: "idle" | "saving" | "saved" | "error"; message: string }>({ status: "idle", message: "" });
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">(() =>
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported"
  );
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installStatus, setInstallStatus] = useState("");
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupStatus, setBackupStatus] = useState("");
  const [importPreview, setImportPreview] = useState<ImportPreviewState>({ fileName: "", backup: null, counts: null, error: "", status: "" });
  const [reminderNow, setReminderNow] = useState(() => new Date());
  const [actionError, setActionError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [todayDateId] = useState(() => getTodayDateId());

  const taskState = useUserTasks(user);
  const projectState = useUserProjects(user);
  const savedFilterState = useUserSavedFilters(user);
  const dailyPlanState = useDailyPlan(user, todayDateId);
  const dailyPlansState = useUserDailyPlans(user);
  const focusSessionState = useUserFocusSessions(user);
  const favoriteQuoteState = useUserFavoriteQuotes(user);
  const habitState = useUserHabits(user);
  const weeklyReviewState = useWeeklyReview(user, selectedWeekId);
  const settingsState = useUserSettings(user);
  const { tasks } = taskState;
  const { projects } = projectState;
  const { filters: savedFilters } = savedFilterState;
  const { sessions: focusSessions } = focusSessionState;
  const { favorites: favoriteQuotes } = favoriteQuoteState;
  const { habits } = habitState;
  const { plans: dailyPlans } = dailyPlansState;
  const weeklyReview = weeklyReviewState.review;
  const userSettings = settingsState.settings;
  const dailyPlan = dailyPlanState.plan;
  const dailyQuote = useMemo(() => getDailyQuote(todayDateId, quoteOffset), [quoteOffset, todayDateId]);

  useEffect(() => {
    const handleHashChange = () => setActivePage(getPageFromHash());
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    setWeeklySaveState({ status: "idle", message: "" });
  }, [selectedWeekId]);

  useEffect(() => {
    const timer = window.setInterval(() => setReminderNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
      setInstallStatus("LifeOS can be installed from this browser.");
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  useEffect(() => {
    const applyAppearance = () => {
      const resolvedMode = getResolvedThemeMode(userSettings.themeMode);
      const accent = getEffectiveAccentColor(userSettings);
      const colors = getDerivedThemeColors(accent);
      const root = document.documentElement;
      root.dataset.themeMode = resolvedMode;
      root.dataset.themePreference = userSettings.themeMode;
      root.style.setProperty("--color-primary", colors.primary);
      root.style.setProperty("--color-primary-strong", colors.primaryStrong);
      root.style.setProperty("--color-primary-soft", colors.primarySoft);
      root.style.setProperty("--lifeos-icon-url", `url("${getAppIconDataUrl(userSettings.appIcon, accent, resolvedMode)}")`);

      const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      if (favicon) {
        favicon.href = getAppIconDataUrl(userSettings.appIcon, accent, resolvedMode);
      }
    };

    applyAppearance();

    if (userSettings.themeMode !== "system" || !window.matchMedia) {
      return;
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", applyAppearance);
    return () => media.removeEventListener("change", applyAppearance);
  }, [userSettings]);

  useEffect(() => {
    void setDoc(
      doc(db, "users", user.uid),
      {
        email: user.email ?? "",
        displayName: user.displayName ?? "",
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }, [user]);

  const selectableProjects = useMemo(
    () => projects.filter((project) => project.status === "active" || project.status === "paused"),
    [projects]
  );
  const projectById = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);
  const statsByProject = useMemo(() => {
    return projects.reduce<Record<string, ProjectStats>>((stats, project) => {
      stats[project.id] = getProjectStats(project.id, tasks);
      return stats;
    }, {});
  }, [projects, tasks]);
  const tagCounts = useMemo(() => getTaskCountsByTag(tasks), [tasks]);
  const savedFilterOpenCounts = useMemo(() => getTaskCountsByFilter(tasks, savedFilters), [savedFilters, tasks]);

  const openTasks = tasks.filter((task) => !["done", "archived"].includes(task.status));
  const inboxTasks = openTasks.filter((task) => task.status === "inbox");
  const todayTasks = openTasks.filter((task) => task.status === "today" || task.dueDate === todayDateId);
  const upcomingTasks = openTasks.filter((task) => task.status === "upcoming" || (task.dueDate && task.dueDate > todayDateId));
  const doneTasks = tasks.filter((task) => task.status === "done");
  const highPriorityTasks = openTasks.filter((task) => task.priority === "high");
  const noProjectTasks = openTasks.filter((task) => !task.projectId);
  const overdueTasks = openTasks.filter((task) => isTaskOverdue(task));
  const activeHabits = habits.filter((habit) => habit.active && !habit.archived);
  const dueReminders = useMemo(() => getDueReminders(openTasks, reminderNow), [openTasks, reminderNow]);
  const todayCompletedFocusSessions = focusSessions.filter((session) => session.dailyPlanDate === todayDateId && session.status === "completed").length;
  const hasActiveFocusSession = focusSessions.some((session) => session.status === "running" || session.status === "paused");
  const incompleteHabitsToday = activeHabits.filter((habit) => !habit.completionDates.includes(todayDateId)).length;
  const navBadges = useMemo(
    () => ({
      inbox: inboxTasks.length,
      today: todayTasks.length,
      upcoming: upcomingTasks.length,
      projects: projects.filter((project) => project.status === "active" || project.status === "paused").length,
      "saved-views": savedFilters.length,
      focus: hasActiveFocusSession ? "live" : todayCompletedFocusSessions,
      habits: incompleteHabitsToday,
      "weekly-review": weeklyReview.completedAt ? "" : "!",
      insights: dueReminders.length,
    }),
    [
      hasActiveFocusSession,
      dueReminders.length,
      incompleteHabitsToday,
      inboxTasks.length,
      projects,
      savedFilters.length,
      todayCompletedFocusSessions,
      todayTasks.length,
      upcomingTasks.length,
      weeklyReview.completedAt,
    ]
  );

  useEffect(() => {
    if (notificationPermission !== "granted") {
      return;
    }

    dueReminders
      .filter(({ reminder }) => !reminder.firedAt)
      .forEach(({ task, reminder }) => {
        new Notification(`Reminder: ${displayWithEmoji(task.title, task.emoji)}`, {
          body: task.dueDate ? `Due ${task.dueDate}${task.dueTime ? ` at ${task.dueTime}` : ""}` : "Reminder due now",
        });
        void updateTaskReminder(task, markReminderFired(reminder));
      });
  }, [dueReminders, notificationPermission]);
  const todayStats = useMemo(() => calculateTodayStats(tasks, dailyPlan, todayDateId), [dailyPlan, tasks, todayDateId]);
  const todayFocusStats = useMemo(() => getTodayFocusStats(focusSessions, todayDateId, tasks), [focusSessions, tasks, todayDateId]);
  const dashboardRange = useMemo(
    () => getDateRange({ range: "7-days", todayDateId, tasks, sessions: focusSessions, dailyPlans }),
    [dailyPlans, focusSessions, tasks, todayDateId]
  );
  const dashboardRecommendations = useMemo(
    () =>
      generatePerformanceRecommendations({
        tasks,
        projects,
        sessions: focusSessions,
        dailyPlans: dailyPlans.length > 0 ? dailyPlans : [dailyPlan],
        dailyPlan,
        tagCounts,
        todayDateId,
        range: dashboardRange,
      }),
    [dailyPlan, dailyPlans, dashboardRange, focusSessions, projects, tagCounts, tasks, todayDateId]
  );
  const dashboardProjectPerformance = useMemo(
    () => getProjectPerformance(projects, tasks, focusSessions, dashboardRange, todayDateId),
    [dashboardRange, focusSessions, projects, tasks, todayDateId]
  );
  const dashboardAreaPerformance = useMemo(
    () => getAreaPerformance(tasks, projects, focusSessions, dashboardRange, todayDateId),
    [dashboardRange, focusSessions, projects, tasks, todayDateId]
  );
  const bestDashboardPerformance =
    [...dashboardProjectPerformance, ...dashboardAreaPerformance]
      .filter((item) => item.status === "Strong" || item.status === "Healthy")
      .sort((left, right) => right.score - left.score)[0] ?? null;
  const attentionDashboardPerformance =
    [...dashboardProjectPerformance, ...dashboardAreaPerformance].find(
      (item) => item.status === "Stuck" || item.status === "Neglected" || item.status === "Needs attention"
    ) ?? null;
  const weekFocusMinutes = useMemo(() => getFocusMinutesInRange(focusSessions, dashboardRange), [dashboardRange, focusSessions]);
  const weekCompletedTasks = useMemo(() => getCompletedTasksInRange(tasks, dashboardRange).length, [dashboardRange, tasks]);
  const currentWeekRange = useMemo(() => getWeekRange(getCurrentWeekId()), []);
  const weeklyDashboardStats = useMemo(
    () => calculateWeeklyStats({ tasks, projects, sessions: focusSessions, habits, range: currentWeekRange }),
    [currentWeekRange, focusSessions, habits, projects, tasks]
  );
  const insightMessages = useMemo(
    () =>
      generateInsightMessages({
        tasks,
        projects,
        sessions: focusSessions,
        dailyPlan,
        dailyPlans,
        tagCounts,
        todayDateId,
      }),
    [dailyPlan, dailyPlans, focusSessions, projects, tagCounts, tasks, todayDateId]
  );
  const isDailyQuoteFavorite = favoriteQuotes.some((favorite) => favorite.quoteId === dailyQuote.id);
  const completionRate = tasks.length > 0 ? Math.round((doneTasks.length / tasks.length) * 100) : 0;
  const nextTask = openTasks.find((task) => task.priority === "urgent" || task.priority === "high") ?? todayTasks[0] ?? openTasks[0] ?? null;
  const pageTitle = getPageLabel(activePage);
  const defaultCreateStatus: TaskStatus = activePage === "today" || activePage === "upcoming" || activePage === "inbox" ? activePage : "inbox";

  const visibleTasks = useMemo(() => {
    const baseTasks =
      activePage === "dashboard"
        ? tasks.filter((task) => task.status !== "archived")
        : activePage === "settings"
          ? tasks.filter((task) => task.status === "archived")
          : activePage === "projects" || activePage === "saved-views" || activePage === "focus" || activePage === "insights" || activePage === "habits" || activePage === "weekly-review"
            ? []
            : activePage === "today"
              ? tasks.filter((task) => task.status === "today" || task.dueDate === todayDateId)
              : activePage === "upcoming"
                ? tasks.filter((task) => task.status === "upcoming" || (task.dueDate && task.dueDate > todayDateId))
                : activePage === "inbox"
                  ? tasks.filter((task) => task.status === "inbox")
                  : [];

    return applyTaskFilters(baseTasks, taskFilters);
  }, [activePage, taskFilters, tasks, todayDateId]);

  async function createTaskFromQuick(rawInput: string, defaultStatus: TaskStatus) {
    assertOnline();
    const parsed = parseQuickCapture(rawInput, selectableProjects);
    if (!parsed.title) {
      throw new Error("Add a task title before saving.");
    }

    const taskRef = doc(collection(db, "users", user.uid, "tasks"));
    const dueDate = parsed.dueDate || (defaultStatus === "today" ? getTodayISODate() : "");
    const reminders = parsed.reminders.map((reminder) => ({ ...reminder, taskId: taskRef.id }));

    await setDoc(taskRef, {
      id: taskRef.id,
      title: parsed.title,
      description: "",
      status: defaultStatus,
      priority: parsed.priority,
      dueDate,
      dueTime: dueDate && parsed.dueTime ? parsed.dueTime : null,
      tags: parsed.tags,
      estimatedMinutes: 25,
      energyLevel: "medium",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      completedAt: null,
      notes: "",
      userId: user.uid,
      projectId: parsed.projectId,
      emoji: null,
      icon: null,
      repeatEnabled: parsed.repeatEnabled,
      repeatFrequency: parsed.repeatFrequency,
      repeatInterval: parsed.repeatInterval,
      repeatDaysOfWeek: parsed.repeatDaysOfWeek,
      repeatDayOfMonth: parsed.repeatDayOfMonth,
      repeatEndType: parsed.repeatEndType,
      repeatEndDate: parsed.repeatEndDate,
      repeatCount: parsed.repeatCount,
      completedOccurrences: 0,
      nextDueDate: parsed.repeatEnabled ? dueDate || null : null,
      lastGeneratedDate: null,
      recurringParentId: null,
      isRecurringInstance: false,
      reminders,
    });

    if (parsed.unresolvedProjectName) {
      setActionMessage(`Task saved. Project "${parsed.unresolvedProjectName}" was not found, so it was saved without a project.`);
    } else if (parsed.projectName) {
      setActionMessage(`Task saved to ${parsed.projectName}.`);
    } else {
      setActionMessage("Task saved.");
    }
  }

  async function saveTask(values: TaskFormValues, task: Task | null) {
    assertOnline();
    const payload = normalizeTaskForm(values);
    if (!payload.title) {
      throw new Error("Task title is required.");
    }

    const completedAt =
      payload.status === "done" ? (task?.status === "done" ? task.completedAt ?? serverTimestamp() : serverTimestamp()) : null;

    if (task) {
      await updateDoc(doc(db, "users", user.uid, "tasks", task.id), {
        ...payload,
        reminders: attachReminderTaskIds(payload.reminders, task.id),
        completedAt,
        updatedAt: serverTimestamp(),
        userId: user.uid,
      });
      setActionMessage("Task updated.");
    } else {
      const taskRef = doc(collection(db, "users", user.uid, "tasks"));
      await setDoc(taskRef, {
        ...payload,
        id: taskRef.id,
        reminders: attachReminderTaskIds(payload.reminders, taskRef.id),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        completedAt,
        userId: user.uid,
      });
      setActionMessage("Task created.");
    }

    setTaskEditor(null);
  }

  async function updateTask(task: Task, updates: Record<string, unknown>) {
    assertOnline();
    await updateDoc(doc(db, "users", user.uid, "tasks", task.id), {
      ...updates,
      updatedAt: serverTimestamp(),
      userId: user.uid,
    });
  }

  async function completeTask(task: Task) {
    if (!task.repeatEnabled || task.repeatFrequency === "none") {
      await updateTask(task, { status: "done", completedAt: serverTimestamp() });
      return;
    }

    const completedOccurrences = task.completedOccurrences + 1;
    const currentDueDate = task.dueDate || getTodayISODate();
    const nextDueDate = calculateNextDueDate(task, currentDueDate);
    const stopRepeating = shouldStopRecurrence(task, completedOccurrences, nextDueDate);

    if (stopRepeating) {
      await updateTask(task, {
        status: "done",
        completedAt: serverTimestamp(),
        completedOccurrences,
        lastGeneratedDate: currentDueDate,
        nextDueDate: null,
      });
      return;
    }

    await updateTask(task, {
      status: getStatusForNextDueDate(nextDueDate),
      dueDate: nextDueDate ?? "",
      completedAt: null,
      completedOccurrences,
      lastGeneratedDate: currentDueDate,
      nextDueDate,
      reminders: resetRemindersForNextOccurrence(task, nextDueDate),
    });
  }

  async function updateTaskReminder(task: Task, nextReminder: Reminder) {
    await updateTask(task, {
      reminders: task.reminders.map((reminder) => (reminder.id === nextReminder.id ? nextReminder : reminder)),
    });
  }

  function dismissTaskReminder(task: Task, reminder: Reminder) {
    void runAction(() => updateTaskReminder(task, dismissReminder(reminder)), "Reminder dismissed.");
  }

  function snoozeTaskReminder(task: Task, reminder: Reminder, option: SnoozeOption) {
    void runAction(() => updateTaskReminder(task, snoozeReminder(reminder, option)), "Reminder snoozed.");
  }

  async function requestReminderNotifications() {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotificationPermission("unsupported");
      setActionError("Browser notifications are not supported in this browser.");
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    setActionMessage(permission === "granted" ? "Reminder notifications enabled." : "Notifications are not enabled. In-app reminders still work.");
  }

  async function saveUserSettings(nextSettings: UserSettings) {
    try {
      assertOnline();
      setActionError("");
      setActionMessage("");
      await setDoc(
        doc(db, "users", user.uid, "settings", "main"),
        {
          id: "main",
          userId: user.uid,
          themeMode: nextSettings.themeMode,
          themePreset: nextSettings.themePreset,
          accentColor: nextSettings.accentColor,
          appIcon: nextSettings.appIcon,
          createdAt: nextSettings.createdAt ?? serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setActionMessage("Appearance saved.");
    } catch (error) {
      setActionError(getFriendlyError(error));
      throw error;
    }
  }

  function requestConfirmation(dialog: ConfirmDialogState) {
    setActionError("");
    setConfirmDialog(dialog);
  }

  async function handleConfirmDialog(password?: string) {
    if (!confirmDialog) {
      return;
    }

    setConfirmBusy(true);
    try {
      assertOnline();
      setActionError("");
      await confirmDialog.onConfirm(password);
      setConfirmDialog(null);
    } catch (error) {
      setActionError(getFriendlyError(error));
    } finally {
      setConfirmBusy(false);
    }
  }

  function closeConfirmDialog() {
    if (!confirmBusy) {
      setConfirmDialog(null);
    }
  }

  function deleteTask(task: Task) {
    requestConfirmation({
      title: "Delete task",
      description: `Delete "${displayWithEmoji(task.title, task.emoji)}"? This cannot be undone.`,
      confirmLabel: "Delete task",
      cancelLabel: "Cancel",
      variant: "destructive",
      onConfirm: () => runAction(() => deleteDoc(doc(db, "users", user.uid, "tasks", task.id)), "Task deleted."),
    });
  }

  async function saveDailyPlanPatch(updates: Partial<Pick<DailyPlan, "topTaskIds" | "deepWorkTaskId" | "timeBlocks" | "reflection">>) {
    assertOnline();
    await setDoc(
      doc(db, "users", user.uid, "dailyPlans", todayDateId),
      {
        id: todayDateId,
        userId: user.uid,
        date: todayDateId,
        ...updates,
        createdAt: dailyPlanState.exists ? dailyPlan.createdAt ?? serverTimestamp() : serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  function addTopTask(taskId: string) {
    if (dailyPlan.topTaskIds.includes(taskId)) {
      setActionMessage("That task is already in your Top 3.");
      return;
    }

    if (dailyPlan.topTaskIds.length >= 3) {
      setActionError("You can only choose up to 3 priorities for the day.");
      return;
    }

    void runAction(() => saveDailyPlanPatch({ topTaskIds: [...dailyPlan.topTaskIds, taskId].slice(0, 3) }), "Top 3 updated.");
  }

  function removeTopTask(taskId: string) {
    void runAction(() => saveDailyPlanPatch({ topTaskIds: dailyPlan.topTaskIds.filter((id) => id !== taskId) }), "Top 3 updated.");
  }

  function setDeepWorkTask(taskId: string) {
    void runAction(() => saveDailyPlanPatch({ deepWorkTaskId: taskId }), "Deep Work task saved.");
  }

  function clearDeepWorkTask() {
    void runAction(() => saveDailyPlanPatch({ deepWorkTaskId: null }), "Deep Work task cleared.");
  }

  async function saveTimeBlock(blockId: string | null, values: TimeBlockFormValues) {
    const assignedTask = values.taskId ? tasks.find((task) => task.id === values.taskId) ?? null : null;
    const nextBlock: TimeBlock = {
      id: blockId ?? createLocalId(),
      taskId: values.taskId || null,
      title: values.title.trim() || assignedTask?.title || "",
      startTime: values.startTime,
      endTime: values.endTime,
      type: values.type,
      notes: values.notes.trim(),
      completed: values.completed,
    };
    const nextBlocks = blockId
      ? dailyPlan.timeBlocks.map((block) => (block.id === blockId ? nextBlock : block))
      : [...dailyPlan.timeBlocks, nextBlock];
    await saveDailyPlanPatch({ timeBlocks: nextBlocks });
  }

  function deleteTimeBlock(block: TimeBlock) {
    requestConfirmation({
      title: "Delete time block",
      description: `Delete time block "${block.title || block.startTime}"?`,
      confirmLabel: "Delete block",
      cancelLabel: "Cancel",
      variant: "destructive",
      onConfirm: () => runAction(() => saveDailyPlanPatch({ timeBlocks: dailyPlan.timeBlocks.filter((item) => item.id !== block.id) }), "Time block deleted."),
    });
  }

  function toggleTimeBlock(block: TimeBlock) {
    void runAction(
      () => saveDailyPlanPatch({ timeBlocks: dailyPlan.timeBlocks.map((item) => (item.id === block.id ? { ...item, completed: !item.completed } : item)) }),
      block.completed ? "Time block reopened." : "Time block completed."
    );
  }

  function saveReflection(reflection: DailyReflection) {
    return saveDailyPlanPatch({ reflection });
  }

  function startFocusBlock(task: Task) {
    openFocusForTask(task);
  }

  function openFocusForTask(task: Task) {
    setSelectedFocusTaskId(task.id);
    window.location.hash = "focus";
    setActionMessage("Focus timer ready.");
  }

  async function startFocusSession(values: { taskId: string; mode: FocusMode; plannedMinutes: number; notes: string }) {
    assertOnline();
    const activeSession = focusSessions.find((session) => session.status === "running" || session.status === "paused");
    if (activeSession) {
      throw new Error("Finish, cancel, or complete the current focus session before starting another.");
    }

    const task = values.taskId ? tasks.find((candidateTask) => candidateTask.id === values.taskId) ?? null : null;
    const sessionRef = doc(collection(db, "users", user.uid, "focusSessions"));
    const startedAt = getNowISOString();
    await setDoc(sessionRef, {
      ...createFocusSessionPayload({
        id: sessionRef.id,
        userId: user.uid,
        task,
        dailyPlanDate: todayDateId,
        mode: values.mode,
        plannedMinutes: values.plannedMinutes,
        notes: values.notes,
        startedAt,
      }),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setSelectedFocusTaskId(task?.id ?? null);
    setActionMessage("Focus session started.");
  }

  function pauseFocusSession(session: FocusSession) {
    const elapsedSeconds = calculateElapsedSeconds(session);
    void runAction(
      () =>
        updateDoc(doc(db, "users", user.uid, "focusSessions", session.id), {
          status: "paused",
          actualMinutes: secondsToStoredMinutes(elapsedSeconds),
          pausedAt: getNowISOString(),
          updatedAt: serverTimestamp(),
          userId: user.uid,
        }),
      "Focus timer paused."
    );
  }

  function resumeFocusSession(session: FocusSession) {
    void runAction(
      () =>
        updateDoc(doc(db, "users", user.uid, "focusSessions", session.id), {
          status: "running",
          startedAt: getNowISOString(),
          pausedAt: null,
          updatedAt: serverTimestamp(),
          userId: user.uid,
        }),
      "Focus timer resumed."
    );
  }

  function cancelFocusSession(session: FocusSession) {
    requestConfirmation({
      title: "Cancel focus session",
      description: "Cancel this focus session? The elapsed time will be saved as cancelled.",
      confirmLabel: "Cancel session",
      cancelLabel: "Keep session",
      variant: "destructive",
      onConfirm: () => {
        const elapsedSeconds = calculateElapsedSeconds(session);
        return runAction(
          () =>
            updateDoc(doc(db, "users", user.uid, "focusSessions", session.id), {
              status: "cancelled",
              actualMinutes: secondsToStoredMinutes(elapsedSeconds),
              cancelledAt: getNowISOString(),
              updatedAt: serverTimestamp(),
              userId: user.uid,
            }),
          "Focus session cancelled."
        );
      },
    });
  }

  function completeFocusSession(session: FocusSession) {
    const elapsedSeconds = calculateElapsedSeconds(session);
    const task = session.taskId ? tasks.find((candidateTask) => candidateTask.id === session.taskId) ?? null : null;
    void runAction(
      () =>
        updateDoc(doc(db, "users", user.uid, "focusSessions", session.id), {
          status: "completed",
          plannedMinutes: Math.max(1, Number(session.plannedMinutes || 25)),
          actualMinutes: getStoredCompletedMinutes(session, elapsedSeconds),
          taskId: session.taskId ?? null,
          projectId: session.projectId ?? task?.projectId ?? null,
          dailyPlanDate: /^\d{4}-\d{2}-\d{2}$/.test(session.dailyPlanDate) ? session.dailyPlanDate : todayDateId,
          completedAt: getNowISOString(),
          updatedAt: serverTimestamp(),
          userId: user.uid,
        }),
      "Focus session complete."
    );
  }

  function deleteFocusSession(session: FocusSession) {
    requestConfirmation({
      title: "Delete focus session",
      description: "Delete this focus session? This cannot be undone.",
      confirmLabel: "Delete session",
      cancelLabel: "Cancel",
      variant: "destructive",
      onConfirm: () => runAction(() => deleteDoc(doc(db, "users", user.uid, "focusSessions", session.id)), "Focus session deleted."),
    });
  }

  async function saveFocusSessionNotes(session: FocusSession, notes: string) {
    assertOnline();
    await updateDoc(doc(db, "users", user.uid, "focusSessions", session.id), {
      notes: notes.trim(),
      updatedAt: serverTimestamp(),
      userId: user.uid,
    });
    setActionMessage("Focus notes saved.");
  }

  function markTaskDoneFromFocus(task: Task) {
    void runAction(() => completeTask(task), task.repeatEnabled ? "Recurring task advanced." : "Task marked done.");
  }

  async function saveProject(values: ProjectFormValues, project: Project | null) {
    assertOnline();
    const cleanName = values.name.trim();
    if (!cleanName) {
      throw new Error("Project name is required.");
    }

    const now = getNowISOString();
    const payload = {
      name: cleanName,
      description: values.description.trim(),
      color: values.color,
      status: values.status,
      area: values.area,
      archivedAt: values.status === "archived" ? project?.archivedAt ?? now : null,
      completedAt: values.status === "completed" ? project?.completedAt ?? now : null,
      emoji: values.emoji || null,
      icon: values.icon || null,
    };

    if (project) {
      await updateDoc(doc(db, "users", user.uid, "projects", project.id), {
        ...payload,
        id: project.id,
        userId: user.uid,
        updatedAt: serverTimestamp(),
      });
      setActionMessage("Project updated.");
    } else {
      const projectRef = doc(collection(db, "users", user.uid, "projects"));
      await setDoc(projectRef, {
        ...payload,
        id: projectRef.id,
        userId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setActionMessage("Project created.");
      setSelectedProjectId(projectRef.id);
      window.location.hash = "projects";
    }

    setProjectEditor(null);
  }

  async function createStarterProjects() {
    assertOnline();
    if (projects.length > 0) {
      setActionMessage("Starter projects are only offered when you have zero projects.");
      return;
    }

    setCreatingStarterProjects(true);
    await runAction(async () => {
      const batch = writeBatch(db);
      starterProjects.forEach((starterProject) => {
        const projectRef = doc(collection(db, "users", user.uid, "projects"));
        batch.set(projectRef, {
          id: projectRef.id,
          userId: user.uid,
          name: starterProject.name,
          description: starterProject.description,
          color: starterProject.color,
          status: "active",
          area: starterProject.area,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          archivedAt: null,
          completedAt: null,
          emoji: starterProject.emoji ?? null,
          icon: null,
        });
      });
      await batch.commit();
    }, "Starter projects created.");
    setCreatingStarterProjects(false);
  }

  async function updateProject(project: Project, updates: Record<string, unknown>) {
    assertOnline();
    await updateDoc(doc(db, "users", user.uid, "projects", project.id), {
      ...updates,
      id: project.id,
      userId: user.uid,
      updatedAt: serverTimestamp(),
    });
  }

  function deleteProject(project: Project) {
    requestConfirmation({
      title: "Delete project",
      description: `Permanently delete "${displayWithEmoji(project.name, project.emoji)}"? This will remove the project and unassign ${tasks.filter((task) => task.projectId === project.id).length} task(s). This cannot be undone.`,
      confirmLabel: "Delete project",
      cancelLabel: "Cancel",
      variant: "destructive",
      onConfirm: async () => {
        const assignedTasks = tasks.filter((task) => task.projectId === project.id);
        const batch = writeBatch(db);
        assignedTasks.forEach((task) => {
          batch.update(doc(db, "users", user.uid, "tasks", task.id), {
            projectId: null,
            updatedAt: serverTimestamp(),
            userId: user.uid,
          });
        });
        batch.delete(doc(db, "users", user.uid, "projects", project.id));
        await batch.commit();
        setSelectedProjectId(null);
        setActionMessage("Project deleted. Assigned tasks were unassigned.");
      },
    });
  }

  function toggleFavoriteQuote() {
    const quoteRef = doc(db, "users", user.uid, "favoriteQuotes", dailyQuote.id);
    if (isDailyQuoteFavorite) {
      void runAction(() => deleteDoc(quoteRef), "Quote removed from favorites.");
      return;
    }

    void runAction(
      () =>
        setDoc(quoteRef, {
          id: dailyQuote.id,
          userId: user.uid,
          quoteId: dailyQuote.id,
          createdAt: serverTimestamp(),
        }),
      "Quote saved to favorites."
    );
  }

  function refreshQuote() {
    const nextQuote = getRandomQuote(dailyQuote.id);
    const nextIndex = Math.max(0, nextQuote ? quoteOffset + 1 : quoteOffset + 1);
    setQuoteOffset(nextIndex);
  }

  async function saveSavedFilter(values: SavedFilterFormValues, filter: SavedFilter | null) {
    assertOnline();
    const cleanName = values.name.trim();
    if (!cleanName) {
      throw new Error("Saved view name is required.");
    }

    const payload = {
      name: cleanName,
      description: values.description.trim(),
      color: values.color || "#2a5f48",
      query: cleanFilterCriteria(values.query),
    };

    if (filter) {
      await updateDoc(doc(db, "users", user.uid, "filters", filter.id), {
        ...payload,
        id: filter.id,
        userId: user.uid,
        updatedAt: serverTimestamp(),
      });
      setActionMessage("Saved view updated.");
    } else {
      const filterRef = doc(collection(db, "users", user.uid, "filters"));
      await setDoc(filterRef, {
        ...payload,
        id: filterRef.id,
        userId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setSelectedSavedFilterId(filterRef.id);
      window.location.hash = "saved-views";
      setActionMessage("Saved view created.");
    }

    setSavedFilterEditor(null);
  }

  async function createSuggestedSavedFilter(values: SavedFilterFormValues) {
    if (savedFilters.some((filter) => filter.name.toLowerCase() === values.name.toLowerCase())) {
      setActionMessage(`"${values.name}" already exists.`);
      return;
    }

    await runAction(() => saveSavedFilter(values, null), "Suggested saved view created.");
  }

  function deleteSavedFilter(filter: SavedFilter) {
    requestConfirmation({
      title: "Delete saved view",
      description: `Delete saved view "${filter.name}"? This cannot be undone.`,
      confirmLabel: "Delete view",
      cancelLabel: "Cancel",
      variant: "destructive",
      onConfirm: async () => {
        await deleteDoc(doc(db, "users", user.uid, "filters", filter.id));
        if (selectedSavedFilterId === filter.id) {
          setSelectedSavedFilterId(null);
        }
        setActionMessage("Saved view deleted.");
      },
    });
  }

  async function saveHabit(values: HabitFormValues, habit: Habit | null) {
    assertOnline();
    const payload = normalizeHabitForm(values);
    if (!payload.name) {
      throw new Error("Habit name is required.");
    }

    if (habit) {
      await updateDoc(doc(db, "users", user.uid, "habits", habit.id), {
        ...payload,
        id: habit.id,
        userId: user.uid,
        archived: habit.archived,
        archivedAt: habit.archivedAt,
        updatedAt: serverTimestamp(),
      });
      setActionMessage("Habit updated.");
    } else {
      const habitRef = doc(collection(db, "users", user.uid, "habits"));
      await setDoc(habitRef, {
        ...payload,
        id: habitRef.id,
        userId: user.uid,
        archived: false,
        archivedAt: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setActionMessage("Habit created.");
      window.location.hash = "habits";
    }

    setHabitEditor(null);
  }

  async function completeHabitToday(habit: Habit) {
    await runAction(async () => {
      const completionRef = doc(db, "users", user.uid, "habits", habit.id, "completions", todayDateId);
      await setDoc(completionRef, {
        id: todayDateId,
        habitId: habit.id,
        userId: user.uid,
        date: todayDateId,
        completedAt: serverTimestamp(),
        note: "",
      });
      await updateDoc(doc(db, "users", user.uid, "habits", habit.id), {
        id: habit.id,
        userId: user.uid,
        updatedAt: serverTimestamp(),
      });
    }, "Habit marked done for today.");
  }

  async function undoHabitToday(habit: Habit) {
    await runAction(async () => {
      await deleteDoc(doc(db, "users", user.uid, "habits", habit.id, "completions", todayDateId));
      await updateDoc(doc(db, "users", user.uid, "habits", habit.id), {
        id: habit.id,
        userId: user.uid,
        updatedAt: serverTimestamp(),
      });
    }, "Habit completion removed for today.");
  }

  function archiveHabit(habit: Habit) {
    requestConfirmation({
      title: "Archive habit",
      description: `Archive "${displayWithEmoji(habit.name, habit.emoji)}"? It will move out of today's active habit list but keep its history.`,
      confirmLabel: "Archive habit",
      cancelLabel: "Cancel",
      variant: "destructive",
      onConfirm: async () => {
        await updateDoc(doc(db, "users", user.uid, "habits", habit.id), {
          id: habit.id,
          userId: user.uid,
          active: false,
          archived: true,
          archivedAt: getNowISOString(),
          updatedAt: serverTimestamp(),
        });
        setActionMessage("Habit archived.");
      },
    });
  }

  async function unarchiveHabit(habit: Habit) {
    await runAction(
      () =>
        updateDoc(doc(db, "users", user.uid, "habits", habit.id), {
          id: habit.id,
          userId: user.uid,
          active: true,
          archived: false,
          archivedAt: null,
          updatedAt: serverTimestamp(),
        }),
      "Habit restored."
    );
  }

  function deleteHabit(habit: Habit) {
    requestConfirmation({
      title: "Delete habit",
      description: `Permanently delete "${displayWithEmoji(habit.name, habit.emoji)}" and its completion history? This cannot be undone.`,
      confirmLabel: "Delete habit",
      cancelLabel: "Cancel",
      variant: "destructive",
      onConfirm: async () => {
        const completionSnapshot = await getDocs(collection(db, "users", user.uid, "habits", habit.id, "completions"));
        const batch = writeBatch(db);
        completionSnapshot.docs.forEach((completionDoc) => batch.delete(completionDoc.ref));
        batch.delete(doc(db, "users", user.uid, "habits", habit.id));
        await batch.commit();
        setActionMessage("Habit deleted.");
      },
    });
  }

  function applyTagFilter(tag: string) {
    setTaskFilters({ tag });
    setSelectedSavedFilterId(null);
    window.location.hash = "dashboard";
    setActionMessage(`Filtering tasks by #${tag}.`);
  }

  function applyDashboardFilter(criteria: FilterCriteria, message: string) {
    setTaskFilters(criteria);
    window.location.hash = "dashboard";
    setActionMessage(message);
  }

  async function runAction(action: () => Promise<void>, successMessage: string) {
    try {
      assertOnline();
      setActionError("");
      setActionMessage("");
      await action();
      setActionMessage(successMessage);
    } catch (error) {
      setActionError(getFriendlyError(error));
    }
  }

  function assertOnline() {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      throw new Error("You are offline. Saving changes requires connection.");
    }
  }

  async function installLifeOS() {
    if (!installPrompt) {
      setInstallStatus("Use your browser menu to install LifeOS or add it to your home screen.");
      return;
    }

    const showInstallPrompt = installPrompt.prompt.bind(installPrompt);
    await showInstallPrompt();
    const choice = await installPrompt.userChoice;
    setInstallPrompt(null);
    setInstallStatus(choice.outcome === "accepted" ? "LifeOS install started." : "Install dismissed. You can try again later from Settings.");
  }

  async function exportLifeOSData() {
    assertOnline();
    setBackupBusy(true);
    setBackupStatus("");
    try {
      const [weeklySnapshot, settingsSnapshot] = await Promise.all([
        getDocs(collection(db, "users", user.uid, "weeklyReviews")),
        getDoc(doc(db, "users", user.uid, "settings", "main")),
      ]);
      const backup: LifeOSBackup = {
        exportVersion: 1,
        appVersion: "0.1.0",
        exportedAt: getNowISOString(),
        data: {
          tasks: toBackupArray(tasks),
          projects: toBackupArray(projects),
          filters: toBackupArray(savedFilters),
          dailyPlans: toBackupArray(dailyPlans),
          focusSessions: toBackupArray(focusSessions),
          favoriteQuotes: toBackupArray(favoriteQuotes),
          habits: habits.map((habit) => serializeForBackup(habit) as Record<string, unknown> & { completions?: Array<Record<string, unknown>> }),
          weeklyReviews: weeklySnapshot.docs.map((snapshot) => serializeForBackup({ id: snapshot.id, ...snapshot.data() }) as Record<string, unknown>),
          settings: settingsSnapshot.exists() ? (serializeForBackup(settingsSnapshot.data()) as Record<string, unknown>) : null,
        },
      };

      downloadBackup(backup);
      setBackupStatus("Backup exported.");
    } catch (error) {
      setBackupStatus(getFriendlyError(error));
    } finally {
      setBackupBusy(false);
    }
  }

  async function readBackupFile(file: File | null) {
    if (!file) {
      return;
    }

    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const backup = validateBackup(parsed);
      const counts = countBackupData(backup);
      setImportPreview({ fileName: file.name, backup, counts, error: "", status: "" });
    } catch (error) {
      setImportPreview({ fileName: file.name, backup: null, counts: null, error: getFriendlyError(error), status: "" });
    }
  }

  function confirmImportBackup() {
    if (!importPreview.backup) {
      setImportPreview((current) => ({ ...current, error: "Choose a valid LifeOS backup file first." }));
      return;
    }

    requestConfirmation({
      title: "Import backup",
      description: "Import this backup into your current LifeOS account? Merge import skips documents when the same ID already exists.",
      confirmLabel: "Import backup",
      cancelLabel: "Cancel",
      variant: "normal",
      onConfirm: () => importBackupData(importPreview.backup as LifeOSBackup),
    });
  }

  async function importBackupData(backup: LifeOSBackup) {
    assertOnline();
    setBackupBusy(true);
    setImportPreview((current) => ({ ...current, status: "Importing backup...", error: "" }));
    try {
      await importCollection("tasks", backup.data.tasks);
      await importCollection("projects", backup.data.projects);
      await importCollection("filters", backup.data.filters);
      await importCollection("dailyPlans", backup.data.dailyPlans, (item) => String(item.id ?? item.date ?? ""));
      await importCollection("focusSessions", backup.data.focusSessions);
      await importCollection("favoriteQuotes", backup.data.favoriteQuotes);
      await importCollection("weeklyReviews", backup.data.weeklyReviews, (item) => String(item.id ?? item.weekId ?? ""));
      await importHabits(backup.data.habits);
      if (backup.data.settings) {
        await setDoc(doc(db, "users", user.uid, "settings", "main"), { ...backup.data.settings, userId: user.uid }, { merge: true });
      }
      setImportPreview((current) => ({ ...current, status: "Backup imported. Existing documents with matching IDs were skipped.", error: "" }));
      setActionMessage("Backup import finished.");
    } catch (error) {
      setImportPreview((current) => ({ ...current, error: getFriendlyError(error), status: "" }));
    } finally {
      setBackupBusy(false);
    }
  }

  async function importCollection(collectionName: string, docsToImport: Array<Record<string, unknown>>, idResolver = (item: Record<string, unknown>) => String(item.id ?? "")) {
    const existingIds = new Set((await getDocs(collection(db, "users", user.uid, collectionName))).docs.map((snapshot) => snapshot.id));
    let batch = writeBatch(db);
    let writes = 0;

    const commitBatch = async () => {
      if (writes > 0) {
        await batch.commit();
        batch = writeBatch(db);
        writes = 0;
      }
    };

    for (const item of docsToImport) {
      const id = idResolver(item) || createLocalId();
      if (existingIds.has(id)) {
        continue;
      }
      batch.set(doc(db, "users", user.uid, collectionName, id), prepareImportedDoc(item, id, user.uid));
      writes += 1;
      if (writes >= 450) {
        await commitBatch();
      }
    }

    await commitBatch();
  }

  async function importHabits(habitsToImport: LifeOSBackup["data"]["habits"]) {
    const existingIds = new Set((await getDocs(collection(db, "users", user.uid, "habits"))).docs.map((snapshot) => snapshot.id));
    let batch = writeBatch(db);
    let writes = 0;

    const commitBatch = async () => {
      if (writes > 0) {
        await batch.commit();
        batch = writeBatch(db);
        writes = 0;
      }
    };

    for (const habit of habitsToImport) {
      const id = String(habit.id ?? "");
      if (!id || existingIds.has(id)) {
        continue;
      }

      const { completions, ...habitData } = habit;
      batch.set(doc(db, "users", user.uid, "habits", id), prepareImportedDoc(habitData, id, user.uid));
      writes += 1;
      if (writes >= 450) {
        await commitBatch();
      }

      for (const completion of Array.isArray(completions) ? completions : []) {
        const completionId = String(completion.id ?? completion.date ?? "");
        if (!completionId) {
          continue;
        }
        batch.set(doc(db, "users", user.uid, "habits", id, "completions", completionId), {
          ...prepareImportedDoc(completion, completionId, user.uid),
          habitId: id,
          date: String(completion.date ?? completionId),
        });
        writes += 1;
        if (writes >= 450) {
          await commitBatch();
        }
      }
    }

    await commitBatch();
  }

  function confirmDeleteAppData() {
    requestConfirmation({
      title: "Delete all LifeOS data",
      description: "This deletes tasks, projects, views, daily plans, focus sessions, favorite quotes, habits, weekly reviews, and settings for this signed-in account. Your Firebase Auth account stays active.",
      confirmLabel: "Delete app data",
      cancelLabel: "Cancel",
      variant: "destructive",
      requiredPhrase: "DELETE",
      onConfirm: () => deleteAllLifeOSData(),
    });
  }

  function confirmDeleteAccount() {
    const usesPasswordProvider = isEmailPasswordUser(user);
    requestConfirmation({
      title: "Delete account",
      description: usesPasswordProvider
        ? "This deletes your LifeOS app data and your Firebase Auth account. Re-enter your password so Firebase can confirm this destructive action before any app data is deleted."
        : "This deletes your LifeOS app data and your Firebase Auth account. If Firebase requires recent login, log out and log in again with your provider before retrying.",
      confirmLabel: "Delete account",
      cancelLabel: "Cancel",
      variant: "destructive",
      requiredPhrase: "DELETE ACCOUNT",
      passwordRequired: usesPasswordProvider,
      passwordLabel: "Confirm password",
      passwordPlaceholder: "Your LifeOS password",
      onConfirm: (password) => deleteAccountSafely(password),
    });
  }

  async function deleteAccountSafely(password?: string) {
    assertOnline();
    const currentUser = auth.currentUser;
    if (!currentUser || currentUser.uid !== user.uid) {
      throw new Error("No active authenticated user was found. Log in again, then retry account deletion.");
    }

    const usesPasswordProvider = isEmailPasswordUser(currentUser);
    if (usesPasswordProvider) {
      const email = currentUser.email ?? user.email;
      if (!email) {
        throw new Error("This account does not have an email address available for reauthentication.");
      }
      if (!password) {
        throw new Error("Enter your password to confirm account deletion.");
      }

      try {
        await reauthenticateWithCredential(currentUser, EmailAuthProvider.credential(email, password));
      } catch (error) {
        if (isFirebaseErrorCode(error, "auth/invalid-credential") || isFirebaseErrorCode(error, "auth/wrong-password")) {
          throw new Error("That password was not accepted. Check it and try again.");
        }
        throw error;
      }
    } else {
      throw new Error("Delete account currently supports LifeOS email/password accounts. For provider-based accounts, log out and sign in again, then delete app data separately if needed.");
    }

    try {
      await deleteAllLifeOSData(false);
    } catch (error) {
      throw new Error(`Account deletion stopped because app data could not be deleted: ${getFriendlyError(error)}`);
    }

    try {
      await deleteUser(currentUser);
      setActionMessage("LifeOS account deleted.");
    } catch (error) {
      if (isFirebaseErrorCode(error, "auth/requires-recent-login")) {
        throw new Error("App data was deleted, but Firebase still requires a fresh login before deleting the Auth account. Log in again, then retry account deletion.");
      }
      throw new Error(`App data was deleted, but the Auth account could not be deleted: ${getFriendlyError(error)}`);
    }
  }

  async function deleteAllLifeOSData(showMessage = true) {
    assertOnline();
    setBackupBusy(true);
    try {
      await deleteUserCollections();
      await deleteDoc(doc(db, "users", user.uid));
      if (showMessage) {
        setActionMessage("LifeOS app data deleted.");
      }
    } finally {
      setBackupBusy(false);
    }
  }

  async function deleteUserCollections() {
    let batch = writeBatch(db);
    let writes = 0;

    const commitBatch = async () => {
      if (writes > 0) {
        await batch.commit();
        batch = writeBatch(db);
        writes = 0;
      }
    };

    const deleteRef = async (pathDoc: ReturnType<typeof doc>) => {
      batch.delete(pathDoc);
      writes += 1;
      if (writes >= 450) {
        await commitBatch();
      }
    };

    const habitSnapshot = await getDocs(collection(db, "users", user.uid, "habits"));
    for (const habitDoc of habitSnapshot.docs) {
      const completionSnapshot = await getDocs(collection(db, "users", user.uid, "habits", habitDoc.id, "completions"));
      for (const completionDoc of completionSnapshot.docs) {
        await deleteRef(completionDoc.ref);
      }
      await deleteRef(habitDoc.ref);
    }

    for (const collectionName of ["tasks", "projects", "filters", "dailyPlans", "focusSessions", "favoriteQuotes", "weeklyReviews", "settings", "recurringTasks"]) {
      const snapshot = await getDocs(collection(db, "users", user.uid, collectionName));
      for (const item of snapshot.docs) {
        await deleteRef(item.ref);
      }
    }

    await commitBatch();
  }

  async function saveWeeklyReview(reviewDraft: WeeklyReview, completedAt = reviewDraft.completedAt) {
    const targetWeekId = reviewDraft.weekId || selectedWeekId;
    const range = getWeekRange(targetWeekId);
    const completedTaskIds = getCompletedTasksForWeek(tasks, range).map((task) => task.id);
    const projectReviewActions = Object.fromEntries(Object.entries(reviewDraft.projectReviewActions).filter(([, action]) => Boolean(action)));
    const projectReviewStates = Object.fromEntries(
      Object.entries({ ...reviewDraft.projectReviewStates, ...projectReviewActions }).filter(([, action]) => Boolean(action))
    );
    const reviewedProjectIds = Array.from(new Set([...Object.keys(projectReviewActions), ...Object.keys(projectReviewStates), ...reviewDraft.nextWeekProjectIds]));
    const improveNextWeek = (reviewDraft.whatToImproveNextWeek || reviewDraft.improveNextWeek).trim();

    setWeeklySaveState({ status: "saving", message: "Saving weekly review..." });
    try {
      await setDoc(
        doc(db, "users", user.uid, "weeklyReviews", targetWeekId),
        {
          id: targetWeekId,
          userId: user.uid,
          weekId: targetWeekId,
          weekStartDate: range.startDate,
          weekEndDate: range.endDate,
          completedTaskIds,
          reviewedProjectIds,
          topWins: reviewDraft.topWins.trim(),
          biggestStruggles: reviewDraft.biggestStruggles.trim(),
          lessonsLearned: reviewDraft.lessonsLearned.trim(),
          whatToStopDoing: reviewDraft.whatToStopDoing.trim(),
          whatToContinueDoing: reviewDraft.whatToContinueDoing.trim(),
          whatToStartDoing: reviewDraft.whatToStartDoing.trim(),
          improveNextWeek,
          whatToImproveNextWeek: improveNextWeek,
          nextWeekPriorityTaskIds: reviewDraft.nextWeekPriorityTaskIds.slice(0, 5),
          nextWeekProjectIds: reviewDraft.nextWeekProjectIds.slice(0, 3),
          nextWeekNotes: reviewDraft.nextWeekNotes.trim(),
          projectReviewActions,
          projectReviewStates,
          habitReflection: reviewDraft.habitReflection.trim(),
          focusReflection: reviewDraft.focusReflection.trim(),
          moodSummary: reviewDraft.moodSummary.trim(),
          energySummary: reviewDraft.energySummary.trim(),
          rating: reviewDraft.rating,
          completedAt,
          createdAt: reviewDraft.createdAt ?? serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setWeeklySaveState({ status: "saved", message: completedAt ? "Weekly review completed." : "Weekly review saved." });
    } catch (error) {
      const message = getFriendlyError(error);
      setWeeklySaveState({ status: "error", message });
      throw error;
    }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Primary">
        <div className="brand-row">
          <span className="brand-mark app-icon-mark" aria-hidden="true" />
          <div>
            <p className="eyebrow">Personal workspace</p>
            <h1>LifeOS v2</h1>
          </div>
        </div>

        <nav className="nav-list">
          {navItems.map(({ id, label, icon: Icon }) => (
            <a className={activePage === id ? "active" : ""} href={`#${id}`} key={id}>
              <Icon size={18} />
              <span>{label}</span>
              {getNavBadge(navBadges[id as keyof typeof navBadges]) ? (
                <em className={`nav-count ${id === "weekly-review" ? "attention" : ""}`}>{getNavBadge(navBadges[id as keyof typeof navBadges])}</em>
              ) : null}
            </a>
          ))}
        </nav>

        <section className="sync-panel" aria-label="Sync status">
          <ShieldCheck size={18} />
          <div>
            <strong>Signed in</strong>
            <span>{user.email}</span>
          </div>
        </section>

        <button className="secondary-button full-width" type="button" onClick={() => void signOut(auth)}>
          <LogOut size={17} />
          Logout
        </button>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">{pageTitle}</p>
            <h2>{getPageHeadline(activePage)}</h2>
          </div>
          {activePage === "projects" ? (
            <button className="primary-button" type="button" onClick={() => setProjectEditor({ project: null })}>
              <Plus size={18} />
              New project
            </button>
          ) : activePage === "saved-views" ? (
            <button className="primary-button" type="button" onClick={() => setSavedFilterEditor({ filter: null })}>
              <Plus size={18} />
              New view
            </button>
          ) : activePage === "habits" ? (
            <button className="primary-button" type="button" onClick={() => setHabitEditor({ habit: null })}>
              <Plus size={18} />
              New habit
            </button>
          ) : activePage === "privacy" || activePage === "terms" ? null : (
            <button
              className="primary-button"
              type="button"
              onClick={() => setTaskEditor({ task: null, defaultStatus: defaultCreateStatus, defaultProjectId: null })}
            >
              <Plus size={18} />
              New task
            </button>
          )}
        </header>

        {actionError ? <StatusBanner tone="error" message={actionError} /> : null}
        {actionMessage ? <StatusBanner tone="success" message={actionMessage} /> : null}
        {taskState.error ? <StatusBanner tone="error" message={taskState.error} /> : null}
        {projectState.error ? <StatusBanner tone="error" message={projectState.error} /> : null}
        {savedFilterState.error ? <StatusBanner tone="error" message={savedFilterState.error} /> : null}
        {dailyPlanState.error ? <StatusBanner tone="error" message={dailyPlanState.error} /> : null}
        {dailyPlansState.error ? <StatusBanner tone="error" message={dailyPlansState.error} /> : null}
        {focusSessionState.error ? <StatusBanner tone="error" message={focusSessionState.error} /> : null}
        {favoriteQuoteState.error ? <StatusBanner tone="error" message={favoriteQuoteState.error} /> : null}
        {habitState.error ? <StatusBanner tone="error" message={habitState.error} /> : null}
        {weeklyReviewState.error ? <StatusBanner tone="error" message={weeklyReviewState.error} /> : null}
        {settingsState.error ? <StatusBanner tone="error" message={settingsState.error} /> : null}
        <ReminderCenter dueReminders={dueReminders} onDismiss={dismissTaskReminder} onSnooze={snoozeTaskReminder} />

        {activePage === "dashboard" ? (
          <DashboardPage
            nextTask={nextTask}
            tasks={tasks}
            openTasks={openTasks}
            todayTasks={todayTasks}
            completionRate={completionRate}
            projects={projects}
            statsByProject={statsByProject}
            savedFilters={savedFilters}
            savedFilterOpenCounts={savedFilterOpenCounts}
            tagCounts={tagCounts}
            highPriorityTasks={highPriorityTasks}
            noProjectTasks={noProjectTasks}
            overdueTasks={overdueTasks}
            dailyPlan={dailyPlan}
            todayStats={todayStats}
            focusStats={todayFocusStats}
            weekFocusMinutes={weekFocusMinutes}
            weekCompletedTasks={weekCompletedTasks}
            weeklyStats={weeklyDashboardStats}
            weeklyReviewCompleted={Boolean(weeklyReview.completedAt)}
            bestPerformance={bestDashboardPerformance}
            attentionPerformance={attentionDashboardPerformance}
            performanceRecommendations={dashboardRecommendations}
            insightMessages={insightMessages}
            quote={dailyQuote}
            quoteFavorite={isDailyQuoteFavorite}
            onQuickCreate={(value) => createTaskFromQuick(value, "inbox")}
            onOpenFocusTask={openFocusForTask}
            onOpenInsights={() => {
              window.location.hash = "insights";
            }}
            onOpenWeeklyReview={() => {
              window.location.hash = "weekly-review";
            }}
            onRefreshQuote={refreshQuote}
            onToggleFavoriteQuote={toggleFavoriteQuote}
            onOpenSavedFilter={(filter) => {
              setSelectedSavedFilterId(filter.id);
              window.location.hash = "saved-views";
            }}
            onSelectTag={applyTagFilter}
            onApplyTaskSignal={applyDashboardFilter}
          />
        ) : null}

        {activePage === "today" ? (
          <TodayPage
            dateId={todayDateId}
            plan={dailyPlan}
            loading={dailyPlanState.loading}
            tasks={tasks}
            todayTasks={todayTasks}
            overdueTasks={overdueTasks}
            projects={projects}
            stats={todayStats}
            focusStats={todayFocusStats}
            insightMessages={insightMessages}
            onQuickCreate={(value) => createTaskFromQuick(value, "today")}
            onAddTopTask={addTopTask}
            onRemoveTopTask={removeTopTask}
            onSetDeepWork={setDeepWorkTask}
            onClearDeepWork={clearDeepWorkTask}
            onStartFocusBlock={startFocusBlock}
            onSaveTimeBlock={(blockId, values) => runAction(() => saveTimeBlock(blockId, values), "Time block saved.")}
            onDeleteTimeBlock={deleteTimeBlock}
            onToggleTimeBlock={toggleTimeBlock}
            onSaveReflection={(reflection) => runAction(() => saveReflection(reflection), "Reflection saved.")}
            onEditTask={(task) => setTaskEditor({ task, defaultStatus: task.status, defaultProjectId: task.projectId })}
            onMarkDone={(task) => void runAction(() => completeTask(task), task.repeatEnabled ? "Recurring task advanced." : "Task marked done.")}
            onMoveTask={(task, status) =>
              void runAction(() => updateTask(task, { status, completedAt: null }), status === "inbox" ? "Task moved to Inbox." : "Task moved to Upcoming.")
            }
            onFocusTask={openFocusForTask}
          />
        ) : null}

        {activePage === "focus" ? (
          <FocusPage
            sessions={focusSessions}
            loading={focusSessionState.loading}
            tasks={tasks}
            projects={projects}
            selectedTaskId={selectedFocusTaskId}
            todayDateId={todayDateId}
            stats={todayFocusStats}
            onSelectTask={setSelectedFocusTaskId}
            onStartSession={startFocusSession}
            onPauseSession={pauseFocusSession}
            onResumeSession={resumeFocusSession}
            onCancelSession={cancelFocusSession}
            onCompleteSession={completeFocusSession}
            onDeleteSession={deleteFocusSession}
            onSaveSessionNotes={saveFocusSessionNotes}
            onMarkTaskDone={markTaskDoneFromFocus}
          />
        ) : null}

        {activePage === "insights" ? (
          <InsightsPage
            userId={user.uid}
            tasks={tasks}
            projects={projects}
            focusSessions={focusSessions}
            dailyPlan={dailyPlan}
            dailyPlans={dailyPlans}
            tagCounts={tagCounts}
            todayDateId={todayDateId}
            messages={insightMessages}
            quote={dailyQuote}
            quoteFavorite={isDailyQuoteFavorite}
            onRefreshQuote={refreshQuote}
            onToggleFavoriteQuote={toggleFavoriteQuote}
          />
        ) : null}

        {activePage === "habits" ? (
          <HabitsPage
            habits={habits}
            loading={habitState.loading}
            todayDateId={todayDateId}
            onCreateHabit={() => setHabitEditor({ habit: null })}
            onEditHabit={(habit) => setHabitEditor({ habit })}
            onArchiveHabit={archiveHabit}
            onUnarchiveHabit={unarchiveHabit}
            onDeleteHabit={deleteHabit}
            onCompleteToday={completeHabitToday}
            onUndoToday={undoHabitToday}
          />
        ) : null}

        {activePage === "weekly-review" ? (
          <WeeklyReviewPage
            userId={user.uid}
            weekId={selectedWeekId}
            review={weeklyReview}
            exists={weeklyReviewState.exists}
            loading={weeklyReviewState.loading}
            saveState={weeklySaveState}
            tasks={tasks}
            projects={projects}
            focusSessions={focusSessions}
            dailyPlans={dailyPlans}
            habits={habits}
            onWeekChange={setSelectedWeekId}
            onSave={(reviewDraft) => saveWeeklyReview(reviewDraft)}
            onComplete={(reviewDraft) => saveWeeklyReview(reviewDraft, getNowISOString())}
            onReopen={(reviewDraft) => saveWeeklyReview(reviewDraft, null)}
          />
        ) : null}

        {activePage === "projects" ? (
          <ProjectsPage
            projects={projects}
            tasks={tasks}
            statsByProject={statsByProject}
            loading={projectState.loading}
            selectedProjectId={selectedProjectId}
            creatingStarterProjects={creatingStarterProjects}
            onSelectProject={setSelectedProjectId}
            onCreateProject={() => setProjectEditor({ project: null })}
            onCreateStarterProjects={() => void createStarterProjects()}
            onEditProject={(project) => setProjectEditor({ project })}
            onAddTask={(project) => setTaskEditor({ task: null, defaultStatus: "inbox", defaultProjectId: project.id })}
            onArchiveProject={(project) =>
              void runAction(
                () => updateProject(project, { status: "archived", archivedAt: getNowISOString(), completedAt: null }),
                "Project archived."
              )
            }
            onUnarchiveProject={(project) =>
              void runAction(() => updateProject(project, { status: "active", archivedAt: null, completedAt: null }), "Project reactivated.")
            }
            onCompleteProject={(project) =>
              void runAction(
                () => updateProject(project, { status: "completed", completedAt: getNowISOString(), archivedAt: null }),
                "Project completed."
              )
            }
            onReactivateProject={(project) =>
              void runAction(() => updateProject(project, { status: "active", completedAt: null, archivedAt: null }), "Project reactivated.")
            }
            onDeleteProject={deleteProject}
          />
        ) : null}

        {activePage === "saved-views" ? (
          <SavedViewsPage
            filters={savedFilters}
            filtersLoading={savedFilterState.loading}
            tasks={tasks}
            projects={projects}
            tags={tagCounts}
            selectedFilterId={selectedSavedFilterId}
            onSelectFilter={setSelectedSavedFilterId}
            onCreateFilter={() => setSavedFilterEditor({ filter: null })}
            onCreateSuggestedFilter={(values) => void createSuggestedSavedFilter(values)}
            onEditFilter={(filter) => setSavedFilterEditor({ filter })}
            onDeleteFilter={deleteSavedFilter}
            onSelectTag={applyTagFilter}
            taskActions={{
              onEdit: (task) => setTaskEditor({ task, defaultStatus: task.status, defaultProjectId: task.projectId }),
              onDelete: deleteTask,
              onMarkDone: (task) => void runAction(() => completeTask(task), task.repeatEnabled ? "Recurring task advanced." : "Task marked done."),
              onUndoDone: (task) => void runAction(() => updateTask(task, { status: "today", completedAt: null }), "Task moved back to Today."),
              onArchive: (task) => void runAction(() => updateTask(task, { status: "archived" }), "Task archived."),
              onMoveToday: (task) =>
                void runAction(
                  () => updateTask(task, { status: "today", dueDate: getTodayISODate(), completedAt: null }),
                  "Task moved to Today."
                ),
              onMoveUpcoming: (task) =>
                void runAction(() => updateTask(task, { status: "upcoming", completedAt: null }), "Task moved to Upcoming."),
              onFocus: openFocusForTask,
            }}
          />
        ) : null}

        {activePage === "inbox" ? (
          <PagePanel title="Inbox capture" description="Collect loose tasks first, then clarify them into today, upcoming, or a project.">
            <QuickCapture label="Add to Inbox" onCreate={(value) => createTaskFromQuick(value, "inbox")} />
          </PagePanel>
        ) : null}

        {activePage === "settings" ? (
          <SettingsPage
            user={user}
            tasks={tasks}
            projects={projects}
            savedFilters={savedFilters}
            tagCount={tagCounts.length}
            notificationPermission={notificationPermission}
            onEnableNotifications={requestReminderNotifications}
            appearanceSettings={userSettings}
            appearanceLoading={settingsState.loading}
            onSaveAppearance={saveUserSettings}
            installAvailable={Boolean(installPrompt)}
            installStatus={installStatus}
            onInstall={installLifeOS}
            backupBusy={backupBusy}
            backupStatus={backupStatus}
            importPreview={importPreview}
            onExportData={exportLifeOSData}
            onImportFile={readBackupFile}
            onConfirmImport={confirmImportBackup}
            onClearImport={() => setImportPreview({ fileName: "", backup: null, counts: null, error: "", status: "" })}
            onDeleteAppData={confirmDeleteAppData}
            onDeleteAccount={confirmDeleteAccount}
          />
        ) : null}

        {activePage === "privacy" ? <PrivacyPage /> : null}
        {activePage === "terms" ? <TermsPage /> : null}

        {activePage !== "projects" &&
        activePage !== "saved-views" &&
        activePage !== "today" &&
        activePage !== "focus" &&
        activePage !== "insights" &&
        activePage !== "habits" &&
        activePage !== "weekly-review" &&
        activePage !== "privacy" &&
        activePage !== "terms" ? (
          <TaskSection
            loading={taskState.loading}
            page={activePage}
            tasks={visibleTasks}
            projects={projects}
            tags={tagCounts}
            filterCriteria={taskFilters}
            onFilterChange={setTaskFilters}
            onClearFilters={() => setTaskFilters({})}
            onSelectTag={(tag) => setTaskFilters((current) => ({ ...current, tag }))}
            onEdit={(task) => setTaskEditor({ task, defaultStatus: task.status, defaultProjectId: task.projectId })}
            onDelete={deleteTask}
            onMarkDone={(task) =>
              void runAction(() => completeTask(task), task.repeatEnabled ? "Recurring task advanced." : "Task marked done.")
            }
            onUndoDone={(task) =>
              void runAction(() => updateTask(task, { status: "today", completedAt: null }), "Task moved back to Today.")
            }
            onArchive={(task) => void runAction(() => updateTask(task, { status: "archived" }), "Task archived.")}
            onMoveToday={(task) =>
              void runAction(
                () => updateTask(task, { status: "today", dueDate: getTodayISODate(), completedAt: null }),
                "Task moved to Today."
              )
            }
            onMoveUpcoming={(task) =>
              void runAction(() => updateTask(task, { status: "upcoming", completedAt: null }), "Task moved to Upcoming.")
            }
            onFocus={openFocusForTask}
          />
        ) : null}
      </section>

      {taskEditor ? (
        <TaskEditor
          task={taskEditor.task}
          projects={projects}
          defaultStatus={taskEditor.defaultStatus}
          defaultProjectId={taskEditor.defaultProjectId}
          onClose={() => setTaskEditor(null)}
          onSave={(values) => saveTask(values, taskEditor.task)}
        />
      ) : null}

      {projectEditor ? (
        <ProjectForm project={projectEditor.project} onClose={() => setProjectEditor(null)} onSave={(values) => saveProject(values, projectEditor.project)} />
      ) : null}

      {savedFilterEditor ? (
        <SavedViewForm
          filter={savedFilterEditor.filter}
          projects={projects}
          tags={tagCounts}
          onClose={() => setSavedFilterEditor(null)}
          onSave={(values) => saveSavedFilter(values, savedFilterEditor.filter)}
        />
      ) : null}

      {habitEditor ? (
        <HabitForm habit={habitEditor.habit} onClose={() => setHabitEditor(null)} onSave={(values) => saveHabit(values, habitEditor.habit)} />
      ) : null}

      {confirmDialog ? (
        <ConfirmDialog dialog={confirmDialog} busy={confirmBusy} errorMessage={actionError} onCancel={closeConfirmDialog} onConfirm={(password) => void handleConfirmDialog(password)} />
      ) : null}
    </main>
  );

  function DashboardPage({
    nextTask,
    tasks,
    openTasks,
    todayTasks,
    completionRate,
    projects,
    statsByProject,
    savedFilters,
    savedFilterOpenCounts,
    tagCounts,
    highPriorityTasks,
    noProjectTasks,
    overdueTasks,
    dailyPlan,
    todayStats,
    focusStats,
    weekFocusMinutes,
    weekCompletedTasks,
    weeklyStats,
    weeklyReviewCompleted,
    bestPerformance,
    attentionPerformance,
    performanceRecommendations,
    insightMessages,
    quote,
    quoteFavorite,
    onQuickCreate,
    onOpenFocusTask,
    onOpenInsights,
    onOpenWeeklyReview,
    onRefreshQuote,
    onToggleFavoriteQuote,
    onOpenSavedFilter,
    onSelectTag,
    onApplyTaskSignal,
  }: {
    nextTask: Task | null;
    tasks: Task[];
    openTasks: Task[];
    todayTasks: Task[];
    completionRate: number;
    projects: Project[];
    statsByProject: Record<string, ProjectStats>;
    savedFilters: SavedFilter[];
    savedFilterOpenCounts: Record<string, number>;
    tagCounts: ReturnType<typeof getTaskCountsByTag>;
    highPriorityTasks: Task[];
    noProjectTasks: Task[];
    overdueTasks: Task[];
    dailyPlan: DailyPlan;
    todayStats: ReturnType<typeof calculateTodayStats>;
    focusStats: ReturnType<typeof getTodayFocusStats>;
    weekFocusMinutes: number;
    weekCompletedTasks: number;
    weeklyStats: ReturnType<typeof calculateWeeklyStats>;
    weeklyReviewCompleted: boolean;
    bestPerformance: ProjectPerformance | AreaPerformance | null;
    attentionPerformance: ProjectPerformance | AreaPerformance | null;
    performanceRecommendations: ReturnType<typeof generatePerformanceRecommendations>;
    insightMessages: ReturnType<typeof generateInsightMessages>;
    quote: typeof dailyQuote;
    quoteFavorite: boolean;
    onQuickCreate: (value: string) => Promise<void>;
    onOpenFocusTask: (task: Task) => void;
    onOpenInsights: () => void;
    onOpenWeeklyReview: () => void;
    onRefreshQuote: () => void;
    onToggleFavoriteQuote: () => void;
    onOpenSavedFilter: (filter: SavedFilter) => void;
    onSelectTag: (tag: string) => void;
    onApplyTaskSignal: (criteria: FilterCriteria, message: string) => void;
  }) {
    const activeProjects = projects.filter((project) => project.status === "active" || project.status === "paused");
    const topProjects = [...activeProjects]
      .sort((left, right) => (statsByProject[right.id]?.openTasks ?? 0) - (statsByProject[left.id]?.openTasks ?? 0))
      .slice(0, 3);
    const recentProjects = [...projects].slice(0, 3);
    const topTags = tagCounts.slice(0, 6);
    const savedViewShortcuts = savedFilters.slice(0, 3);
    const taskById = new Map(tasks.map((task) => [task.id, task]));
    const topPreviewTasks = dailyPlan.topTaskIds.map((taskId) => taskById.get(taskId)).filter((task): task is Task => Boolean(task));
    const deepWorkTask = dailyPlan.deepWorkTaskId ? taskById.get(dailyPlan.deepWorkTaskId) ?? null : null;

    return (
      <>
        <section className="hero-band">
          <div className="hero-copy">
            <p className="eyebrow">Next best action</p>
            <h3>{nextTask ? displayWithEmoji(nextTask.title, nextTask.emoji) : "Capture the first task"}</h3>
            <p>
              {nextTask
                ? `${displayWithEmoji(projectById.get(nextTask.projectId ?? "")?.name ?? "No project", projectById.get(nextTask.projectId ?? "")?.emoji)} - ${nextTask.priority} priority.`
                : "Your Firestore task list is empty. Add one below or create starter projects."}
            </p>
            <QuickCapture label="Quick capture" onCreate={onQuickCreate} />
          </div>
          <div className="hero-stat" aria-label="Completion rate">
            <span>{completionRate}%</span>
            <small>task completion</small>
          </div>
        </section>

        <section className="metrics-grid" aria-label="Task and project metrics">
          <MetricCard icon={Inbox} label="Open tasks" value={String(openTasks.length)} detail="Inbox, Today, Upcoming" />
          <MetricCard icon={CheckCircle2} label="Today" value={String(todayTasks.length)} detail="Scheduled for now" />
          <MetricCard icon={FolderKanban} label="Active projects" value={String(activeProjects.length)} detail="Active or paused" />
          <MetricCard icon={Timer} label="Focus today" value={formatMinutes(focusStats.totalFocusedMinutes)} detail="Completed focus time" />
          <MetricCard icon={Clock3} label="Focus this week" value={formatMinutes(weekFocusMinutes)} detail="Last 7 days" />
          <MetricCard icon={Check} label="Done this week" value={String(weekCompletedTasks)} detail="Completed tasks" />
          <MetricCard icon={BarChart3} label="Best signal" value={getPerformanceTitle(bestPerformance)} detail={getPerformanceDetail(bestPerformance)} />
          <MetricCard icon={AlertTriangle} label="Needs attention" value={getPerformanceTitle(attentionPerformance)} detail={getPerformanceDetail(attentionPerformance)} />
        </section>

        <section className="content-grid dashboard-project-grid">
          <article className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Today plan</p>
                <h3>Top 3 and Deep Work</h3>
              </div>
              <a className="secondary-button" href="#today">
                <CheckCircle2 size={17} />
                Today
              </a>
            </div>
            <div className="dashboard-today-plan">
              <div>
                <strong>{formatMinutes(todayStats.totalEstimatedMinutes)}</strong>
                <span>estimated today</span>
              </div>
              <div>
                <strong>{todayStats.completedToday}</strong>
                <span>completed</span>
              </div>
            </div>
            <div className="dashboard-mini-list">
              {topPreviewTasks.length === 0 ? <span className="muted-line">No Top 3 selected yet.</span> : null}
              {topPreviewTasks.map((task) => (
                <span key={task.id}>{displayWithEmoji(task.title, task.emoji)}</span>
              ))}
              {deepWorkTask ? <em>Deep Work: {displayWithEmoji(deepWorkTask.title, deepWorkTask.emoji)}</em> : <em>No Deep Work task selected.</em>}
            </div>
            {deepWorkTask ? (
              <button className="secondary-button" type="button" onClick={() => onOpenFocusTask(deepWorkTask)}>
                <Timer size={17} />
                Start focus
              </button>
            ) : null}
          </article>

          <DailyQuoteCard quote={quote} favorite={quoteFavorite} onRefresh={onRefreshQuote} onToggleFavorite={onToggleFavoriteQuote} />

          <article className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Insights</p>
                <h3>Recommendations</h3>
              </div>
              <button className="secondary-button" type="button" onClick={onOpenInsights}>
                <BarChart3 size={17} />
                Insights
              </button>
            </div>
            {performanceRecommendations.length > 0 ? <RecommendationList recommendations={performanceRecommendations.slice(0, 3)} /> : <InsightMessageList messages={insightMessages.slice(0, 3)} />}
          </article>

          <article className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Weekly Review</p>
                <h3>{weeklyReviewCompleted ? "This week is reviewed" : "Close the loop"}</h3>
              </div>
              <button className="secondary-button" type="button" onClick={onOpenWeeklyReview}>
                <CalendarDays size={17} />
                Review
              </button>
            </div>
            <div className="dashboard-today-plan">
              <div>
                <strong>{weeklyStats.completedTasks}</strong>
                <span>completed this week</span>
              </div>
              <div>
                <strong>{formatMinutes(weeklyStats.focusMinutes)}</strong>
                <span>focus</span>
              </div>
              <div>
                <strong>{weeklyStats.habitCompletionRate === null ? "N/A" : `${weeklyStats.habitCompletionRate}%`}</strong>
                <span>habits</span>
              </div>
            </div>
            <p className="panel-copy">
              {weeklyReviewCompleted
                ? "Weekly reflection is complete. You can reopen it anytime."
                : "Review wins, struggles, focus, habits, and next-week priorities."}
            </p>
          </article>

          <article className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Signals</p>
                <h3>Task browsing shortcuts</h3>
              </div>
              <Check size={20} />
            </div>
            <div className="dashboard-signal-grid">
              <button type="button" onClick={() => onApplyTaskSignal({ priority: "high" }, "Showing high priority tasks.")}>
                <strong>{highPriorityTasks.length}</strong>
                <span>High priority</span>
              </button>
              <button type="button" onClick={() => onApplyTaskSignal({ projectId: "none" }, "Showing tasks with no project.")}>
                <strong>{noProjectTasks.length}</strong>
                <span>No project</span>
              </button>
              <button type="button" onClick={() => onApplyTaskSignal({ dueDateGroup: "overdue" }, "Showing overdue tasks.")}>
                <strong>{overdueTasks.length}</strong>
                <span>Overdue</span>
              </button>
              <button type="button" onClick={() => onApplyTaskSignal({ status: "today" }, "Showing today's tasks.")}>
                <strong>{todayTasks.length}</strong>
                <span>Today</span>
              </button>
            </div>
          </article>

          <article className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Saved views</p>
                <h3>Quick access</h3>
              </div>
              <a className="secondary-button" href="#saved-views">
                <ListFilter size={17} />
                Views
              </a>
            </div>
            {savedViewShortcuts.length === 0 ? (
              <EmptyState title="No saved views" message="Create saved views for reusable task filters." />
            ) : (
              <div className="dashboard-project-list">
                {savedViewShortcuts.map((filter) => (
                  <button
                    className="project-summary-row"
                    type="button"
                    key={filter.id}
                    onClick={() => onOpenSavedFilter(filter)}
                    style={{ "--project-color": filter.color } as CSSProperties}
                  >
                    <span className="project-color-dot" />
                    <span>
                      <strong>{filter.name}</strong>
                      <small>{savedFilterOpenCounts[filter.id] ?? 0} open tasks</small>
                    </span>
                    <em>Open</em>
                  </button>
                ))}
              </div>
            )}
          </article>

          <article className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Tags</p>
                <h3>Top tags</h3>
              </div>
            </div>
            <TagList tags={topTags} onSelectTag={onSelectTag} />
          </article>

          <article className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Projects</p>
                <h3>Top projects by open tasks</h3>
              </div>
              <a className="secondary-button" href="#projects">
                <FolderKanban size={17} />
                Projects
              </a>
            </div>
            {topProjects.length === 0 ? (
              <EmptyState title="No active projects" message="Create a project or add the starter project set from the Projects page." />
            ) : (
              <div className="dashboard-project-list">
                {topProjects.map((project) => (
                  <ProjectSummaryRow key={project.id} project={project} stats={statsByProject[project.id]} />
                ))}
              </div>
            )}
          </article>

          <article className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Recently updated</p>
                <h3>Project movement</h3>
              </div>
              <Sparkles size={20} />
            </div>
            {recentProjects.length === 0 ? (
              <EmptyState title="No project updates" message="Project updates will appear here after creation or editing." />
            ) : (
              <div className="dashboard-project-list">
                {recentProjects.map((project) => (
                  <ProjectSummaryRow key={project.id} project={project} stats={statsByProject[project.id]} showDate />
                ))}
              </div>
            )}
          </article>
        </section>
      </>
    );
  }

  function getPerformanceTitle(item: ProjectPerformance | AreaPerformance | null) {
    if (!item) {
      return "None yet";
    }

    return "projectId" in item ? displayWithEmoji(item.name, item.emoji) : displayWithEmoji(item.area, item.emoji);
  }

  function getPerformanceDetail(item: ProjectPerformance | AreaPerformance | null) {
    if (!item) {
      return "Create activity to compare";
    }

    return `${item.status} · ${formatMinutes(item.focusMinutes)} focus`;
  }

  function ProjectSummaryRow({ project, stats, showDate = false }: { project: Project; stats?: ProjectStats; showDate?: boolean }) {
    const safeStats = stats ?? { openTasks: 0, completedTasks: 0, totalTasks: 0, progress: 0 };
    return (
      <button
        className="project-summary-row"
        type="button"
        onClick={() => {
          setSelectedProjectId(project.id);
          window.location.hash = "projects";
        }}
        style={{ "--project-color": project.color } as CSSProperties}
      >
        <span className="project-color-dot" />
        <span>
          <strong>{displayWithEmoji(project.name, project.emoji)}</strong>
          <small>{showDate ? formatProjectDate(project.updatedAt) : `${safeStats.openTasks} open / ${safeStats.completedTasks} done`}</small>
        </span>
        <em>{safeStats.progress}%</em>
      </button>
    );
  }
}

function PagePanel({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <article className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{title}</p>
          <h3>{description}</h3>
        </div>
      </div>
      {children}
    </article>
  );
}

function normalizeTaskForm(values: TaskFormValues) {
  const repeatFrequency = values.repeatEnabled ? values.repeatFrequency : "none";
  const repeatCount = values.repeatEndType === "afterCount" ? Math.max(1, Number(values.repeatCount || 1)) : null;
  const repeatDayOfMonth = values.repeatFrequency === "monthly" && values.repeatDayOfMonth ? Math.min(31, Math.max(1, Number(values.repeatDayOfMonth))) : null;

  return {
    title: values.title.trim(),
    description: values.description.trim(),
    status: values.status,
    priority: values.priority,
    dueDate: values.dueDate,
    dueTime: values.dueDate && values.dueTime ? values.dueTime : null,
    tags: normalizeTags(values.tags),
    estimatedMinutes: Math.max(0, Number(values.estimatedMinutes || 0)),
    energyLevel: values.energyLevel,
    notes: values.notes.trim(),
    projectId: values.projectId || null,
    emoji: values.emoji || null,
    icon: values.icon || null,
    repeatEnabled: values.repeatEnabled && repeatFrequency !== "none",
    repeatFrequency,
    repeatInterval: Math.max(1, Number(values.repeatInterval || 1)),
    repeatDaysOfWeek: repeatFrequency === "weekly" ? values.repeatDaysOfWeek : [],
    repeatDayOfMonth,
    repeatEndType: values.repeatEnabled ? values.repeatEndType : "never",
    repeatEndDate: values.repeatEndType === "onDate" && values.repeatEndDate ? values.repeatEndDate : null,
    repeatCount,
    completedOccurrences: Math.max(0, Number(values.completedOccurrences || 0)),
    nextDueDate: values.repeatEnabled ? values.nextDueDate || values.dueDate || null : null,
    lastGeneratedDate: values.lastGeneratedDate || null,
    recurringParentId: values.recurringParentId || null,
    isRecurringInstance: values.isRecurringInstance,
    reminders: values.reminders.map((reminder) => ({
      ...reminder,
      taskId: reminder.taskId || "",
      updatedAt: new Date().toISOString(),
    })),
  };
}

function attachReminderTaskIds(reminders: Reminder[], taskId: string) {
  return reminders.map((reminder) => ({
    ...reminder,
    taskId,
  }));
}

function resetRemindersForNextOccurrence(task: Task, nextDueDate: string | null) {
  const now = getNowISOString();

  return task.reminders.map((reminder) => {
    const nextRemindAt =
      nextDueDate && reminder.type !== "custom"
        ? calculateReminderTime(nextDueDate, task.dueTime, reminder.minutesBefore ?? 0)
        : reminder.remindAt;

    return {
      ...reminder,
      remindAt: nextRemindAt || reminder.remindAt,
      firedAt: null,
      dismissedAt: null,
      snoozedUntil: null,
      updatedAt: now,
    };
  });
}

function normalizeHabitForm(values: HabitFormValues) {
  const targetPerWeek = Math.max(1, Math.min(7, Number(values.targetPerWeek || 1)));

  return {
    name: values.name.trim(),
    description: values.description.trim(),
    emoji: values.emoji || null,
    color: values.color || "#10b981",
    frequency: values.frequency,
    targetPerWeek,
    active: values.active,
  };
}

function getNavBadge(value: number | string | undefined) {
  if (typeof value === "number") {
    return value > 0 ? String(value) : "";
  }

  return value ?? "";
}

function isFirebaseErrorCode(error: unknown, code: string) {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === code;
}

function isEmailPasswordUser(user: User) {
  return Boolean(user.email) && (user.providerData.length === 0 || user.providerData.some((provider) => provider.providerId === "password"));
}

function getPageFromHash(): PageId {
  const hash = window.location.hash.replace("#", "");
  if (hash === "privacy" || hash === "terms") {
    return hash;
  }
  return navItems.some((item) => item.id === hash) ? (hash as PageId) : "dashboard";
}

function getPageLabel(page: PageId) {
  if (page === "privacy") {
    return "Privacy";
  }
  if (page === "terms") {
    return "Terms";
  }
  return navItems.find((item) => item.id === page)?.label ?? "Dashboard";
}

function getPageHeadline(page: PageId) {
  switch (page) {
    case "dashboard":
      return "Today, focus, and review in one place.";
    case "projects":
      return "Plan outcomes, track progress, and connect tasks to real work.";
    case "saved-views":
      return "Save reusable filters and browse tasks by tags, priority, due dates, and context.";
    case "inbox":
      return "Capture raw tasks quickly and clarify them later.";
    case "today":
      return "Plan your Top 3, Deep Work, time blocks, and daily reflection.";
    case "upcoming":
      return "Keep future commitments visible without crowding today.";
    case "focus":
      return "Start Pomodoro sessions, protect Deep Work, and track focused minutes.";
    case "insights":
      return "Overview for decisions. Reporting for deeper filters.";
    case "habits":
      return "Build small habits that compound.";
    case "weekly-review":
      return "Reflect on the week, review patterns, and choose next-week priorities.";
    case "settings":
      return "Install, back up, restore, and manage account safety.";
    case "privacy":
      return "How LifeOS stores and handles your personal workspace data.";
    case "terms":
      return "Simple terms for using LifeOS as a personal productivity app.";
  }
}

function createLocalId() {
  return globalThis.crypto?.randomUUID?.() ?? `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getFocusBlockTimes(minutes: number) {
  const start = new Date();
  const roundedMinutes = Math.ceil(start.getMinutes() / 5) * 5;
  start.setMinutes(roundedMinutes, 0, 0);
  const end = new Date(start);
  end.setMinutes(end.getMinutes() + Math.max(25, minutes || 50));

  return {
    startTime: formatTimeInput(start),
    endTime: formatTimeInput(end),
  };
}

function formatTimeInput(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
