import {
  BarChart3,
  CalendarClock,
  Check,
  CheckCircle2,
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
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { addDoc, collection, deleteDoc, doc, serverTimestamp, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { auth, db, firebaseEnvStatus } from "./firebase";
import { starterProjects } from "./constants";
import { getProjectStats, useDailyPlan, useUserFavoriteQuotes, useUserFocusSessions, useUserProjects, useUserSavedFilters, useUserTasks } from "./dataHooks";
import { parseQuickCapture } from "./taskParser";
import type {
  DailyPlan,
  DailyReflection,
  ConfirmDialogState,
  FilterCriteria,
  FocusMode,
  FocusSession,
  Project,
  ProjectFormValues,
  ProjectStats,
  SavedFilter,
  SavedFilterFormValues,
  Task,
  TaskFormValues,
  TaskStatus,
  TimeBlock,
  TimeBlockFormValues,
} from "./types";
import { applyTaskFilters, cleanFilterCriteria, getTaskCountsByFilter, getTaskCountsByTag, getDueDateGroup, normalizeTags } from "./filterUtils";
import { formatProjectDate, getFriendlyError, getNowISOString, getTodayISODate } from "./utils";
import { calculateTodayStats, formatMinutes, getTodayDateId } from "./todayUtils";
import { calculateElapsedSeconds, createFocusSessionPayload, getTodayFocusStats, secondsToStoredMinutes } from "./focusUtils";
import { generateInsightMessages } from "./insightsUtils";
import { displayWithEmoji } from "./emojiPresets";
import { getDailyQuote, getRandomQuote } from "./quotes";
import { AuthScreen } from "./components/AuthScreen";
import { EmptyState, FullScreenState, MetricCard, StatusBanner } from "./components/Common";
import { FocusPage } from "./components/FocusComponents";
import { InsightsPage, InsightMessageList } from "./components/InsightsComponents";
import { ConfirmDialog } from "./components/ModalComponents";
import { ProjectForm, ProjectsPage } from "./components/ProjectComponents";
import { DailyQuoteCard } from "./components/QuoteComponents";
import { SavedViewForm, SavedViewsPage } from "./components/SavedViewsComponents";
import { QuickCapture, TaskEditor, TaskSection } from "./components/TaskComponents";
import { TagList } from "./components/TaskBrowseComponents";
import { TodayPage } from "./components/TodayComponents";

type PageId = "dashboard" | "inbox" | "today" | "upcoming" | "projects" | "saved-views" | "focus" | "insights" | "settings";

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

const navItems: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "today", label: "Today", icon: CheckCircle2 },
  { id: "upcoming", label: "Upcoming", icon: CalendarClock },
  { id: "projects", label: "Projects", icon: FolderKanban },
  { id: "saved-views", label: "Saved Views", icon: ListFilter },
  { id: "focus", label: "Focus", icon: Timer },
  { id: "insights", label: "Insights", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Settings },
];

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthLoading(false);
    });
  }, []);

  if (authLoading) {
    return <FullScreenState title="Loading LifeOS" message="Checking your secure session." />;
  }

  if (!user) {
    return <AuthScreen />;
  }

  return <ProtectedLifeOS user={user} />;
}

function ProtectedLifeOS({ user }: { user: User }) {
  const [activePage, setActivePage] = useState<PageId>(() => getPageFromHash());
  const [taskEditor, setTaskEditor] = useState<TaskEditorState | null>(null);
  const [projectEditor, setProjectEditor] = useState<ProjectEditorState | null>(null);
  const [savedFilterEditor, setSavedFilterEditor] = useState<SavedFilterEditorState | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedSavedFilterId, setSelectedSavedFilterId] = useState<string | null>(null);
  const [selectedFocusTaskId, setSelectedFocusTaskId] = useState<string | null>(null);
  const [taskFilters, setTaskFilters] = useState<FilterCriteria>({});
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [quoteOffset, setQuoteOffset] = useState(0);
  const [creatingStarterProjects, setCreatingStarterProjects] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [todayDateId] = useState(() => getTodayDateId());

  const taskState = useUserTasks(user);
  const projectState = useUserProjects(user);
  const savedFilterState = useUserSavedFilters(user);
  const dailyPlanState = useDailyPlan(user, todayDateId);
  const focusSessionState = useUserFocusSessions(user);
  const favoriteQuoteState = useUserFavoriteQuotes(user);
  const { tasks } = taskState;
  const { projects } = projectState;
  const { filters: savedFilters } = savedFilterState;
  const { sessions: focusSessions } = focusSessionState;
  const { favorites: favoriteQuotes } = favoriteQuoteState;
  const dailyPlan = dailyPlanState.plan;
  const dailyQuote = useMemo(() => getDailyQuote(todayDateId, quoteOffset), [quoteOffset, todayDateId]);

  useEffect(() => {
    const handleHashChange = () => setActivePage(getPageFromHash());
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

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
  const todayTasks = tasks.filter((task) => task.status === "today");
  const doneTasks = tasks.filter((task) => task.status === "done");
  const highPriorityTasks = openTasks.filter((task) => task.priority === "high");
  const noProjectTasks = openTasks.filter((task) => !task.projectId);
  const overdueTasks = openTasks.filter((task) => getDueDateGroup(task.dueDate) === "overdue");
  const todayStats = useMemo(() => calculateTodayStats(tasks, dailyPlan, todayDateId), [dailyPlan, tasks, todayDateId]);
  const todayFocusStats = useMemo(() => getTodayFocusStats(focusSessions, todayDateId), [focusSessions, todayDateId]);
  const insightMessages = useMemo(
    () =>
      generateInsightMessages({
        tasks,
        projects,
        sessions: focusSessions,
        dailyPlan,
        tagCounts,
        todayDateId,
      }),
    [dailyPlan, focusSessions, projects, tagCounts, tasks, todayDateId]
  );
  const isDailyQuoteFavorite = favoriteQuotes.some((favorite) => favorite.quoteId === dailyQuote.id);
  const completionRate = tasks.length > 0 ? Math.round((doneTasks.length / tasks.length) * 100) : 0;
  const nextTask = openTasks.find((task) => task.priority === "urgent" || task.priority === "high") ?? todayTasks[0] ?? openTasks[0] ?? null;
  const pageTitle = navItems.find((item) => item.id === activePage)?.label ?? "Dashboard";
  const defaultCreateStatus: TaskStatus = activePage === "today" || activePage === "upcoming" || activePage === "inbox" ? activePage : "inbox";

  const visibleTasks = useMemo(() => {
    const baseTasks =
      activePage === "dashboard"
        ? tasks.filter((task) => task.status !== "archived")
        : activePage === "settings"
          ? tasks.filter((task) => task.status === "archived")
          : activePage === "projects" || activePage === "saved-views" || activePage === "focus"
            ? []
            : tasks.filter((task) => task.status === activePage);

    return applyTaskFilters(baseTasks, taskFilters);
  }, [activePage, taskFilters, tasks]);

  async function createTaskFromQuick(rawInput: string, defaultStatus: TaskStatus) {
    const parsed = parseQuickCapture(rawInput, selectableProjects);
    if (!parsed.title) {
      throw new Error("Add a task title before saving.");
    }

    await addDoc(collection(db, "users", user.uid, "tasks"), {
      title: parsed.title,
      description: "",
      status: defaultStatus,
      priority: parsed.priority,
      dueDate: defaultStatus === "today" ? getTodayISODate() : "",
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
    const payload = normalizeTaskForm(values);
    if (!payload.title) {
      throw new Error("Task title is required.");
    }

    const completedAt =
      payload.status === "done" ? (task?.status === "done" ? task.completedAt ?? serverTimestamp() : serverTimestamp()) : null;

    if (task) {
      await updateDoc(doc(db, "users", user.uid, "tasks", task.id), {
        ...payload,
        completedAt,
        updatedAt: serverTimestamp(),
        userId: user.uid,
      });
      setActionMessage("Task updated.");
    } else {
      await addDoc(collection(db, "users", user.uid, "tasks"), {
        ...payload,
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
    await updateDoc(doc(db, "users", user.uid, "tasks", task.id), {
      ...updates,
      updatedAt: serverTimestamp(),
      userId: user.uid,
    });
  }

  function requestConfirmation(dialog: ConfirmDialogState) {
    setConfirmDialog(dialog);
  }

  async function handleConfirmDialog() {
    if (!confirmDialog) {
      return;
    }

    setConfirmBusy(true);
    try {
      await confirmDialog.onConfirm();
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
    void runAction(
      () =>
        updateDoc(doc(db, "users", user.uid, "focusSessions", session.id), {
          status: "completed",
          actualMinutes: secondsToStoredMinutes(elapsedSeconds),
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
    await updateDoc(doc(db, "users", user.uid, "focusSessions", session.id), {
      notes: notes.trim(),
      updatedAt: serverTimestamp(),
      userId: user.uid,
    });
    setActionMessage("Focus notes saved.");
  }

  function markTaskDoneFromFocus(task: Task) {
    void runAction(() => updateTask(task, { status: "done", completedAt: serverTimestamp() }), "Task marked done.");
  }

  async function saveProject(values: ProjectFormValues, project: Project | null) {
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
      setActionError("");
      setActionMessage("");
      await action();
      setActionMessage(successMessage);
    } catch (error) {
      setActionError(getFriendlyError(error));
    }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Primary">
        <div className="brand-row">
          <img src="/lifeos-mark.svg" alt="" className="brand-mark" />
          <div>
            <p className="eyebrow">Phase 5 workspace</p>
            <h1>LifeOS v2</h1>
          </div>
        </div>

        <nav className="nav-list">
          {navItems.map(({ id, label, icon: Icon }) => (
            <a className={activePage === id ? "active" : ""} href={`#${id}`} key={id}>
              <Icon size={18} />
              <span>{label}</span>
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
          ) : (
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
        {focusSessionState.error ? <StatusBanner tone="error" message={focusSessionState.error} /> : null}
        {favoriteQuoteState.error ? <StatusBanner tone="error" message={favoriteQuoteState.error} /> : null}

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
            insightMessages={insightMessages}
            quote={dailyQuote}
            quoteFavorite={isDailyQuoteFavorite}
            onQuickCreate={(value) => createTaskFromQuick(value, "inbox")}
            onOpenFocusTask={openFocusForTask}
            onOpenInsights={() => {
              window.location.hash = "insights";
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
            onMarkDone={(task) => void runAction(() => updateTask(task, { status: "done", completedAt: serverTimestamp() }), "Task marked done.")}
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
            tasks={tasks}
            projects={projects}
            focusSessions={focusSessions}
            dailyPlan={dailyPlan}
            tagCounts={tagCounts}
            todayDateId={todayDateId}
            messages={insightMessages}
            quote={dailyQuote}
            quoteFavorite={isDailyQuoteFavorite}
            onRefreshQuote={refreshQuote}
            onToggleFavoriteQuote={toggleFavoriteQuote}
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
              onMarkDone: (task) => void runAction(() => updateTask(task, { status: "done", completedAt: serverTimestamp() }), "Task marked done."),
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

        {activePage === "settings" ? <SettingsPage user={user} tasks={tasks} projects={projects} savedFilters={savedFilters} tagCount={tagCounts.length} /> : null}

        {activePage !== "projects" && activePage !== "saved-views" && activePage !== "today" && activePage !== "focus" && activePage !== "insights" ? (
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
              void runAction(() => updateTask(task, { status: "done", completedAt: serverTimestamp() }), "Task marked done.")
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

      {confirmDialog ? (
        <ConfirmDialog dialog={confirmDialog} busy={confirmBusy} onCancel={closeConfirmDialog} onConfirm={() => void handleConfirmDialog()} />
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
    insightMessages,
    quote,
    quoteFavorite,
    onQuickCreate,
    onOpenFocusTask,
    onOpenInsights,
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
    insightMessages: ReturnType<typeof generateInsightMessages>;
    quote: typeof dailyQuote;
    quoteFavorite: boolean;
    onQuickCreate: (value: string) => Promise<void>;
    onOpenFocusTask: (task: Task) => void;
    onOpenInsights: () => void;
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
          <MetricCard icon={ListFilter} label="Saved views" value={String(savedFilters.length)} detail="Custom task filters" />
          <MetricCard icon={Timer} label="Focus today" value={formatMinutes(focusStats.totalFocusedMinutes)} detail="Completed focus time" />
          <MetricCard icon={Check} label="Focus sessions" value={String(focusStats.completedSessions)} detail="Completed today" />
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
                <h3>Pattern notes</h3>
              </div>
              <button className="secondary-button" type="button" onClick={onOpenInsights}>
                <BarChart3 size={17} />
                Insights
              </button>
            </div>
            <InsightMessageList messages={insightMessages.slice(0, 3)} />
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

function SettingsPage({
  user,
  tasks,
  projects,
  savedFilters,
  tagCount,
}: {
  user: User;
  tasks: Task[];
  projects: Project[];
  savedFilters: SavedFilter[];
  tagCount: number;
}) {
  const openCount = tasks.filter((task) => !["done", "archived"].includes(task.status)).length;
  const activeProjectCount = projects.filter((project) => project.status === "active" || project.status === "paused").length;
  const configuredCount = firebaseEnvStatus.filter((item) => item.configured).length;

  return (
    <section className="content-grid settings-grid">
      <article className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Account</p>
            <h3>Signed-in profile</h3>
          </div>
          <ShieldCheck size={20} />
        </div>
        <dl className="settings-list">
          <div>
            <dt>Email</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>User ID</dt>
            <dd>{user.uid}</dd>
          </div>
          <div>
            <dt>Open tasks</dt>
            <dd>{openCount}</dd>
          </div>
          <div>
            <dt>Active projects</dt>
            <dd>{activeProjectCount}</dd>
          </div>
          <div>
            <dt>Saved views</dt>
            <dd>{savedFilters.length}</dd>
          </div>
          <div>
            <dt>Tags</dt>
            <dd>{tagCount}</dd>
          </div>
        </dl>
      </article>

      <article className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Firebase</p>
            <h3>Environment</h3>
          </div>
          <Sparkles size={20} />
        </div>
        <p className="panel-copy">
          {configuredCount} of {firebaseEnvStatus.length} Firebase variables are present in the Vite environment.
        </p>
        <div className="env-list">
          {firebaseEnvStatus.map((item) => (
            <span className={item.configured ? "configured" : ""} key={item.key}>
              {item.key}
            </span>
          ))}
        </div>
      </article>
    </section>
  );
}

function normalizeTaskForm(values: TaskFormValues) {
  return {
    title: values.title.trim(),
    description: values.description.trim(),
    status: values.status,
    priority: values.priority,
    dueDate: values.dueDate,
    tags: normalizeTags(values.tags),
    estimatedMinutes: Math.max(0, Number(values.estimatedMinutes || 0)),
    energyLevel: values.energyLevel,
    notes: values.notes.trim(),
    projectId: values.projectId || null,
    emoji: values.emoji || null,
    icon: values.icon || null,
  };
}

function getPageFromHash(): PageId {
  const hash = window.location.hash.replace("#", "");
  return navItems.some((item) => item.id === hash) ? (hash as PageId) : "dashboard";
}

function getPageHeadline(page: PageId) {
  switch (page) {
    case "dashboard":
      return "A Firestore-backed command center for tasks and projects.";
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
      return "Notice patterns across tasks, projects, planning, and focus.";
    case "settings":
      return "Confirm account, Firebase, and archived task state.";
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
