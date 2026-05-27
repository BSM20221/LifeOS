import {
  Archive,
  ArrowRight,
  CalendarClock,
  Check,
  CheckCircle2,
  Clock3,
  Inbox,
  LayoutDashboard,
  LogOut,
  Pencil,
  Plus,
  Save,
  Settings,
  ShieldCheck,
  Sparkles,
  Tag,
  Trash2,
  Undo2,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { FirebaseError } from "firebase/app";
import { auth, db, firebaseEnvStatus } from "./firebase";
import { parseQuickTask } from "./taskParser";
import type { EnergyLevel, Task, TaskFormValues, TaskPriority, TaskStatus } from "./types";

type PageId = "dashboard" | "inbox" | "today" | "upcoming" | "settings";

type NavItem = {
  id: PageId;
  label: string;
  icon: LucideIcon;
};

type EditorState = {
  task: Task | null;
  defaultStatus: TaskStatus;
};

const navItems: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "today", label: "Today", icon: CheckCircle2 },
  { id: "upcoming", label: "Upcoming", icon: CalendarClock },
  { id: "settings", label: "Settings", icon: Settings },
];

const taskStatuses: TaskStatus[] = ["inbox", "today", "upcoming", "done", "archived"];
const priorities: TaskPriority[] = ["low", "medium", "high", "urgent"];
const energyLevels: EnergyLevel[] = ["low", "medium", "high"];

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
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [actionError, setActionError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const { tasks, loading, error } = useUserTasks(user);

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

  const visibleTasks = useMemo(() => {
    if (activePage === "dashboard") {
      return tasks.filter((task) => task.status !== "archived").slice(0, 8);
    }

    if (activePage === "settings") {
      return tasks.filter((task) => task.status === "archived");
    }

    return tasks.filter((task) => task.status === activePage);
  }, [activePage, tasks]);

  const openTasks = tasks.filter((task) => !["done", "archived"].includes(task.status));
  const todayTasks = tasks.filter((task) => task.status === "today");
  const doneTasks = tasks.filter((task) => task.status === "done");
  const urgentTasks = openTasks.filter((task) => task.priority === "urgent" || task.priority === "high");
  const completionRate = tasks.length > 0 ? Math.round((doneTasks.length / tasks.length) * 100) : 0;
  const nextTask = urgentTasks[0] ?? todayTasks[0] ?? openTasks[0] ?? null;
  const pageTitle = navItems.find((item) => item.id === activePage)?.label ?? "Dashboard";

  async function createTaskFromQuick(rawInput: string, defaultStatus: TaskStatus) {
    const parsed = parseQuickTask(rawInput);
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
    });
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

    setEditor(null);
  }

  async function updateTask(task: Task, updates: Partial<Omit<Task, "id" | "createdAt" | "updatedAt">>) {
    setActionError("");
    setActionMessage("");
    await updateDoc(doc(db, "users", user.uid, "tasks", task.id), {
      ...updates,
      updatedAt: serverTimestamp(),
      userId: user.uid,
    });
  }

  async function deleteTask(task: Task) {
    if (!window.confirm(`Delete "${task.title}"? This cannot be undone.`)) {
      return;
    }

    setActionError("");
    await deleteDoc(doc(db, "users", user.uid, "tasks", task.id));
    setActionMessage("Task deleted.");
  }

  async function runTaskAction(action: () => Promise<void>, successMessage: string) {
    try {
      setActionError("");
      setActionMessage("");
      await action();
      setActionMessage(successMessage);
    } catch (taskActionError) {
      setActionError(getFriendlyError(taskActionError));
    }
  }

  const defaultCreateStatus: TaskStatus = activePage === "today" || activePage === "upcoming" || activePage === "inbox" ? activePage : "inbox";

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Primary">
        <div className="brand-row">
          <img src="/lifeos-mark.svg" alt="" className="brand-mark" />
          <div>
            <p className="eyebrow">Phase 1 workspace</p>
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
          <button className="primary-button" type="button" onClick={() => setEditor({ task: null, defaultStatus: defaultCreateStatus })}>
            <Plus size={18} />
            New task
          </button>
        </header>

        {actionError ? <StatusBanner tone="error" message={actionError} /> : null}
        {actionMessage ? <StatusBanner tone="success" message={actionMessage} /> : null}
        {error ? <StatusBanner tone="error" message={error} /> : null}

        {activePage === "dashboard" ? (
          <DashboardPage
            nextTask={nextTask}
            tasks={tasks}
            openTasks={openTasks}
            todayTasks={todayTasks}
            doneTasks={doneTasks}
            completionRate={completionRate}
            onQuickCreate={(value) => createTaskFromQuick(value, "inbox")}
          />
        ) : null}

        {activePage === "inbox" ? (
          <PagePanel title="Inbox capture" description="Collect loose tasks first, then clarify them into today or upcoming.">
            <QuickCapture label="Add to Inbox" onCreate={(value) => createTaskFromQuick(value, "inbox")} />
          </PagePanel>
        ) : null}

        {activePage === "settings" ? (
          <SettingsPage user={user} tasks={tasks} />
        ) : null}

        <TaskSection
          loading={loading}
          page={activePage}
          tasks={visibleTasks}
          onEdit={(task) => setEditor({ task, defaultStatus: task.status })}
          onDelete={(task) => void runTaskAction(() => deleteTask(task), "Task deleted.")}
          onMarkDone={(task) =>
            void runTaskAction(
              () => updateTask(task, { status: "done", completedAt: serverTimestamp() as Task["completedAt"] }),
              "Task marked done."
            )
          }
          onUndoDone={(task) =>
            void runTaskAction(() => updateTask(task, { status: "today", completedAt: null }), "Task moved back to Today.")
          }
          onArchive={(task) => void runTaskAction(() => updateTask(task, { status: "archived" }), "Task archived.")}
          onMoveToday={(task) =>
            void runTaskAction(
              () => updateTask(task, { status: "today", dueDate: getTodayISODate(), completedAt: null }),
              "Task moved to Today."
            )
          }
          onMoveUpcoming={(task) =>
            void runTaskAction(() => updateTask(task, { status: "upcoming", completedAt: null }), "Task moved to Upcoming.")
          }
        />
      </section>

      {editor ? (
        <TaskEditor
          task={editor.task}
          defaultStatus={editor.defaultStatus}
          onClose={() => setEditor(null)}
          onSave={(values) => saveTask(values, editor.task)}
        />
      ) : null}
    </main>
  );
}

function AuthScreen() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      if (mode === "signup") {
        const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        const cleanName = displayName.trim();
        if (cleanName) {
          await updateProfile(credential.user, { displayName: cleanName });
        }

        await setDoc(
          doc(db, "users", credential.user.uid),
          {
            email: credential.user.email ?? email.trim(),
            displayName: cleanName,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (authError) {
      setError(getFriendlyError(authError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="brand-row">
          <img src="/lifeos-mark.svg" alt="" className="brand-mark" />
          <div>
            <p className="eyebrow">Secure workspace</p>
            <h1>LifeOS v2</h1>
          </div>
        </div>

        <div className="auth-copy">
          <h2>{mode === "login" ? "Log in to your LifeOS." : "Create your LifeOS account."}</h2>
          <p>Tasks are stored in your authenticated Firestore user space and never shown before sign-in.</p>
        </div>

        <div className="segmented-control" aria-label="Authentication mode">
          <button className={mode === "login" ? "active" : ""} type="button" onClick={() => setMode("login")}>
            Login
          </button>
          <button className={mode === "signup" ? "active" : ""} type="button" onClick={() => setMode("signup")}>
            Signup
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === "signup" ? (
            <label>
              Name
              <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Optional" />
            </label>
          ) : null}

          <label>
            Email
            <input
              autoComplete="email"
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
          </label>

          <label>
            Password
            <input
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={6}
              required
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 6 characters"
            />
          </label>

          {error ? <StatusBanner tone="error" message={error} /> : null}

          <button className="primary-button full-width" disabled={submitting} type="submit">
            <ArrowRight size={18} />
            {submitting ? "Working..." : mode === "login" ? "Login" : "Create account"}
          </button>
        </form>
      </section>
    </main>
  );
}

function DashboardPage({
  nextTask,
  tasks,
  openTasks,
  todayTasks,
  doneTasks,
  completionRate,
  onQuickCreate,
}: {
  nextTask: Task | null;
  tasks: Task[];
  openTasks: Task[];
  todayTasks: Task[];
  doneTasks: Task[];
  completionRate: number;
  onQuickCreate: (value: string) => Promise<void>;
}) {
  const archivedCount = tasks.filter((task) => task.status === "archived").length;

  return (
    <>
      <section className="hero-band">
        <div className="hero-copy">
          <p className="eyebrow">Next best action</p>
          <h3>{nextTask?.title ?? "Capture the first task"}</h3>
          <p>
            {nextTask?.description ||
              (nextTask ? `Priority: ${titleCase(nextTask.priority)}. Status: ${titleCase(nextTask.status)}.` : "Your Firestore task list is empty. Add one below to start Phase 1.")}
          </p>
          <QuickCapture label="Quick capture" onCreate={onQuickCreate} />
        </div>
        <div className="hero-stat" aria-label="Completion rate">
          <span>{completionRate}%</span>
          <small>task completion</small>
        </div>
      </section>

      <section className="metrics-grid" aria-label="Task metrics">
        <MetricCard icon={Inbox} label="Open tasks" value={String(openTasks.length)} detail="Inbox, Today, Upcoming" />
        <MetricCard icon={CheckCircle2} label="Today" value={String(todayTasks.length)} detail="Scheduled for now" />
        <MetricCard icon={Check} label="Done" value={String(doneTasks.length)} detail="Completed tasks" />
        <MetricCard icon={Archive} label="Archived" value={String(archivedCount)} detail="Stored out of view" />
      </section>
    </>
  );
}

function SettingsPage({ user, tasks }: { user: User; tasks: Task[] }) {
  const openCount = tasks.filter((task) => !["done", "archived"].includes(task.status)).length;
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

function TaskSection({
  loading,
  page,
  tasks,
  onEdit,
  onDelete,
  onMarkDone,
  onUndoDone,
  onArchive,
  onMoveToday,
  onMoveUpcoming,
}: {
  loading: boolean;
  page: PageId;
  tasks: Task[];
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onMarkDone: (task: Task) => void;
  onUndoDone: (task: Task) => void;
  onArchive: (task: Task) => void;
  onMoveToday: (task: Task) => void;
  onMoveUpcoming: (task: Task) => void;
}) {
  const title = page === "settings" ? "Archived tasks" : page === "dashboard" ? "Recent tasks" : `${titleCase(page)} tasks`;

  return (
    <article className="panel task-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{title}</p>
          <h3>{loading ? "Syncing with Firestore" : `${tasks.length} task${tasks.length === 1 ? "" : "s"}`}</h3>
        </div>
        <Clock3 size={20} />
      </div>

      {loading ? <EmptyState title="Loading tasks" message="Reading your user-specific Firestore task collection." /> : null}
      {!loading && tasks.length === 0 ? <EmptyState title="No tasks here" message={getEmptyMessage(page)} /> : null}

      <div className="task-list">
        {tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            onEdit={onEdit}
            onDelete={onDelete}
            onMarkDone={onMarkDone}
            onUndoDone={onUndoDone}
            onArchive={onArchive}
            onMoveToday={onMoveToday}
            onMoveUpcoming={onMoveUpcoming}
          />
        ))}
      </div>
    </article>
  );
}

function TaskRow({
  task,
  onEdit,
  onDelete,
  onMarkDone,
  onUndoDone,
  onArchive,
  onMoveToday,
  onMoveUpcoming,
}: {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onMarkDone: (task: Task) => void;
  onUndoDone: (task: Task) => void;
  onArchive: (task: Task) => void;
  onMoveToday: (task: Task) => void;
  onMoveUpcoming: (task: Task) => void;
}) {
  return (
    <section className={`task-row ${task.status === "done" ? "is-done" : ""}`}>
      <div className="task-main">
        <div className="task-title-line">
          <strong>{task.title}</strong>
          <em className={`priority ${task.priority}`}>{task.priority}</em>
          <em className={`status-pill ${task.status}`}>{task.status}</em>
        </div>
        {task.description ? <p>{task.description}</p> : null}
        <div className="task-meta">
          {task.dueDate ? <span>Due {task.dueDate}</span> : null}
          <span>{task.estimatedMinutes} min</span>
          <span>{titleCase(task.energyLevel)} energy</span>
          {task.tags.map((tag) => (
            <span key={tag}>
              <Tag size={13} />
              {tag}
            </span>
          ))}
        </div>
        {task.notes ? <small className="task-notes">{task.notes}</small> : null}
      </div>

      <div className="task-actions" aria-label={`Actions for ${task.title}`}>
        {task.status === "done" ? (
          <button type="button" className="icon-text-button" onClick={() => onUndoDone(task)}>
            <Undo2 size={16} />
            Undo
          </button>
        ) : (
          <button type="button" className="icon-text-button" onClick={() => onMarkDone(task)}>
            <Check size={16} />
            Done
          </button>
        )}

        {task.status !== "today" ? (
          <button type="button" className="icon-text-button" onClick={() => onMoveToday(task)}>
            <CheckCircle2 size={16} />
            Today
          </button>
        ) : null}

        {task.status !== "upcoming" ? (
          <button type="button" className="icon-text-button" onClick={() => onMoveUpcoming(task)}>
            <CalendarClock size={16} />
            Upcoming
          </button>
        ) : null}

        {task.status !== "archived" ? (
          <button type="button" className="icon-text-button" onClick={() => onArchive(task)}>
            <Archive size={16} />
            Archive
          </button>
        ) : null}

        <button type="button" className="icon-button task-icon-button" aria-label={`Edit ${task.title}`} onClick={() => onEdit(task)}>
          <Pencil size={16} />
        </button>
        <button type="button" className="icon-button task-icon-button danger" aria-label={`Delete ${task.title}`} onClick={() => onDelete(task)}>
          <Trash2 size={16} />
        </button>
      </div>
    </section>
  );
}

function TaskEditor({
  task,
  defaultStatus,
  onClose,
  onSave,
}: {
  task: Task | null;
  defaultStatus: TaskStatus;
  onClose: () => void;
  onSave: (values: TaskFormValues) => Promise<void>;
}) {
  const [values, setValues] = useState<TaskFormValues>(() => taskToFormValues(task, defaultStatus));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      await onSave(values);
    } catch (saveError) {
      setError(getFriendlyError(saveError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="task-editor-title">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{task ? "Edit task" : "Create task"}</p>
            <h3 id="task-editor-title">{task ? task.title : "New task"}</h3>
          </div>
          <button type="button" className="icon-button task-icon-button" aria-label="Close editor" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form className="task-form" onSubmit={handleSubmit}>
          <label>
            Title
            <input required value={values.title} onChange={(event) => setValues({ ...values, title: event.target.value })} />
          </label>

          <label>
            Description
            <textarea value={values.description} onChange={(event) => setValues({ ...values, description: event.target.value })} />
          </label>

          <div className="form-grid">
            <label>
              Status
              <select
                value={values.status}
                onChange={(event) => setValues({ ...values, status: event.target.value as TaskStatus })}
              >
                {taskStatuses.map((status) => (
                  <option key={status} value={status}>
                    {titleCase(status)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Priority
              <select
                value={values.priority}
                onChange={(event) => setValues({ ...values, priority: event.target.value as TaskPriority })}
              >
                {priorities.map((priority) => (
                  <option key={priority} value={priority}>
                    {titleCase(priority)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Due date
              <input type="date" value={values.dueDate} onChange={(event) => setValues({ ...values, dueDate: event.target.value })} />
            </label>

            <label>
              Estimate
              <input
                min="0"
                type="number"
                value={values.estimatedMinutes}
                onChange={(event) => setValues({ ...values, estimatedMinutes: event.target.value })}
              />
            </label>

            <label>
              Energy
              <select
                value={values.energyLevel}
                onChange={(event) => setValues({ ...values, energyLevel: event.target.value as EnergyLevel })}
              >
                {energyLevels.map((energy) => (
                  <option key={energy} value={energy}>
                    {titleCase(energy)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Tags
              <input
                value={values.tags}
                onChange={(event) => setValues({ ...values, tags: event.target.value })}
                placeholder="work, health"
              />
            </label>
          </div>

          <label>
            Notes
            <textarea value={values.notes} onChange={(event) => setValues({ ...values, notes: event.target.value })} />
          </label>

          {error ? <StatusBanner tone="error" message={error} /> : null}

          <div className="modal-actions">
            <button className="secondary-button" type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="primary-button" disabled={saving} type="submit">
              <Save size={18} />
              {saving ? "Saving..." : "Save task"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function QuickCapture({ label, onCreate }: { label: string; onCreate: (value: string) => Promise<void> }) {
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      await onCreate(value);
      setValue("");
    } catch (quickError) {
      setError(getFriendlyError(quickError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="quick-add" onSubmit={handleSubmit}>
      <input
        aria-label={label}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Capture a task with #tag and !high"
      />
      <button type="submit" aria-label={label} disabled={submitting}>
        <Plus size={18} />
      </button>
      {error ? <span className="inline-error">{error}</span> : null}
    </form>
  );
}

function MetricCard({ icon: Icon, label, value, detail }: { icon: LucideIcon; label: string; value: string; detail: string }) {
  return (
    <article className="metric-card">
      <div className="metric-icon">
        <Icon size={20} />
      </div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function StatusBanner({ tone, message }: { tone: "error" | "success"; message: string }) {
  return <div className={`status-banner ${tone}`}>{message}</div>;
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <span>{message}</span>
    </div>
  );
}

function FullScreenState({ title, message }: { title: string; message: string }) {
  return (
    <main className="auth-shell">
      <section className="auth-panel compact">
        <Sparkles size={28} />
        <h1>{title}</h1>
        <p>{message}</p>
      </section>
    </main>
  );
}

function useUserTasks(user: User) {
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

function mapTaskDocument(snapshot: QueryDocumentSnapshot<DocumentData>): Task {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    title: String(data.title ?? "Untitled task"),
    description: String(data.description ?? ""),
    status: isTaskStatus(data.status) ? data.status : "inbox",
    priority: isTaskPriority(data.priority) ? data.priority : "medium",
    dueDate: String(data.dueDate ?? ""),
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    estimatedMinutes: Number(data.estimatedMinutes ?? 25),
    energyLevel: isEnergyLevel(data.energyLevel) ? data.energyLevel : "medium",
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
    completedAt: data.completedAt ?? null,
    notes: String(data.notes ?? ""),
    userId: String(data.userId ?? ""),
  };
}

function normalizeTaskForm(values: TaskFormValues) {
  return {
    title: values.title.trim(),
    description: values.description.trim(),
    status: values.status,
    priority: values.priority,
    dueDate: values.dueDate,
    tags: values.tags
      .split(",")
      .map((tag) => tag.trim().replace(/^#/, "").toLowerCase())
      .filter(Boolean),
    estimatedMinutes: Math.max(0, Number(values.estimatedMinutes || 0)),
    energyLevel: values.energyLevel,
    notes: values.notes.trim(),
  };
}

function taskToFormValues(task: Task | null, defaultStatus: TaskStatus): TaskFormValues {
  return {
    title: task?.title ?? "",
    description: task?.description ?? "",
    status: task?.status ?? defaultStatus,
    priority: task?.priority ?? "medium",
    dueDate: task?.dueDate ?? "",
    tags: task?.tags.join(", ") ?? "",
    estimatedMinutes: String(task?.estimatedMinutes ?? 25),
    energyLevel: task?.energyLevel ?? "medium",
    notes: task?.notes ?? "",
  };
}

function getPageFromHash(): PageId {
  const hash = window.location.hash.replace("#", "");
  return navItems.some((item) => item.id === hash) ? (hash as PageId) : "dashboard";
}

function getPageHeadline(page: PageId) {
  switch (page) {
    case "dashboard":
      return "A Firestore-backed command center for what needs attention.";
    case "inbox":
      return "Capture raw tasks quickly and clarify them later.";
    case "today":
      return "Work from a short list of tasks committed for today.";
    case "upcoming":
      return "Keep future commitments visible without crowding today.";
    case "settings":
      return "Confirm account, Firebase, and archived task state.";
  }
}

function getEmptyMessage(page: PageId) {
  switch (page) {
    case "dashboard":
      return "Create a task from the quick capture field to populate your dashboard.";
    case "inbox":
      return "Quick capture tasks here before moving them to Today or Upcoming.";
    case "today":
      return "Move a task to Today when it is ready for action.";
    case "upcoming":
      return "Move a task to Upcoming when it needs future attention.";
    case "settings":
      return "Archived tasks will appear here.";
  }
}

function getFriendlyError(error: unknown) {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case "auth/email-already-in-use":
        return "That email already has an account. Try logging in instead.";
      case "auth/invalid-credential":
      case "auth/wrong-password":
      case "auth/user-not-found":
        return "The email or password does not match an account.";
      case "auth/weak-password":
        return "Use a stronger password with at least six characters.";
      case "auth/invalid-email":
        return "Enter a valid email address.";
      case "permission-denied":
      case "firestore/permission-denied":
        return "Firestore rejected the request. Check that you are signed in and your rules are deployed.";
      default:
        return error.message;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong. Try again.";
}

function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === "string" && taskStatuses.includes(value as TaskStatus);
}

function isTaskPriority(value: unknown): value is TaskPriority {
  return typeof value === "string" && priorities.includes(value as TaskPriority);
}

function isEnergyLevel(value: unknown): value is EnergyLevel {
  return typeof value === "string" && energyLevels.includes(value as EnergyLevel);
}

function getTodayISODate() {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${today.getFullYear()}-${month}-${day}`;
}

function titleCase(value: string) {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}
