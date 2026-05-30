import type { AppIconId, ThemeMode, ThemePreset, UserSettings } from "./types";

export const themePresets: Array<{ id: ThemePreset; name: string; color: string; description: string }> = [
  { id: "sage", name: "Sage", color: "#236873", description: "Calm LifeOS default" },
  { id: "blue", name: "Blue", color: "#2563eb", description: "Clear task-app blue" },
  { id: "violet", name: "Violet", color: "#7c3aed", description: "Reflective planning" },
  { id: "amber", name: "Amber", color: "#d97706", description: "Warm and focused" },
  { id: "rose", name: "Rose", color: "#e11d48", description: "High-energy accent" },
  { id: "custom", name: "Custom", color: "#236873", description: "Choose your own accent" },
];

export const appIconOptions: Array<{ id: AppIconId; name: string; description: string; glyph: string }> = [
  { id: "leaf", name: "Leaf", description: "Classic LifeOS mark", glyph: "L" },
  { id: "focus", name: "Focus", description: "Deep work target", glyph: "F" },
  { id: "spark", name: "Spark", description: "Momentum and ideas", glyph: "S" },
  { id: "moon", name: "Moon", description: "Calm night planning", glyph: "M" },
  { id: "compass", name: "Compass", description: "Direction and review", glyph: "C" },
];

export const defaultUserSettings: UserSettings = {
  id: "main",
  userId: "",
  themeMode: "system",
  themePreset: "sage",
  accentColor: "#236873",
  appIcon: "leaf",
  createdAt: null,
  updatedAt: null,
};

export function createDefaultUserSettings(userId: string): UserSettings {
  return { ...defaultUserSettings, userId };
}

export function normalizeThemeMode(value: unknown): ThemeMode {
  return value === "light" || value === "dark" || value === "system" ? value : "system";
}

export function normalizeThemePreset(value: unknown): ThemePreset {
  return themePresets.some((preset) => preset.id === value) ? (value as ThemePreset) : "sage";
}

export function normalizeAppIcon(value: unknown): AppIconId {
  return appIconOptions.some((icon) => icon.id === value) ? (value as AppIconId) : "leaf";
}

export function normalizeAccentColor(value: unknown, preset: ThemePreset) {
  const fallback = getPresetAccentColor(preset);
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
}

export function getPresetAccentColor(preset: ThemePreset) {
  return themePresets.find((item) => item.id === preset)?.color ?? "#236873";
}

export function getEffectiveAccentColor(settings: Pick<UserSettings, "themePreset" | "accentColor">) {
  return settings.themePreset === "custom" ? settings.accentColor : getPresetAccentColor(settings.themePreset);
}

export function getDerivedThemeColors(accentColor: string) {
  const rgb = hexToRgb(accentColor) ?? { r: 35, g: 104, b: 115 };
  const dark = mixRgb(rgb, { r: 15, g: 23, b: 20 }, 0.35);
  const soft = mixRgb(rgb, { r: 255, g: 255, b: 255 }, 0.84);

  return {
    primary: rgbToHex(rgb),
    primaryStrong: rgbToHex(dark),
    primarySoft: rgbToHex(soft),
  };
}

export function getResolvedThemeMode(mode: ThemeMode) {
  if (mode === "light" || mode === "dark") {
    return mode;
  }
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function getAppIconDataUrl(icon: AppIconId, accentColor: string, mode: "light" | "dark" = "light") {
  const svg = getAppIconSvg(icon, accentColor, mode);
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function getAppIconSvg(icon: AppIconId, accentColor: string, mode: "light" | "dark" = "light") {
  const bg = mode === "dark" ? "#0f1714" : accentColor;
  const fg = mode === "dark" ? accentColor : "#f8fafc";
  const warm = mode === "dark" ? "#f4bd4f" : "#f59e0b";

  if (icon === "focus") {
    return svgShell(bg, `<circle cx="64" cy="64" r="34" fill="${fg}" opacity="0.94"/><circle cx="64" cy="64" r="17" fill="${bg}"/><circle cx="64" cy="64" r="7" fill="${warm}"/>`);
  }

  if (icon === "spark") {
    return svgShell(bg, `<path d="M64 24l9 28 29 10-29 9-9 33-10-33-28-9 28-10 10-28z" fill="${fg}"/><circle cx="90" cy="33" r="8" fill="${warm}"/>`);
  }

  if (icon === "moon") {
    return svgShell(bg, `<path d="M80 95c-26 0-47-21-47-47 0-8 2-16 6-23 5 24 26 42 51 42 7 0 14-1 20-4-7 19-24 32-30 32z" fill="${fg}"/><circle cx="88" cy="38" r="7" fill="${warm}"/>`);
  }

  if (icon === "compass") {
    return svgShell(bg, `<circle cx="64" cy="64" r="39" fill="none" stroke="${fg}" stroke-width="10"/><path d="M80 32L68 69 32 83l12-38 36-13z" fill="${fg}"/><circle cx="64" cy="64" r="6" fill="${warm}"/>`);
  }

  return svgShell(bg, `<path d="M31 72c10-25 27-38 50-39 10 0 18 3 25 8-15 1-26 8-34 18-8 10-15 17-25 21-7 3-12 0-16-8z" fill="${fg}"/><path d="M27 87c22 7 43 3 61-12 9-7 15-16 17-27 8 20 4 38-11 50-17 14-41 11-67-11z" fill="${warm}"/>`);
}

function svgShell(background: string, content: string) {
  return `<svg width="128" height="128" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="128" height="128" rx="28" fill="${background}"/>${content}</svg>`;
}

function hexToRgb(value: string) {
  const match = value.match(/^#([0-9a-fA-F]{6})$/);
  if (!match) {
    return null;
  }
  const int = Number.parseInt(match[1], 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
}

function mixRgb(from: { r: number; g: number; b: number }, to: { r: number; g: number; b: number }, amount: number) {
  return {
    r: Math.round(from.r * (1 - amount) + to.r * amount),
    g: Math.round(from.g * (1 - amount) + to.g * amount),
    b: Math.round(from.b * (1 - amount) + to.b * amount),
  };
}

function rgbToHex({ r, g, b }: { r: number; g: number; b: number }) {
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}
