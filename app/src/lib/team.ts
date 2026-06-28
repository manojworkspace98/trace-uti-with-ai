// Team ARM — A*STAR Makeathon 2022 (2nd place).
// Source: https://www.linkedin.com/pulse/team-arm-our-journey-through-astar-makeathon-2022-kimberly-su/
// Photos auto-upgrade: drop "<photo>.jpg" into app/public/team/ and it replaces
// the gradient-initials avatar automatically.
export interface Member {
  name: string;
  role: string;
  blurb?: string;
  photo: string; // filename in public/team/<photo>.jpg
  hasPhoto?: boolean; // true once a real photo file exists (avoids 404 fetches)
  lead?: boolean;
  alumni?: boolean; // former member who has since left the team
  linkedin?: string;
}

export const TEAM: Member[] = [
  {
    name: "Liyana Ow Yong, PhD",
    role: "Co-founder · CEO",
    blurb: "Wet-lab scientist leading the team as CEO.",
    photo: "liyana",
    hasPhoto: true,
    lead: true,
    linkedin: "https://www.linkedin.com/in/liyanaaoy/",
  },
  {
    name: "Kimberly Su (PhD candidate)",
    role: "Co-founder · COO",
    blurb: "Leads operations and legal/regulatory strategy.",
    photo: "kimberly",
    hasPhoto: true,
    lead: true,
    linkedin: "https://www.linkedin.com/in/kimberlysuyy/",
  },
  {
    name: "Manoj Itharajula (PhD candidate)",
    role: "Co-founder · CTO · AI Scientist",
    blurb: "Builds the machine-learning pipeline behind Trace.",
    photo: "manoj",
    hasPhoto: true,
    lead: true,
    linkedin: "https://www.linkedin.com/in/manoj-itharajula/",
  },
  {
    name: "Suma Tiruvayipati",
    role: "Researcher",
    blurb: "Surfaced the foundational research that inspired the project.",
    photo: "suma",
    alumni: true,
  },
  {
    name: "Mauricio Lisboa Perez",
    role: "Data access",
    blurb: "Enabled access to the clinical datasets.",
    photo: "mauricio",
    alumni: true,
  },
  {
    name: "Mile Šikić",
    role: "Computational advisor",
    blurb: "Advised on the computational approach.",
    photo: "mile",
    alumni: true,
  },
  {
    name: "Sebastian Maurer-Stroh",
    role: "Mentor",
    blurb: "Provided strategic guidance and mentorship.",
    photo: "sebastian",
    alumni: true,
  },
  {
    name: "Jacyln Siw",
    role: "Business development",
    blurb: "Drove business development and connected the team.",
    photo: "jaclyn",
    alumni: true,
  },
  {
    name: "Cornelius Lee Yien Hui",
    role: "Marketing strategist",
    blurb: "Shaped the team’s marketing strategy.",
    photo: "cornelius",
    alumni: true,
  },
];

export const LINKEDIN_ARTICLE =
  "https://www.linkedin.com/pulse/team-arm-our-journey-through-astar-makeathon-2022-kimberly-su/";

export const MAKEATHON_LINK = "https://www.co11ab.sg/astar-makeathon-2022/";

/** Deterministic teal/aqua gradient per name for the fallback avatar. */
export function avatarGradient(name: string): [string, string] {
  const palettes: [string, string][] = [
    ["#22d3ee", "#0e7490"],
    ["#2dd4bf", "#0f766e"],
    ["#38bdf8", "#0369a1"],
    ["#5eead4", "#0d9488"],
    ["#67e8f9", "#155e75"],
    ["#34d399", "#047857"],
    ["#7dd3fc", "#0891b2"],
  ];
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return palettes[h % palettes.length];
}

export function initials(name: string): string {
  return name
    .replace(/,.*$/, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}
