import type { EnergyLevel, ProjectArea, ProjectStatus, TaskPriority, TaskStatus } from "./types";

export const taskStatuses: TaskStatus[] = ["inbox", "today", "upcoming", "done", "archived"];
export const priorities: TaskPriority[] = ["low", "medium", "high", "urgent"];
export const energyLevels: EnergyLevel[] = ["low", "medium", "high"];

export const projectStatuses: ProjectStatus[] = ["active", "paused", "completed", "archived"];
export const projectAreas: ProjectArea[] = ["Study", "Business", "Health", "Client Work", "Personal", "Other"];

export const starterProjects = [
  {
    name: "German B2",
    description: "Vocabulary, grammar practice, exam preparation, and speaking drills.",
    color: "#2a5f48",
    area: "Study",
  },
  {
    name: "Full Stack Development",
    description: "Frontend, backend, Firebase, deployment, and portfolio work.",
    color: "#334963",
    area: "Study",
  },
  {
    name: "UoPeople",
    description: "Coursework, discussion posts, assignments, and academic planning.",
    color: "#8a4a38",
    area: "Study",
  },
  {
    name: "SEO / Client Work",
    description: "Client deliverables, keyword research, audits, and reporting.",
    color: "#6d4814",
    area: "Client Work",
  },
  {
    name: "Business Ideas",
    description: "Opportunity research, experiments, offers, and launch tasks.",
    color: "#7d241d",
    area: "Business",
  },
  {
    name: "Health & Discipline",
    description: "Training, routines, sleep, nutrition, and personal discipline.",
    color: "#28533f",
    area: "Health",
  },
] as const;
