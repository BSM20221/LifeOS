import { Bell, BellOff, Check, Clock3, Pause, Play, RotateCcw, Save, Square, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import type { FocusMode, FocusSession, FocusStats as FocusStatsData, Project, Task } from "../types";
import {
  calculateRemainingSeconds,
  focusModeDurations,
  formatTimerSeconds,
  getCompletedFocusMinutes,
  getFocusModeLabel,
} from "../focusUtils";
import { displayWithEmoji } from "../emojiPresets";
import { ReminderBadge } from "./ReminderComponents";
import { formatMinutes } from "../todayUtils";
import { getFriendlyError } from "../utils";
import { EmptyState, StatusBanner } from "./Common";

type StartFocusValues = {
  taskId: string;
  mode: FocusMode;
  plannedMinutes: number;
  notes: string;
};

export function FocusPage({
  sessions,
  loading,
  tasks,
  projects,
  selectedTaskId,
  todayDateId,
  stats,
  onSelectTask,
  onStartSession,
  onPauseSession,
  onResumeSession,
  onCancelSession,
  onCompleteSession,
  onDeleteSession,
  onSaveSessionNotes,
  onMarkTaskDone,
}: {
  sessions: FocusSession[];
  loading: boolean;
  tasks: Task[];
  projects: Project[];
  selectedTaskId: string | null;
  todayDateId: string;
  stats: FocusStatsData;
  onSelectTask: (taskId: string | null) => void;
  onStartSession: (values: StartFocusValues) => Promise<void>;
  onPauseSession: (session: FocusSession) => void;
  onResumeSession: (session: FocusSession) => void;
  onCancelSession: (session: FocusSession) => void;
  onCompleteSession: (session: FocusSession) => void;
  onDeleteSession: (session: FocusSession) => void;
  onSaveSessionNotes: (session: FocusSession, notes: string) => Promise<void>;
  onMarkTaskDone: (task: Task) => void;
}) {
  const [mode, setMode] = useState<FocusMode>("pomodoro");
  const [customMinutes, setCustomMinutes] = useState("25");
  const [notes, setNotes] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">(() => getInitialNotificationPermission());
  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const projectById = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);
  const activeSession = sessions.find((session) => session.status === "running" || session.status === "paused") ?? null;
  const selectedTask = activeSession?.taskId ? taskById.get(activeSession.taskId) ?? null : selectedTaskId ? taskById.get(selectedTaskId) ?? null : null;
  const todaySessions = useMemo(
    () => sessions.filter((session) => session.dailyPlanDate === todayDateId),
    [sessions, todayDateId]
  );

  async function startSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const plannedMinutes = mode === "custom" ? Number(customMinutes) : focusModeDurations[mode];
    setNotice("");
    setError("");

    if (!Number.isFinite(plannedMinutes) || plannedMinutes < 1) {
      setError("Choose a focus length of at least 1 minute.");
      return;
    }

    try {
      await onStartSession({
        taskId: selectedTaskId ?? "",
        mode,
        plannedMinutes,
        notes: notes.trim(),
      });
      setNotes("");
      setNotice("Focus session started.");
    } catch (startError) {
      setError(getFriendlyError(startError));
    }
  }

  function completeSession(session: FocusSession) {
    onCompleteSession(session);
    setNotice("Focus session complete.");

    if (notificationPermission === "granted") {
      new Notification("Focus session complete");
    }
  }

  function resetDraft() {
    setMode("pomodoro");
    setCustomMinutes("25");
    setNotes("");
    setNotice("Focus timer reset.");
  }

  return (
    <section className="focus-page">
      <section className="focus-layout">
        <article className="panel focus-timer-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Focus timer</p>
              <h3>{activeSession ? "Session in progress" : "Start a calm work block"}</h3>
            </div>
            <NotificationPermissionButton
              permission={notificationPermission}
              onPermissionChange={(permission) => {
                setNotificationPermission(permission);
                setNotice(permission === "granted" ? "Focus notifications enabled." : "Notifications are not enabled. The timer still works.");
              }}
            />
          </div>

          {notice ? <StatusBanner tone="success" message={notice} /> : null}
          {error ? <StatusBanner tone="error" message={error} /> : null}
          {activeSession ? <StatusBanner tone="info" message="Recovered active focus session from Firestore." /> : null}

          <FocusTimer session={activeSession} onCompleteSession={completeSession} />

          <form className="focus-setup-form" onSubmit={startSession}>
            <label>
              Task
              <select
                value={selectedTaskId ?? ""}
                onChange={(event) => onSelectTask(event.target.value || null)}
                disabled={Boolean(activeSession)}
              >
                <option value="">No linked task</option>
                {tasks
                  .filter((task) => task.status !== "archived")
                  .map((task) => (
                    <option key={task.id} value={task.id}>
                      {displayWithEmoji(task.title, task.emoji)}
                    </option>
                  ))}
              </select>
            </label>

            {selectedTask ? (
              <SelectedFocusTask task={selectedTask} project={selectedTask.projectId ? projectById.get(selectedTask.projectId) ?? null : null} />
            ) : (
              <EmptyState title="No task selected" message="You can focus without a task, or choose one from the list." />
            )}

            <FocusModeSelector mode={mode} customMinutes={customMinutes} disabled={Boolean(activeSession)} onModeChange={setMode} onCustomMinutesChange={setCustomMinutes} />

            <label>
              Session notes
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} disabled={Boolean(activeSession)} />
            </label>

            <div className="focus-actions">
              {!activeSession ? (
                <button className="primary-button" type="submit">
                  <Play size={17} />
                  Start
                </button>
              ) : null}
              {activeSession?.status === "running" ? (
                <button className="secondary-button" type="button" onClick={() => onPauseSession(activeSession)}>
                  <Pause size={17} />
                  Pause
                </button>
              ) : null}
              {activeSession?.status === "paused" ? (
                <button className="primary-button" type="button" onClick={() => onResumeSession(activeSession)}>
                  <Play size={17} />
                  Resume
                </button>
              ) : null}
              {activeSession ? (
                <>
                  <button className="secondary-button" type="button" onClick={() => onCancelSession(activeSession)}>
                    <Square size={17} />
                    Cancel
                  </button>
                  <button className="primary-button" type="button" onClick={() => completeSession(activeSession)}>
                    <Check size={17} />
                    Complete
                  </button>
                </>
              ) : (
                <button className="secondary-button" type="button" onClick={resetDraft}>
                  <RotateCcw size={17} />
                  Reset
                </button>
              )}
            </div>
          </form>
        </article>

        <aside className="panel focus-stats-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Today</p>
              <h3>Focus progress</h3>
            </div>
          </div>
          <FocusStats stats={stats} projects={projects} tasks={tasks} />
        </aside>
      </section>

      <FocusSessionList
        sessions={todaySessions}
        loading={loading}
        taskById={taskById}
        projectById={projectById}
        onCancelSession={onCancelSession}
        onDeleteSession={onDeleteSession}
        onSaveSessionNotes={onSaveSessionNotes}
        onMarkTaskDone={onMarkTaskDone}
      />
    </section>
  );
}

export function FocusTimer({
  session,
  onCompleteSession,
}: {
  session: FocusSession | null;
  onCompleteSession: (session: FocusSession) => void;
}) {
  const [now, setNow] = useState(() => new Date());
  const [completedSessionId, setCompletedSessionId] = useState("");
  const remainingSeconds = session ? calculateRemainingSeconds(session, now) : focusModeDurations.pomodoro * 60;
  const progress = session ? Math.min(100, Math.max(0, 100 - (remainingSeconds / (session.plannedMinutes * 60)) * 100)) : 0;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!session || session.status !== "running" || remainingSeconds > 0 || completedSessionId === session.id) {
      return;
    }

    setCompletedSessionId(session.id);
    onCompleteSession(session);
  }, [completedSessionId, onCompleteSession, remainingSeconds, session]);

  return (
    <section className="focus-timer" aria-live="polite">
      <span className={`focus-status ${session?.status ?? "idle"}`}>{session ? session.status : "ready"}</span>
      <strong>{formatTimerSeconds(remainingSeconds)}</strong>
      <div className="focus-progress-track" aria-label={`Timer progress ${Math.round(progress)}%`}>
        <span style={{ width: `${progress}%` }} />
      </div>
      <small>{session ? `${getFocusModeLabel(session.mode)} · ${session.plannedMinutes} planned minutes` : "Pomodoro · 25 planned minutes"}</small>
    </section>
  );
}

export function FocusModeSelector({
  mode,
  customMinutes,
  disabled,
  onModeChange,
  onCustomMinutesChange,
}: {
  mode: FocusMode;
  customMinutes: string;
  disabled: boolean;
  onModeChange: (mode: FocusMode) => void;
  onCustomMinutesChange: (minutes: string) => void;
}) {
  const modes: FocusMode[] = ["pomodoro", "short-break", "long-break", "custom"];

  return (
    <fieldset className="focus-mode-selector">
      <legend>Mode</legend>
      <div>
        {modes.map((nextMode) => (
          <button
            className={mode === nextMode ? "active" : ""}
            type="button"
            disabled={disabled}
            key={nextMode}
            onClick={() => onModeChange(nextMode)}
          >
            {getFocusModeLabel(nextMode)}
            <span>{nextMode === "custom" ? `${customMinutes || 0} min` : `${focusModeDurations[nextMode]} min`}</span>
          </button>
        ))}
      </div>
      {mode === "custom" ? (
        <label>
          Custom minutes
          <input min="1" max="240" type="number" value={customMinutes} disabled={disabled} onChange={(event) => onCustomMinutesChange(event.target.value)} />
        </label>
      ) : null}
    </fieldset>
  );
}

export function FocusStats({
  stats,
  projects,
  tasks,
}: {
  stats: FocusStatsData;
  projects: Project[];
  tasks: Task[];
}) {
  const projectRows = Object.entries(stats.minutesByProject).slice(0, 4);
  const taskRows = Object.entries(stats.minutesByTask).slice(0, 4);
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const taskById = new Map(tasks.map((task) => [task.id, task]));

  return (
    <section className="focus-stats">
      <div className="dashboard-today-plan">
        <div>
          <strong>{formatMinutes(stats.totalFocusedMinutes)}</strong>
          <span>focused today</span>
        </div>
        <div>
          <strong>{stats.completedSessions}</strong>
          <span>completed sessions</span>
        </div>
      </div>

      <div className="focus-stat-list">
        <h4>By project</h4>
        {projectRows.length === 0 ? <span className="muted-line">No project focus yet.</span> : null}
        {projectRows.map(([projectId, minutes]) => {
          const project = projectById.get(projectId);
          return (
            <span key={projectId}>
              <em className="project-badge" style={{ "--project-color": project?.color ?? "#59635d" } as CSSProperties}>
                {project ? displayWithEmoji(project.name, project.emoji) : "Unknown project"}
              </em>
              <strong>{formatMinutes(minutes)}</strong>
            </span>
          );
        })}
      </div>

      <div className="focus-stat-list">
        <h4>By task</h4>
        {taskRows.length === 0 ? <span className="muted-line">No task focus yet.</span> : null}
        {taskRows.map(([taskId, minutes]) => (
          <span key={taskId}>
            <small>{displayWithEmoji(taskById.get(taskId)?.title ?? "Deleted task", taskById.get(taskId)?.emoji)}</small>
            <strong>{formatMinutes(minutes)}</strong>
          </span>
        ))}
      </div>
    </section>
  );
}

export function FocusSessionList({
  sessions,
  loading,
  taskById,
  projectById,
  onCancelSession,
  onDeleteSession,
  onSaveSessionNotes,
  onMarkTaskDone,
}: {
  sessions: FocusSession[];
  loading: boolean;
  taskById: Map<string, Task>;
  projectById: Map<string, Project>;
  onCancelSession: (session: FocusSession) => void;
  onDeleteSession: (session: FocusSession) => void;
  onSaveSessionNotes: (session: FocusSession, notes: string) => Promise<void>;
  onMarkTaskDone: (task: Task) => void;
}) {
  return (
    <article className="panel focus-session-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Sessions</p>
          <h3>Today's focus sessions</h3>
        </div>
      </div>
      {loading ? <EmptyState title="Loading focus sessions" message="Reading your user-specific Firestore focus sessions." /> : null}
      {!loading && sessions.length === 0 ? <EmptyState title="No focus sessions today" message="Start a Pomodoro to begin tracking focused minutes." /> : null}
      <div className="focus-session-list">
        {sessions.map((session) => {
          const task = session.taskId ? taskById.get(session.taskId) ?? null : null;
          const project = session.projectId ? projectById.get(session.projectId) ?? null : null;
          return (
            <FocusSessionCard
              key={session.id}
              session={session}
              task={task}
              project={project}
              onCancelSession={onCancelSession}
              onDeleteSession={onDeleteSession}
              onSaveNotes={onSaveSessionNotes}
              onMarkTaskDone={onMarkTaskDone}
            />
          );
        })}
      </div>
    </article>
  );
}

export function FocusSessionCard({
  session,
  task,
  project,
  onCancelSession,
  onDeleteSession,
  onSaveNotes,
  onMarkTaskDone,
}: {
  session: FocusSession;
  task: Task | null;
  project: Project | null;
  onCancelSession: (session: FocusSession) => void;
  onDeleteSession: (session: FocusSession) => void;
  onSaveNotes: (session: FocusSession, notes: string) => Promise<void>;
  onMarkTaskDone: (task: Task) => void;
}) {
  const [notes, setNotes] = useState(session.notes);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setNotes(session.notes);
  }, [session.notes]);

  async function saveNotes() {
    setSaving(true);
    await onSaveNotes(session, notes);
    setSaving(false);
  }

  return (
    <section className={`focus-session-card ${session.status}`}>
      <div className="focus-session-main">
        <strong>{task ? displayWithEmoji(task.title, task.emoji) : "Unlinked focus session"}</strong>
        <div className="task-meta">
          {project ? (
            <em className="project-badge" style={{ "--project-color": project.color } as CSSProperties}>
              {displayWithEmoji(project.name, project.emoji)}
            </em>
          ) : null}
          <span>{getFocusModeLabel(session.mode)}</span>
          <span>{session.plannedMinutes} planned</span>
          <span>{getCompletedFocusMinutes(session)} actual</span>
          <em className={`status-pill ${session.status}`}>{session.status}</em>
          {session.completedAt ? <span>Completed {formatSessionTime(session.completedAt)}</span> : null}
        </div>
        <label>
          Notes
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
        </label>
      </div>
      <div className="focus-session-actions">
        <button className="secondary-button" type="button" disabled={saving} onClick={saveNotes}>
          <Save size={16} />
          {saving ? "Saving..." : "Save notes"}
        </button>
        {session.status === "running" || session.status === "paused" ? (
          <button className="secondary-button" type="button" onClick={() => onCancelSession(session)}>
            <Square size={16} />
            Cancel
          </button>
        ) : null}
        {session.status === "completed" && task && task.status !== "done" && task.status !== "archived" ? (
          <button className="primary-button" type="button" onClick={() => onMarkTaskDone(task)}>
            <Check size={16} />
            Mark task done
          </button>
        ) : null}
        <button className="icon-button task-icon-button danger" type="button" aria-label="Delete focus session" onClick={() => onDeleteSession(session)}>
          <Trash2 size={16} />
        </button>
      </div>
    </section>
  );
}

export function NotificationPermissionButton({
  permission,
  onPermissionChange,
}: {
  permission: NotificationPermission | "unsupported";
  onPermissionChange: (permission: NotificationPermission | "unsupported") => void;
}) {
  async function requestPermission() {
    if (!("Notification" in window)) {
      onPermissionChange("unsupported");
      return;
    }

    const nextPermission = await Notification.requestPermission();
    onPermissionChange(nextPermission);
  }

  if (permission === "granted") {
    return (
      <button className="secondary-button" type="button" disabled>
        <Bell size={17} />
        Notifications on
      </button>
    );
  }

  if (permission === "unsupported") {
    return (
      <button className="secondary-button" type="button" disabled>
        <BellOff size={17} />
        Notifications unavailable
      </button>
    );
  }

  return (
    <button className="secondary-button" type="button" onClick={requestPermission}>
      <Bell size={17} />
      Enable focus notifications
    </button>
  );
}

function SelectedFocusTask({ task, project }: { task: Task; project: Project | null }) {
  return (
    <section className="selected-focus-task">
      <Clock3 size={18} />
      <div>
        <strong>{displayWithEmoji(task.title, task.emoji)}</strong>
        <div className="task-meta">
          {project ? (
            <em className="project-badge" style={{ "--project-color": project.color } as CSSProperties}>
              {displayWithEmoji(project.name, project.emoji)}
            </em>
          ) : null}
          <em className={`priority ${task.priority}`}>{task.priority}</em>
          {task.dueDate ? <span>Due {task.dueDate}{task.dueTime ? ` at ${task.dueTime}` : ""}</span> : null}
          <span>{task.estimatedMinutes} min estimate</span>
          <ReminderBadge task={task} />
        </div>
      </div>
    </section>
  );
}

function getInitialNotificationPermission(): NotificationPermission | "unsupported" {
  if (!("Notification" in window)) {
    return "unsupported";
  }

  return Notification.permission;
}

function formatSessionTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
}
