import type { Quote } from "./types";

export const quotes: Quote[] = [
  {
    id: "marcus-discipline-1",
    text: "Waste no more time arguing what a good person should be. Be one.",
    author: "Marcus Aurelius",
    category: "discipline",
    context: "A prompt to turn planning into conduct.",
  },
  {
    id: "seneca-focus-1",
    text: "To be everywhere is to be nowhere.",
    author: "Seneca",
    category: "focus",
    context: "Scattered attention weakens real progress.",
  },
  {
    id: "epictetus-courage-1",
    text: "First say to yourself what you would be; then do what you have to do.",
    author: "Epictetus",
    category: "courage",
    context: "Identity needs matching action.",
  },
  {
    id: "rumi-patience-1",
    text: "Patience is the key to joy.",
    author: "Attributed to Rumi",
    category: "patience",
    context: "Steady work compounds more than urgency.",
  },
  {
    id: "saadi-wisdom-1",
    text: "Have patience. All things are difficult before they become easy.",
    author: "Attributed to Saadi",
    category: "wisdom",
    context: "Difficulty is often the first stage of mastery.",
  },
  {
    id: "confucius-learning-1",
    text: "It does not matter how slowly you go as long as you do not stop.",
    author: "Attributed to Confucius",
    category: "learning",
    context: "A useful frame for long study arcs.",
  },
  {
    id: "aristotle-ambition-1",
    text: "We are what we repeatedly do.",
    author: "Attributed to Aristotle",
    category: "ambition",
    context: "Repeated choices become the system.",
  },
  {
    id: "frankl-resilience-1",
    text: "When we cannot change a situation, we are challenged to change ourselves.",
    author: "Viktor Frankl",
    category: "resilience",
    context: "Agency often begins with response, not control.",
  },
  {
    id: "nietzsche-humility-1",
    text: "He who has a why can bear almost any how.",
    author: "Friedrich Nietzsche",
    category: "resilience",
    context: "Purpose makes hard execution more tolerable.",
  },
  {
    id: "dostoevsky-humility-1",
    text: "To live without hope is to cease to live.",
    author: "Fyodor Dostoevsky",
    category: "humility",
    context: "Reflection should preserve hope, not only judgment.",
  },
];

export function getDailyQuote(dateId: string, offset = 0) {
  const indexSeed = dateId.split("").reduce((total, char) => total + char.charCodeAt(0), 0);
  return quotes[(indexSeed + offset) % quotes.length] ?? quotes[0];
}

export function getRandomQuote(excludeQuoteId?: string) {
  const candidates = excludeQuoteId ? quotes.filter((quote) => quote.id !== excludeQuoteId) : quotes;
  return candidates[Math.floor(Math.random() * candidates.length)] ?? quotes[0];
}
