import { collection, doc, getDoc, getDocs, query, Timestamp, where, writeBatch } from "firebase/firestore";
import { db } from "./firebase";
import type { DemoSeedResult, EnergyLevel, FocusMode, ProjectArea, TaskPriority, TimeBlockType } from "./types";

const demoProjects: Array<{
  id: string;
  name: string;
  emoji: string;
  area: ProjectArea;
  color: string;
  tags: string[];
  priorityBias: TaskPriority;
  energy: EnergyLevel;
}> = [
  { id: "demo-german-b2", name: "German B2", emoji: "📚", area: "Study", color: "#10B981", tags: ["german", "study"], priorityBias: "high", energy: "medium" },
  { id: "demo-full-stack", name: "Full Stack Development", emoji: "💻", area: "Study", color: "#2563EB", tags: ["coding", "development"], priorityBias: "high", energy: "high" },
  { id: "demo-uopeople", name: "UoPeople", emoji: "🎓", area: "Study", color: "#8B5CF6", tags: ["uopeople", "university"], priorityBias: "urgent", energy: "high" },
  { id: "demo-seo-client", name: "SEO / Client Work", emoji: "📈", area: "Client Work", color: "#F97316", tags: ["seo", "client"], priorityBias: "medium", energy: "medium" },
  { id: "demo-business-ideas", name: "Business Ideas", emoji: "💰", area: "Business", color: "#F59E0B", tags: ["business", "growth"], priorityBias: "medium", energy: "low" },
  { id: "demo-health-discipline", name: "Health & Discipline", emoji: "🏋️", area: "Health", color: "#EF4444", tags: ["health", "discipline"], priorityBias: "low", energy: "medium" },
];

const focusPattern: Record<string, number[]> = {
  "demo-german-b2": [29, 27, 25, 33, 30, 28, 35, 25, 31, 30, 26, 32],
  "demo-full-stack": [25, 42, 30, 28, 25, 35, 45, 30],
  "demo-uopeople": [25, 25, 30],
  "demo-seo-client": [30, 35, 25, 40],
  "demo-business-ideas": [25, 30],
  "demo-health-discipline": [20, 25, 20],
};

const taskTitles: Record<string, string[]> = {
  "demo-german-b2": ["Review modal verbs", "Write B2 speaking answers", "Read German article", "Practice listening notes", "Memorize transition phrases"],
  "demo-full-stack": ["Refactor React components", "Finish Firebase reporting", "Build TypeScript utility", "Review deployment checklist", "Improve dashboard charts"],
  "demo-uopeople": ["Submit discussion post", "Read assigned chapter", "Prepare written assignment", "Review quiz notes", "Update study calendar"],
  "demo-seo-client": ["Audit client keywords", "Draft SEO brief", "Review search console data", "Send client update", "Optimize landing page"],
  "demo-business-ideas": ["Outline offer idea", "Compare pricing models", "Write landing page notes", "Review competitor examples", "Plan experiment"],
  "demo-health-discipline": ["Plan strength workout", "Track sleep notes", "Prepare healthy meal", "Walk 30 minutes", "Stretch and reflect"],
};

export async function seedDemoAnalyticsData(userId: string): Promise<DemoSeedResult> {
  await removeDemoAnalyticsData(userId);

  const batch = writeBatch(db);
  const now = new Date();
  const seedId = `demo-${Date.now()}`;
  const result: DemoSeedResult = { projects: 0, tasks: 0, focusSessions: 0, dailyPlans: 0 };
  const completedTaskIdsByDate = new Map<string, string[]>();

  demoProjects.forEach((project, index) => {
    const projectDocId = getDemoProjectDocId(seedId, project.id);
    batch.set(doc(db, "users", userId, "projects", projectDocId), {
      id: projectDocId,
      userId,
      name: project.name,
      description: `Demo analytics project for ${project.name}.`,
      color: project.color,
      status: "active",
      area: project.area,
      createdAt: Timestamp.fromDate(addDays(now, -90)),
      updatedAt: Timestamp.fromDate(addDays(now, -index)),
      archivedAt: null,
      completedAt: null,
      emoji: project.emoji,
      icon: null,
      isDemoData: true,
    });
    result.projects += 1;
  });

  demoProjects.forEach((project, projectIndex) => {
    const titles = taskTitles[project.id];
    const completedCount = project.id === "demo-health-discipline" ? 4 : project.id === "demo-business-ideas" ? 5 : 8;
    const projectDocId = getDemoProjectDocId(seedId, project.id);

    for (let index = 0; index < completedCount; index += 1) {
      const completedDate = addDays(now, -((index * 6 + projectIndex * 2) % 75));
      const dateId = toDateId(completedDate);
      const taskId = `${seedId}-task-${project.id}-done-${index}`;
      addToDateMap(completedTaskIdsByDate, dateId, taskId);
      batch.set(doc(db, "users", userId, "tasks", taskId), {
        id: taskId,
        userId,
        title: `${titles[index % titles.length]}`,
        description: `Demo completed task for ${project.name}.`,
        status: "done",
        priority: index % 5 === 0 ? "urgent" : index % 2 === 0 ? project.priorityBias : "medium",
        dueDate: dateId,
        tags: project.tags,
        estimatedMinutes: 25 + ((index + projectIndex) % 3) * 15,
        energyLevel: project.energy,
        createdAt: Timestamp.fromDate(addDays(completedDate, -3)),
        updatedAt: Timestamp.fromDate(completedDate),
        completedAt: Timestamp.fromDate(completedDate),
        notes: "",
        projectId: projectDocId,
        emoji: project.emoji,
        icon: null,
        isDemoData: true,
      });
      result.tasks += 1;
    }

    const openCount = project.id === "demo-uopeople" ? 5 : project.id === "demo-full-stack" ? 4 : 3;
    for (let index = 0; index < openCount; index += 1) {
      const overdue = project.id === "demo-uopeople" && index < 3;
      const dueDate = overdue ? addDays(now, -(index + 1)) : addDays(now, index + projectIndex + 2);
      const taskId = `${seedId}-task-${project.id}-open-${index}`;
      batch.set(doc(db, "users", userId, "tasks", taskId), {
        id: taskId,
        userId,
        title: `${titles[(index + 2) % titles.length]}`,
        description: overdue ? "Demo overdue task to test reporting pressure." : `Demo open task for ${project.name}.`,
        status: index === 0 ? "today" : "upcoming",
        priority: overdue ? "urgent" : index % 2 === 0 ? project.priorityBias : "medium",
        dueDate: toDateId(dueDate),
        tags: project.tags,
        estimatedMinutes: 30 + index * 10,
        energyLevel: project.energy,
        createdAt: Timestamp.fromDate(addDays(now, -(20 + index + projectIndex))),
        updatedAt: Timestamp.fromDate(addDays(now, -(index + 1))),
        completedAt: null,
        notes: "",
        projectId: projectDocId,
        emoji: project.emoji,
        icon: null,
        isDemoData: true,
      });
      result.tasks += 1;
    }
  });

  demoProjects.forEach((project, projectIndex) => {
    const minutes = focusPattern[project.id];
    const projectDocId = getDemoProjectDocId(seedId, project.id);
    minutes.forEach((actualMinutes, index) => {
      const date = addDays(now, -((index * 5 + projectIndex * 3) % 85));
      const dateId = toDateId(date);
      const sessionId = `${seedId}-focus-${project.id}-${index}`;
      const linkedTaskId = `${seedId}-task-${project.id}-done-${index % Math.max(1, taskTitles[project.id].length)}`;
      batch.set(doc(db, "users", userId, "focusSessions", sessionId), {
        id: sessionId,
        userId,
        taskId: linkedTaskId,
        projectId: projectDocId,
        dailyPlanDate: dateId,
        mode: index % 5 === 0 ? ("custom" satisfies FocusMode) : ("pomodoro" satisfies FocusMode),
        plannedMinutes: actualMinutes >= 35 ? actualMinutes : 25,
        actualMinutes,
        status: "completed",
        startedAt: setTime(date, 9 + (index % 8), 0).toISOString(),
        pausedAt: null,
        completedAt: setTime(date, 9 + (index % 8), actualMinutes).toISOString(),
        cancelledAt: null,
        notes: `Demo focus session for ${project.name}.`,
        createdAt: Timestamp.fromDate(date),
        updatedAt: Timestamp.fromDate(date),
        isDemoData: true,
      });
      result.focusSessions += 1;
    });
  });

  const planDates = [...completedTaskIdsByDate.keys()].sort().reverse().slice(0, 14);
  for (const [index, dateId] of planDates.entries()) {
    const planRef = doc(db, "users", userId, "dailyPlans", dateId);
    const existing = await getDoc(planRef);
    if (existing.exists() && !existing.data().isDemoData) {
      continue;
    }

    const topTaskIds = completedTaskIdsByDate.get(dateId)?.slice(0, 3) ?? [];
    const firstProject = demoProjects[index % demoProjects.length];
    const planDate = parseDateId(dateId);
    batch.set(planRef, {
      id: dateId,
      userId,
      date: dateId,
      topTaskIds,
      deepWorkTaskId: topTaskIds[0] ?? null,
      timeBlocks: [
        {
          id: `demo-block-${dateId}-focus`,
          taskId: topTaskIds[0] ?? null,
          title: `${firstProject.name} focus block`,
          startTime: "09:00",
          endTime: "09:45",
          type: "deep-work" satisfies TimeBlockType,
          notes: "Demo planned deep work.",
          completed: index % 3 !== 0,
        },
        {
          id: `demo-block-${dateId}-admin`,
          taskId: null,
          title: "Admin review",
          startTime: "15:00",
          endTime: "15:30",
          type: "admin" satisfies TimeBlockType,
          notes: "",
          completed: index % 2 === 0,
        },
      ],
      reflection: {
        wentWell: "Protected one meaningful work block.",
        distractions: index % 2 === 0 ? "Context switching." : "Low energy in the afternoon.",
        improveTomorrow: "Choose one priority before opening inbox.",
        energyLevel: index % 3 === 0 ? "low" : index % 3 === 1 ? "medium" : "high",
        mood: index % 4 === 0 ? "okay" : index % 4 === 1 ? "good" : "great",
      },
      createdAt: Timestamp.fromDate(planDate),
      updatedAt: Timestamp.fromDate(planDate),
      isDemoData: true,
    });
    result.dailyPlans += 1;
  }

  await batch.commit();
  return result;
}

export async function removeDemoAnalyticsData(userId: string): Promise<DemoSeedResult> {
  const collections = ["projects", "tasks", "focusSessions", "dailyPlans"] as const;
  const result: DemoSeedResult = { projects: 0, tasks: 0, focusSessions: 0, dailyPlans: 0 };
  const batch = writeBatch(db);

  for (const collectionName of collections) {
    const snapshot = await getDocs(query(collection(db, "users", userId, collectionName), where("isDemoData", "==", true)));
    snapshot.docs.forEach((snapshotDoc) => {
      batch.delete(snapshotDoc.ref);
      if (collectionName === "focusSessions") {
        result.focusSessions += 1;
      } else {
        result[collectionName] += 1;
      }
    });
  }

  await batch.commit();
  return result;
}

function addToDateMap(map: Map<string, string[]>, dateId: string, taskId: string) {
  map.set(dateId, [...(map.get(dateId) ?? []), taskId]);
}

function getDemoProjectDocId(seedId: string, projectId: string) {
  return `${seedId}-${projectId}`;
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function parseDateId(dateId: string) {
  return new Date(`${dateId}T00:00:00`);
}

function setTime(date: Date, hour: number, minute: number) {
  const next = new Date(date);
  next.setHours(hour, minute, 0, 0);
  return next;
}

function toDateId(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
