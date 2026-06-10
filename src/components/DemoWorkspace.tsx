import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FolderKanban,
  Inbox,
  LayoutDashboard,
  ListChecks,
  LogIn,
  Menu,
  Sparkles,
  Timer,
  X,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Badge, EmptyState, MetricCard, ProgressBar } from "./Common";
import { ProductTour, type ProductTourStep } from "./ProductTour";

type DemoPage = "dashboard" | "inbox" | "today" | "projects" | "focus" | "insights" | "weekly-review";

type DemoTask = {
  id: string;
  title: string;
  project: string;
  priority: "urgent" | "high" | "medium" | "low";
  status: "inbox" | "today" | "upcoming" | "done";
  tags: string[];
  estimate: number;
  due: string;
  emoji: string;
};

type DemoProject = {
  id: string;
  name: string;
  area: string;
  emoji: string;
  color: string;
  focusMinutes: number;
};

const demoNav: Array<{ id: DemoPage; label: string; icon: LucideIcon }> = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "today", label: "Today", icon: CheckCircle2 },
  { id: "projects", label: "Projects", icon: FolderKanban },
  { id: "focus", label: "Focus", icon: Timer },
  { id: "insights", label: "Insights", icon: BarChart3 },
  { id: "weekly-review", label: "Weekly Review", icon: CalendarDays },
];

const demoProjects: DemoProject[] = [
  { id: "german", name: "German B2", area: "Study", emoji: "📚", color: "#10b981", focusMinutes: 145 },
  { id: "coding", name: "Full Stack Development", area: "Study", emoji: "💻", color: "#2563eb", focusMinutes: 90 },
  { id: "uopeople", name: "UoPeople", area: "Study", emoji: "🎓", color: "#8b5cf6", focusMinutes: 35 },
  { id: "health", name: "Health & Discipline", area: "Health", emoji: "🏋️", color: "#ef4444", focusMinutes: 25 },
];

const initialDemoTasks: DemoTask[] = [
  {
    id: "task-1",
    title: "Review German modal verbs",
    project: "German B2",
    priority: "high",
    status: "today",
    tags: ["german", "study"],
    estimate: 35,
    due: "Today 09:00",
    emoji: "📚",
  },
  {
    id: "task-2",
    title: "Fix portfolio README wording",
    project: "Full Stack Development",
    priority: "medium",
    status: "today",
    tags: ["coding", "portfolio"],
    estimate: 25,
    due: "Today 14:00",
    emoji: "💻",
  },
  {
    id: "task-3",
    title: "Write UoPeople discussion response",
    project: "UoPeople",
    priority: "urgent",
    status: "upcoming",
    tags: ["uopeople", "writing"],
    estimate: 50,
    due: "Tomorrow",
    emoji: "🎓",
  },
  {
    id: "task-4",
    title: "Capture three SEO content ideas",
    project: "Inbox",
    priority: "low",
    status: "inbox",
    tags: ["seo", "business"],
    estimate: 15,
    due: "No due date",
    emoji: "📈",
  },
  {
    id: "task-5",
    title: "Complete one focus block",
    project: "Health & Discipline",
    priority: "medium",
    status: "done",
    tags: ["health", "discipline"],
    estimate: 25,
    due: "Yesterday",
    emoji: "🏋️",
  },
];

const demoTourSteps: ProductTourStep[] = [
  {
    id: "demo-dashboard",
    title: "Dashboard",
    body: "This is the command center. It summarizes today, focus time, project attention, and the next useful action.",
    targetSelector: '[data-tour="demo-dashboard"]',
    page: "dashboard",
  },
  {
    id: "demo-inbox",
    title: "Inbox",
    body: "Inbox is for quick capture. Ideas and loose tasks can be collected first, then organized later.",
    targetSelector: '[data-tour="demo-inbox"]',
    page: "inbox",
  },
  {
    id: "demo-today",
    title: "Today planning",
    body: "Today helps choose Top 3 priorities, a Deep Work task, and practical time blocks for the day.",
    targetSelector: '[data-tour="demo-today"]',
    page: "today",
  },
  {
    id: "demo-focus",
    title: "Focus",
    body: "Focus sessions connect deep work time to tasks and projects, so progress is visible instead of just planned.",
    targetSelector: '[data-tour="demo-focus"]',
    page: "focus",
  },
  {
    id: "demo-insights",
    title: "Insights",
    body: "Insights turn task and focus history into simple signals: what is moving, what is stuck, and what needs attention.",
    targetSelector: '[data-tour="demo-insights"]',
    page: "insights",
  },
  {
    id: "demo-review",
    title: "Weekly Review",
    body: "Weekly Review closes the loop by reflecting on wins, problems, habits, focus, and next-week priorities.",
    targetSelector: '[data-tour="demo-weekly-review"]',
    page: "weekly-review",
  },
];

export function DemoWorkspace({ onExit }: { onExit: () => void }) {
  const [activePage, setActivePage] = useState<DemoPage>("dashboard");
  const [tasks, setTasks] = useState(initialDemoTasks);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(() => window.localStorage.getItem("lifeos-demo-tour-seen") !== "1");

  const openTasks = tasks.filter((task) => task.status !== "done");
  const todayTasks = tasks.filter((task) => task.status === "today");
  const doneTasks = tasks.filter((task) => task.status === "done");
  const totalFocus = demoProjects.reduce((sum, project) => sum + project.focusMinutes, 0);
  const completionRate = Math.round((doneTasks.length / tasks.length) * 100);
  const pageTitle = demoNav.find((item) => item.id === activePage)?.label ?? "Dashboard";

  const projectTaskCounts = useMemo(
    () =>
      demoProjects.map((project) => ({
        ...project,
        openTasks: tasks.filter((task) => task.project === project.name && task.status !== "done").length,
        completedTasks: tasks.filter((task) => task.project === project.name && task.status === "done").length,
      })),
    [tasks]
  );

  function markDone(taskId: string) {
    setTasks((current) => current.map((task) => (task.id === taskId ? { ...task, status: task.status === "done" ? "today" : "done" } : task)));
  }

  function closeTour() {
    window.localStorage.setItem("lifeos-demo-tour-seen", "1");
    setTourOpen(false);
  }

  return (
    <main className={`app-shell demo-shell ${mobileNavOpen ? "mobile-nav-open" : ""}`}>
      <header className="mobile-nav-bar">
        <div className="brand-row">
          <span className="brand-mark app-icon-mark" aria-hidden="true" />
          <div>
            <p className="eyebrow">Demo workspace</p>
            <strong>LifeOS</strong>
          </div>
        </div>
        <button
          className="mobile-nav-toggle"
          type="button"
          aria-controls="demo-sidebar"
          aria-expanded={mobileNavOpen}
          aria-label={mobileNavOpen ? "Close navigation" : "Open navigation"}
          onClick={() => setMobileNavOpen((open) => !open)}
        >
          {mobileNavOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      {mobileNavOpen ? <button className="mobile-nav-scrim" type="button" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} /> : null}

      <aside className="sidebar" id="demo-sidebar" aria-label="Demo navigation">
        <div className="brand-row">
          <span className="brand-mark app-icon-mark" aria-hidden="true" />
          <div>
            <p className="eyebrow">Guest demo</p>
            <h1>LifeOS v2</h1>
          </div>
        </div>

        <nav className="nav-list">
          {demoNav.map(({ id, label, icon: Icon }) => (
            <button
              className={activePage === id ? "active" : ""}
              data-tour={`demo-${id}`}
              key={id}
              type="button"
              onClick={() => {
                setActivePage(id);
                setMobileNavOpen(false);
              }}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <section className="sync-panel demo-sync-panel">
          <Sparkles size={18} />
          <div>
            <strong>Demo mode</strong>
            <span>Sample data only. Nothing is saved.</span>
          </div>
        </section>

        <button className="secondary-button full-width" type="button" onClick={() => setTourOpen(true)}>
          <Sparkles size={17} />
          Replay tour
        </button>
        <button className="ghost-button full-width" type="button" onClick={onExit}>
          <LogIn size={17} />
          Login / create account
        </button>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Public demo</p>
            <h2>{getDemoHeadline(activePage)}</h2>
          </div>
          <div className="demo-topbar-actions">
            <button className="secondary-button" type="button" onClick={() => setTourOpen(true)}>
              <Sparkles size={17} />
              How it works
            </button>
            <button className="primary-button" type="button" onClick={onExit}>
              Create account
            </button>
          </div>
        </header>

        <section className="demo-intro-panel panel">
          <div>
            <p className="eyebrow">What this app does</p>
            <h3>LifeOS helps organize tasks, projects, focus time, habits, and weekly reflection in one personal workspace.</h3>
            <p>This demo uses sample data so you can explore the workflow without typing an email address.</p>
          </div>
          <Badge tone="info">Guest mode</Badge>
        </section>

        {activePage === "dashboard" ? (
          <DemoDashboard
            tasks={tasks}
            openTasks={openTasks}
            todayTasks={todayTasks}
            completionRate={completionRate}
            totalFocus={totalFocus}
            projects={projectTaskCounts}
            onNavigate={setActivePage}
          />
        ) : null}

        {activePage === "inbox" ? <DemoTaskList title="Inbox capture" tasks={tasks.filter((task) => task.status === "inbox")} onToggleDone={markDone} /> : null}
        {activePage === "today" ? <DemoToday tasks={tasks} onToggleDone={markDone} /> : null}
        {activePage === "projects" ? <DemoProjects projects={projectTaskCounts} /> : null}
        {activePage === "focus" ? <DemoFocus tasks={tasks} totalFocus={totalFocus} /> : null}
        {activePage === "insights" ? <DemoInsights projects={projectTaskCounts} tasks={tasks} /> : null}
        {activePage === "weekly-review" ? <DemoWeeklyReview tasks={tasks} totalFocus={totalFocus} /> : null}
      </section>

      <ProductTour
        open={tourOpen}
        steps={demoTourSteps}
        onClose={closeTour}
        onNavigate={(step) => {
          if (step.page && demoNav.some((item) => item.id === step.page)) {
            setActivePage(step.page as DemoPage);
          }
        }}
      />
    </main>
  );
}

function DemoDashboard({
  tasks,
  openTasks,
  todayTasks,
  completionRate,
  totalFocus,
  projects,
  onNavigate,
}: {
  tasks: DemoTask[];
  openTasks: DemoTask[];
  todayTasks: DemoTask[];
  completionRate: number;
  totalFocus: number;
  projects: Array<DemoProject & { openTasks: number; completedTasks: number }>;
  onNavigate: (page: DemoPage) => void;
}) {
  const nextTask = todayTasks[0] ?? openTasks[0] ?? null;

  return (
    <>
      <section className="hero-band demo-hero">
        <div className="hero-copy">
          <p className="eyebrow">Next best action</p>
          <h3>{nextTask ? `${nextTask.emoji} ${nextTask.title}` : "No task selected"}</h3>
          <p>{nextTask ? `${nextTask.project} · ${nextTask.priority} priority · ${nextTask.estimate} min` : "Create tasks after signing up."}</p>
          <div className="settings-actions-row">
            <button className="primary-button" type="button" onClick={() => onNavigate("today")}>
              Open Today
            </button>
            <button className="secondary-button" type="button" onClick={() => onNavigate("insights")}>
              View Insights
            </button>
          </div>
        </div>
        <div className="hero-stat">
          <span>{completionRate}%</span>
          <small>demo completion</small>
        </div>
      </section>

      <section className="metrics-grid">
        <MetricCard icon={Inbox} label="Open tasks" value={String(openTasks.length)} detail="Across demo workspace" />
        <MetricCard icon={CheckCircle2} label="Today" value={String(todayTasks.length)} detail="Planned for today" />
        <MetricCard icon={Timer} label="Focus this week" value={`${totalFocus}m`} detail="Completed focus time" />
        <MetricCard icon={FolderKanban} label="Projects" value={String(projects.length)} detail="Study, health, portfolio" />
      </section>

      <section className="content-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Top 3 preview</p>
              <h3>What matters today</h3>
            </div>
            <ListChecks size={20} />
          </div>
          <DemoTaskRows tasks={todayTasks.slice(0, 3)} />
        </article>
        <article className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Recommendation</p>
              <h3>Protect focus time</h3>
            </div>
            <Sparkles size={20} />
          </div>
          <p className="panel-copy">German B2 is active this week. Full Stack Development has open work, so schedule one focused block next.</p>
        </article>
      </section>
    </>
  );
}

function DemoToday({ tasks, onToggleDone }: { tasks: DemoTask[]; onToggleDone: (taskId: string) => void }) {
  const todayTasks = tasks.filter((task) => task.status === "today" || task.status === "done").slice(0, 4);
  const deepWorkTask = todayTasks.find((task) => task.project === "German B2") ?? todayTasks[0];

  return (
    <section className="content-grid">
      <article className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Top 3</p>
            <h3>Today's priorities</h3>
          </div>
        </div>
        <DemoTaskListContent tasks={todayTasks.slice(0, 3)} onToggleDone={onToggleDone} />
      </article>
      <article className="panel deep-work-demo-card">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Deep Work</p>
            <h3>{deepWorkTask ? `${deepWorkTask.emoji} ${deepWorkTask.title}` : "Choose a deep work task"}</h3>
          </div>
          <Timer size={20} />
        </div>
        <p className="panel-copy">A deep work task can launch a focus block and later appear in focus analytics.</p>
        <button className="primary-button" type="button">
          Start focus block
        </button>
      </article>
      <article className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Time blocks</p>
            <h3>Example plan</h3>
          </div>
        </div>
        <div className="demo-timeline">
          <span>09:00 German study</span>
          <span>14:00 Portfolio work</span>
          <span>18:30 Health reset</span>
        </div>
      </article>
    </section>
  );
}

function DemoTaskList({ title, tasks, onToggleDone }: { title: string; tasks: DemoTask[]; onToggleDone: (taskId: string) => void }) {
  return (
    <article className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{title}</p>
          <h3>Sample tasks</h3>
        </div>
      </div>
      <DemoTaskListContent tasks={tasks} onToggleDone={onToggleDone} />
    </article>
  );
}

function DemoTaskListContent({ tasks, onToggleDone }: { tasks: DemoTask[]; onToggleDone: (taskId: string) => void }) {
  if (tasks.length === 0) {
    return <EmptyState title="No tasks in this view" message="Demo tasks move between views as their status changes." />;
  }

  return (
    <div className="demo-task-list">
      {tasks.map((task) => (
        <article className={`demo-task-row ${task.status === "done" ? "done" : ""}`} key={task.id}>
          <button className="demo-task-check" type="button" aria-label={`Toggle ${task.title}`} onClick={() => onToggleDone(task.id)}>
            {task.status === "done" ? "✓" : ""}
          </button>
          <div>
            <strong>
              {task.emoji} {task.title}
            </strong>
            <span>{task.project} · {task.due} · {task.estimate} min</span>
            <div className="demo-chip-row">
              <Badge tone={task.priority === "urgent" || task.priority === "high" ? "warning" : "neutral"}>{task.priority}</Badge>
              {task.tags.map((tag) => (
                <Badge key={tag}>#{tag}</Badge>
              ))}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function DemoTaskRows({ tasks }: { tasks: DemoTask[] }) {
  return (
    <div className="dashboard-mini-list">
      {tasks.map((task) => (
        <span key={task.id}>{task.emoji} {task.title}</span>
      ))}
    </div>
  );
}

function DemoProjects({ projects }: { projects: Array<DemoProject & { openTasks: number; completedTasks: number }> }) {
  return (
    <section className="demo-project-grid">
      {projects.map((project) => (
        <article className="panel demo-project-card" key={project.id} style={{ "--project-color": project.color } as React.CSSProperties}>
          <span className="project-color-dot" />
          <h3>{project.emoji} {project.name}</h3>
          <p>{project.area}</p>
          <div className="dashboard-today-plan">
            <div>
              <strong>{project.openTasks}</strong>
              <span>open</span>
            </div>
            <div>
              <strong>{project.focusMinutes}m</strong>
              <span>focus</span>
            </div>
          </div>
          <ProgressBar value={Math.min(100, project.completedTasks * 35 + project.focusMinutes / 4)} label={`${project.name} demo progress`} />
        </article>
      ))}
    </section>
  );
}

function DemoFocus({ tasks, totalFocus }: { tasks: DemoTask[]; totalFocus: number }) {
  const focusTask = tasks.find((task) => task.project === "Full Stack Development") ?? tasks[0];

  return (
    <section className="content-grid">
      <article className="panel demo-focus-panel">
        <p className="eyebrow">Pomodoro</p>
        <h3>25:00</h3>
        <p>{focusTask.emoji} {focusTask.title}</p>
        <div className="settings-actions-row">
          <button className="primary-button" type="button">Start</button>
          <button className="secondary-button" type="button">Pause</button>
        </div>
      </article>
      <article className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Focus stats</p>
            <h3>{totalFocus} minutes this week</h3>
          </div>
          <Clock3 size={20} />
        </div>
        <p className="panel-copy">Completed sessions are linked to tasks and projects, so focus time becomes visible in Insights.</p>
      </article>
    </section>
  );
}

function DemoInsights({ projects, tasks }: { projects: Array<DemoProject & { openTasks: number; completedTasks: number }>; tasks: DemoTask[] }) {
  const maxFocus = Math.max(...projects.map((project) => project.focusMinutes), 1);
  const urgentOpen = tasks.filter((task) => task.priority === "urgent" && task.status !== "done").length;

  return (
    <section className="content-grid">
      <article className="panel demo-chart-card">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Project attention</p>
            <h3>Focus minutes by project</h3>
          </div>
        </div>
        <div className="demo-bar-chart">
          {projects.map((project) => (
            <div className="demo-bar-row" key={project.id}>
              <span>{project.emoji} {project.name}</span>
              <div>
                <em style={{ width: `${Math.max(8, (project.focusMinutes / maxFocus) * 100)}%`, background: project.color }} />
              </div>
              <strong>{project.focusMinutes}m</strong>
            </div>
          ))}
        </div>
      </article>
      <article className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Recommendation</p>
            <h3>{urgentOpen > 0 ? "Urgent work needs attention" : "Workload is balanced"}</h3>
          </div>
        </div>
        <p className="panel-copy">
          {urgentOpen > 0
            ? "UoPeople has urgent open work. Move one task into Today before adding more low-priority work."
            : "Your urgent work is clear. Keep one short focus block tomorrow."}
        </p>
      </article>
    </section>
  );
}

function DemoWeeklyReview({ tasks, totalFocus }: { tasks: DemoTask[]; totalFocus: number }) {
  return (
    <section className="content-grid">
      <article className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Weekly snapshot</p>
            <h3>Close the loop</h3>
          </div>
        </div>
        <div className="dashboard-today-plan">
          <div>
            <strong>{tasks.filter((task) => task.status === "done").length}</strong>
            <span>completed</span>
          </div>
          <div>
            <strong>{totalFocus}m</strong>
            <span>focus</span>
          </div>
          <div>
            <strong>4</strong>
            <span>projects touched</span>
          </div>
        </div>
      </article>
      <article className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Reflection prompts</p>
            <h3>What happened this week?</h3>
          </div>
        </div>
        <div className="demo-review-prompts">
          <span>What went well?</span>
          <span>What was difficult?</span>
          <span>What should improve next week?</span>
        </div>
      </article>
    </section>
  );
}

function getDemoHeadline(page: DemoPage) {
  switch (page) {
    case "dashboard":
      return "A guided sample workspace for portfolio visitors.";
    case "inbox":
      return "Capture and organize loose tasks.";
    case "today":
      return "Plan priorities, Deep Work, and time blocks.";
    case "projects":
      return "See how tasks connect to areas of life.";
    case "focus":
      return "Track focus sessions linked to real work.";
    case "insights":
      return "Turn work history into useful decisions.";
    case "weekly-review":
      return "Reflect and choose next-week priorities.";
  }
}
