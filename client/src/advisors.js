export const ADVISORS = [
  {
    id: "vc-musk",
    name: "Elon Musk",
    role: "Venture Capitalist",
    roleShort: "VC",
    color: "#6366f1",
    icon: "Rocket",
    description: "First principles · Bold contrarian bets · 10-year vision",
    bestFor: "Moonshots & technical bets",
    model: "claude-sonnet-4-20250514",
    provider: "Anthropic",
  },
  {
    id: "operator-bezos",
    name: "Jeff Bezos",
    role: "Operator",
    roleShort: "Operator",
    color: "#f59e0b",
    icon: "Box",
    description: "Customer obsession · Day 1 mentality · Operational excellence",
    bestFor: "Operations & scaling",
    model: "gpt-4o",
    provider: "OpenAI",
  },
  {
    id: "growth-gary",
    name: "Gary Vee",
    role: "Growth Strategist",
    roleShort: "Growth",
    color: "#ef4444",
    icon: "TrendingUp",
    description: "Attention economics · Speed over perfection · Hustle",
    bestFor: "Launch & distribution",
    model: "gpt-4o",
    provider: "OpenAI",
  },
  {
    id: "skeptic-taleb",
    name: "Nassim Taleb",
    role: "Skeptic",
    roleShort: "Skeptic",
    color: "#06b6d4",
    icon: "ShieldAlert",
    description: "Antifragility · Black swan risks · Skin in the game",
    bestFor: "Risk & stress-testing",
    model: "claude-sonnet-4-20250514",
    provider: "Anthropic",
  },
];

export const SYNTHESIS_MODEL = "claude-sonnet-4-20250514";

export const BOARD_PRESETS = [
  {
    id: "full",
    label: "Full Board",
    advisorIds: ["vc-musk", "operator-bezos", "growth-gary", "skeptic-taleb"],
  },
  {
    id: "investor",
    label: "Investor Board",
    advisorIds: ["vc-musk", "skeptic-taleb"],
  },
  {
    id: "growth",
    label: "Growth Board",
    advisorIds: ["growth-gary", "operator-bezos"],
  },
  {
    id: "personal",
    label: "Personal Board",
    advisorIds: ["growth-gary", "skeptic-taleb"],
  },
];

export function getAdvisorModelsMap() {
  const map = {};
  ADVISORS.forEach((a) => {
    map[a.id] = a.model;
  });
  return map;
}
