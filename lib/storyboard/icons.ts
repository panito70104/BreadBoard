/**
 * The drawing vocabulary.
 *
 * Every name here is a real `lucide-react` export: stroke-only SVG with no
 * fills, which is exactly what animates well when the hand draws it. Run them
 * through Rough.js at render time to get the hand-drawn wobble.
 *
 * This list is deliberately closed. The model may only pick from it, so it
 * cannot invent an icon the engine has no way to draw. Grow it from the
 * `unknown-icon` warnings the validator reports on real documents.
 *
 * It leans hard toward concrete nouns — a house, a bus, an apple, a dog — and
 * away from the abstract interface glyphs an icon set is mostly made of. You
 * cannot explain anything to a ten-year-old with a picture of a funnel, and a
 * board covered in UI chrome looks like software, not like a lesson. If you are
 * choosing between adding `DataFlow` and adding `Bicycle`, add the bicycle.
 */

export const ICON_VOCABULARY = {
  idea: [
    "Brain",
    "Lightbulb",
    "Sparkles",
    "Target",
    "Puzzle",
    "Key",
    "Compass",
    "Flag",
    "Milestone",
    "Eye",
  ],
  estudio: [
    "BookOpen",
    "Book",
    "GraduationCap",
    "Notebook",
    "NotebookPen",
    "PenLine",
    "Pencil",
    "Highlighter",
    "School",
    "Library",
    "FileText",
    "ClipboardList",
    "StickyNote",
  ],
  ciencia: [
    "Atom",
    "FlaskConical",
    "TestTube",
    "Microscope",
    "Dna",
    "Magnet",
    "Orbit",
    "Telescope",
    "Thermometer",
    "Leaf",
    "Sprout",
    "TreePine",
    "Bug",
    "Fish",
    "Bird",
    "Droplet",
    "Flame",
    "Sun",
    "Moon",
    "Cloud",
    "Wind",
    "Mountain",
    "Waves",
    "Globe",
    "Snowflake",
    "Rocket",
  ],
  cuerpo: ["Heart", "HeartPulse", "Activity", "Stethoscope", "Pill", "Bone", "Ear"],
  matematicas: [
    "Calculator",
    "Sigma",
    "Percent",
    "Divide",
    "Plus",
    "Minus",
    "Equal",
    "Infinity",
    "TrendingUp",
    "TrendingDown",
    "Ruler",
    "Triangle",
    "Circle",
    "Square",
    "Hexagon",
    "Binary",
    "Grid3x3",
    "ChartColumn",
    "ChartLine",
    "ChartPie",
    "ChartScatter",
  ],
  tiempo: [
    "Clock",
    "Timer",
    "Calendar",
    "Hourglass",
    "History",
    "RefreshCw",
    "Repeat",
    "ArrowRight",
    "ArrowLeftRight",
    "ArrowDown",
    "GitBranch",
    "Workflow",
    "Route",
    "Footprints",
    "ListOrdered",
    "ListChecks",
  ],
  sociedad: [
    "Coins",
    "DollarSign",
    "Banknote",
    "Scale",
    "Building2",
    "Factory",
    "Truck",
    "ShoppingCart",
    "Handshake",
    "Users",
    "User",
    "Vote",
    "Gavel",
    "Crown",
    "Swords",
    "Shield",
    "Landmark",
    "Anchor",
  ],
  tecnologia: [
    "Cpu",
    "Laptop",
    "Smartphone",
    "Server",
    "Database",
    "Code",
    "Network",
    "Wifi",
    "Bot",
    "Zap",
    "Battery",
    "Plug",
    "Lock",
    "Unlock",
    "Cog",
    "Wrench",
    "Hammer",
  ],
  comunicacion: [
    "MessageCircle",
    "Quote",
    "Megaphone",
    "Languages",
    "Mic",
    "Volume2",
    "Mail",
    "Send",
    "Speech",
  ],
  lugares: [
    "House",
    "Store",
    "Hospital",
    "Church",
    "Warehouse",
    "Tent",
    "DoorOpen",
    "Bed",
    "Lamp",
    "Bath",
    "MapPin",
    "Map",
  ],
  transporte: ["Car", "Bus", "Bike", "Plane", "Ship", "Train"],
  naturaleza: [
    "Trees",
    "TreeDeciduous",
    "TreePalm",
    "Flower",
    "Wheat",
    "Earth",
    "Sunrise",
    "Sunset",
    "CloudRain",
    "CloudLightning",
    "Umbrella",
    "Shell",
    "Feather",
    "Droplets",
  ],
  animales: ["Dog", "Cat", "Rabbit", "Turtle", "Squirrel", "Snail", "PawPrint"],
  comida: [
    "Apple",
    "Carrot",
    "Egg",
    "Pizza",
    "Sandwich",
    "Cookie",
    "Coffee",
    "Milk",
    "Utensils",
    "CupSoda",
    "Beef",
    "Soup",
  ],
  gente: [
    "PersonStanding",
    "Baby",
    "UserPlus",
    "HeartHandshake",
    "Smile",
    "Frown",
    "Angry",
    "Laugh",
    "Skull",
    "Hand",
  ],
  objetos: [
    "Box",
    "Package",
    "Gift",
    "Ticket",
    "Wallet",
    "PiggyBank",
    "CreditCard",
    "Receipt",
    "Bell",
    "Backpack",
    "Paperclip",
    "Newspaper",
    "Trash2",
    "Recycle",
    "Shirt",
    "Watch",
    "Glasses",
    "Syringe",
    "Bandage",
  ],
  arte: [
    "Palette",
    "Brush",
    "Music",
    "Guitar",
    "Drum",
    "Camera",
    "Tv",
    "Phone",
    "Radio",
    "Clapperboard",
  ],
  senales: [
    "Check",
    "CircleCheck",
    "CircleAlert",
    "Info",
    "CircleHelp",
    "Star",
    "ThumbsUp",
    "ThumbsDown",
    "Ban",
    "TriangleAlert",
    "Search",
    "Filter",
    "Layers",
    "Link",
    "Award",
    "Trophy",
    "Scissors",
  ],
} as const;

export type IconGroup = keyof typeof ICON_VOCABULARY;

export const ICON_IDS: string[] = Object.values(ICON_VOCABULARY).flat();

const ICON_SET = new Set(ICON_IDS);

export function isKnownIcon(id: unknown): id is string {
  return typeof id === "string" && ICON_SET.has(id);
}

/** Stands in when the model asks for an icon outside the vocabulary. */
export const FALLBACK_ICON = "Lightbulb";

/**
 * Best-effort match for a near miss ("BookOpenIcon", "book-open", "books").
 * Saves a drawing that would otherwise be replaced by the generic fallback.
 */
export function resolveIconId(raw: string): string | null {
  if (ICON_SET.has(raw)) return raw;

  const normalized = raw.replace(/[^a-z0-9]/gi, "").toLowerCase();
  if (!normalized) return null;

  const exact = ICON_IDS.find((id) => id.toLowerCase() === normalized);
  if (exact) return exact;

  const suffixed = ICON_IDS.find((id) => `${id.toLowerCase()}icon` === normalized);
  if (suffixed) return suffixed;

  const singular = normalized.replace(/s$/, "");
  return ICON_IDS.find((id) => id.toLowerCase() === singular) ?? null;
}
