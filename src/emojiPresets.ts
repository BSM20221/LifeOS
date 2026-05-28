export const emojiPresets = [
  { emoji: "📚", label: "German/Study" },
  { emoji: "💻", label: "Coding" },
  { emoji: "🎓", label: "University" },
  { emoji: "📈", label: "SEO/Business" },
  { emoji: "🏋️", label: "Health" },
  { emoji: "💰", label: "Money" },
  { emoji: "🧠", label: "Deep work" },
  { emoji: "📝", label: "Writing" },
  { emoji: "🛠️", label: "Maintenance" },
  { emoji: "☎️", label: "Admin" },
  { emoji: "🌱", label: "Growth" },
  { emoji: "🔥", label: "Urgent" },
  { emoji: "⭐", label: "Important" },
  { emoji: "🧹", label: "Cleanup" },
  { emoji: "📖", label: "Reading" },
  { emoji: "🧪", label: "Experiment" },
  { emoji: "🧭", label: "Planning" },
  { emoji: "🕊️", label: "Reflection" },
  { emoji: "⚡", label: "Quick task" },
  { emoji: "🧱", label: "System building" },
] as const;

export function displayWithEmoji(name: string, emoji?: string | null) {
  return emoji ? `${emoji} ${name}` : name;
}
