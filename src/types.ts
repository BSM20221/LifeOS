import type { Timestamp } from "firebase/firestore";

export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskStatus = "inbox" | "today" | "upcoming" | "done" | "archived";
export type EnergyLevel = "low" | "medium" | "high";
export type ProjectStatus = "active" | "paused" | "completed" | "archived";
export type ProjectArea = "Study" | "Business" | "Health" | "Client Work" | "Personal" | "Other";

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
};

export type ProjectFormValues = {
  name: string;
  description: string;
  color: string;
  status: ProjectStatus;
  area: ProjectArea;
};

export type ProjectStats = {
  openTasks: number;
  completedTasks: number;
  totalTasks: number;
  progress: number;
};
