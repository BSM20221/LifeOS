import type { Timestamp } from "firebase/firestore";

export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskStatus = "inbox" | "today" | "upcoming" | "done" | "archived";
export type EnergyLevel = "low" | "medium" | "high";
export type ProjectStatus = "active" | "paused" | "completed" | "archived";
export type ProjectArea = "Study" | "Business" | "Health" | "Client Work" | "Personal" | "Other";
export type DueDateGroup = "no-due-date" | "overdue" | "today" | "tomorrow" | "this-week" | "later";
export type TimeBlockType = "deep-work" | "study" | "admin" | "health" | "break" | "personal" | "other";
export type MoodLevel = "low" | "okay" | "good" | "great";
export type FocusMode = "pomodoro" | "short-break" | "long-break" | "custom";
export type FocusStatus = "running" | "paused" | "completed" | "cancelled";
export type InsightSeverity = "info" | "success" | "warning" | "danger";
export type AnalyticsRange = "today" | "7-days" | "30-days" | "this-month" | "this-year" | "all-time" | "custom";
export type PerformanceStatus = "Strong" | "Healthy" | "Needs attention" | "Neglected" | "Stuck";
export type QuoteCategory =
  | "discipline"
  | "focus"
  | "learning"
  | "patience"
  | "courage"
  | "wisdom"
  | "resilience"
  | "humility"
  | "ambition";

export type Task = {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string;
  tags: string[];
  estimatedMinutes: number;
  energyLevel: EnergyLevel;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
  completedAt: Timestamp | null;
  notes: string;
  userId: string;
  projectId: string | null;
  emoji: string | null;
  icon: string | null;
};

export type TaskFormValues = {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string;
  tags: string;
  estimatedMinutes: string;
  energyLevel: EnergyLevel;
  notes: string;
  projectId: string;
  emoji: string;
  icon: string;
};

export type Project = {
  id: string;
  userId: string;
  name: string;
  description: string;
  color: string;
  status: ProjectStatus;
  area: ProjectArea;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
  archivedAt: string | null;
  completedAt: string | null;
  emoji: string | null;
  icon: string | null;
};

export type ProjectFormValues = {
  name: string;
  description: string;
  color: string;
  status: ProjectStatus;
  area: ProjectArea;
  emoji: string;
  icon: string;
};

export type ProjectStats = {
  openTasks: number;
  completedTasks: number;
  totalTasks: number;
  progress: number;
};

export type FilterCriteria = {
  searchText?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  projectId?: string | "none";
  tag?: string;
  dueDateGroup?: DueDateGroup;
  energyLevel?: EnergyLevel;
};

export type SavedFilter = {
  id: string;
  userId: string;
  name: string;
  description: string;
  query: FilterCriteria;
  color: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
};

export type SavedFilterFormValues = {
  name: string;
  description: string;
  color: string;
  query: FilterCriteria;
};

export type TagCount = {
  tag: string;
  openTasks: number;
  completedTasks: number;
  totalTasks: number;
};

export type TimeBlock = {
  id: string;
  taskId: string | null;
  title: string;
  startTime: string;
  endTime: string;
  type: TimeBlockType;
  notes: string;
  completed: boolean;
};

export type DailyReflection = {
  wentWell: string;
  distractions: string;
  improveTomorrow: string;
  energyLevel: EnergyLevel | null;
  mood: MoodLevel | null;
};

export type DailyPlan = {
  id: string;
  userId: string;
  date: string;
  topTaskIds: string[];
  deepWorkTaskId: string | null;
  timeBlocks: TimeBlock[];
  reflection: DailyReflection;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
};

export type TimeBlockFormValues = {
  taskId: string;
  title: string;
  startTime: string;
  endTime: string;
  type: TimeBlockType;
  notes: string;
  completed: boolean;
};

export type TodayStats = {
  todayTasks: number;
  overdueTasks: number;
  totalEstimatedMinutes: number;
  completedToday: number;
  topCompleted: number;
};

export type FocusSession = {
  id: string;
  userId: string;
  taskId: string | null;
  projectId: string | null;
  dailyPlanDate: string;
  mode: FocusMode;
  plannedMinutes: number;
  actualMinutes: number;
  status: FocusStatus;
  startedAt: string;
  pausedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  notes: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
};

export type FocusStats = {
  completedSessions: number;
  totalFocusedMinutes: number;
  minutesByProject: Record<string, number>;
  minutesByTask: Record<string, number>;
};

export type InsightMessage = {
  id: string;
  title: string;
  message: string;
  severity: InsightSeverity;
};

export type Quote = {
  id: string;
  text: string;
  author: string;
  category: QuoteCategory;
  context: string;
};

export type ChartDatum = {
  label: string;
  value: number;
  color?: string;
  detail?: string;
};

export type ChartSeries = {
  label: string;
  data: ChartDatum[];
  color?: string;
};

export type DateBucket = {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
};

export type PriorityCompletionStats = {
  priority: TaskPriority;
  completed: number;
  open: number;
  overdue: number;
};

export type PlannedVsCompletedStats = {
  planned: number;
  completed: number;
  topThreePlanned: number;
  topThreeCompleted: number;
  timeBlocksPlanned: number;
  timeBlocksCompleted: number;
};

export type TagPerformanceStats = {
  tag: string;
  openTasks: number;
  completedTasks: number;
  totalTasks: number;
};

export type ProjectPerformance = {
  projectId: string;
  name: string;
  emoji: string | null;
  area: ProjectArea;
  color: string;
  completedTasks: number;
  focusMinutes: number;
  openTasks: number;
  overdueTasks: number;
  urgentHighOpen: number;
  priorityCompleted: number;
  lastActivityDate: string;
  daysSinceActivity: number | null;
  score: number;
  status: PerformanceStatus;
  message: string;
};

export type AreaPerformance = {
  area: ProjectArea | "Uncategorized";
  emoji: string | null;
  completedTasks: number;
  focusMinutes: number;
  openTasks: number;
  overdueTasks: number;
  urgentHighOpen: number;
  priorityCompleted: number;
  lastActivityDate: string;
  daysSinceActivity: number | null;
  score: number;
  status: PerformanceStatus;
  message: string;
};

export type PerformanceRecommendation = {
  id: string;
  title: string;
  message: string;
  severity: InsightSeverity;
  action: string;
  projectId?: string;
  area?: ProjectArea | "Uncategorized";
};

export type ConfirmDialogState = {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  variant: "normal" | "destructive";
  onConfirm: () => Promise<void> | void;
};

export type FavoriteQuote = {
  id: string;
  userId: string;
  quoteId: string;
  createdAt: Timestamp | null;
};
