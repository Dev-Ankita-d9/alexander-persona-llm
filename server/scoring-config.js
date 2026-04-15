const fs = require("fs");
const path = require("path");

const CONFIG_FILE = path.join(__dirname, "scoring-config.json");

const DEFAULTS = {
  dimensions: [
    {
      id: "specificity",
      label: "Specificity",
      description: "Concrete details, numbers, examples — not vague generalities",
      weight: 1.0,
    },
    {
      id: "credibility",
      label: "Credibility",
      description: "Claims are well-supported, realistic, evidence-based",
      weight: 1.0,
    },
    {
      id: "narrative",
      label: "Narrative Strength",
      description: "Compelling, clear, logically structured argument",
      weight: 1.0,
    },
  ],
  sections: [
    "problem",
    "solution",
    "market",
    "traction",
    "businessModel",
    "competition",
    "team",
    "ask",
    "moat",
  ],
  sectionLabels: {
    problem: "Problem",
    solution: "Solution",
    market: "Market",
    traction: "Traction",
    businessModel: "Business Model",
    competition: "Competition",
    team: "Team",
    ask: "Funding Ask",
    moat: "Moat / Defensibility",
  },
  thresholds: {
    refine: 4,
    review: 6,
  },
  refinement: {
    maxPasses: 3,
    minImprovementDelta: 0.5,
  },
  roleWeights: {
    problem: {
      "Venture Capitalist": 0.30,
      "Operator": 0.25,
      "Growth Strategist": 0.20,
      "Skeptic": 0.25,
    },
    solution: {
      "Venture Capitalist": 0.20,
      "Operator": 0.40,
      "Growth Strategist": 0.15,
      "Skeptic": 0.25,
    },
    market: {
      "Venture Capitalist": 0.40,
      "Operator": 0.15,
      "Growth Strategist": 0.30,
      "Skeptic": 0.15,
    },
    traction: {
      "Venture Capitalist": 0.30,
      "Operator": 0.30,
      "Growth Strategist": 0.25,
      "Skeptic": 0.15,
    },
    businessModel: {
      "Venture Capitalist": 0.25,
      "Operator": 0.40,
      "Growth Strategist": 0.15,
      "Skeptic": 0.20,
    },
    competition: {
      "Venture Capitalist": 0.20,
      "Operator": 0.20,
      "Growth Strategist": 0.25,
      "Skeptic": 0.35,
    },
    team: {
      "Venture Capitalist": 0.30,
      "Operator": 0.35,
      "Growth Strategist": 0.15,
      "Skeptic": 0.20,
    },
    ask: {
      "Venture Capitalist": 0.45,
      "Operator": 0.20,
      "Growth Strategist": 0.10,
      "Skeptic": 0.25,
    },
    moat: {
      "Venture Capitalist": 0.25,
      "Operator": 0.20,
      "Growth Strategist": 0.15,
      "Skeptic": 0.40,
    },
  },
  evidenceMultipliers: {
    extracted: 1.0,
    inferred: 0.85,
    missing: 0.70,
  },
};

let _config = null;

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function loadConfig() {
  if (_config) return _config;

  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, "utf-8");
      const saved = JSON.parse(raw);
      _config = { ...deepClone(DEFAULTS), ...saved };
      return _config;
    }
  } catch (err) {
    console.error("Failed to load scoring config, using defaults:", err.message);
  }

  _config = deepClone(DEFAULTS);
  return _config;
}

function saveConfig(config) {
  _config = config;
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to persist scoring config:", err.message);
  }
}

function updateConfig(partial) {
  const current = loadConfig();

  if (partial.thresholds) {
    current.thresholds = {
      ...current.thresholds,
      refine: clamp(partial.thresholds.refine ?? current.thresholds.refine, 1, 9),
      review: clamp(partial.thresholds.review ?? current.thresholds.review, 1, 9),
    };
    if (current.thresholds.refine >= current.thresholds.review) {
      current.thresholds.review = Math.min(current.thresholds.refine + 1, 9);
    }
  }

  if (partial.refinement) {
    current.refinement = {
      maxPasses: clamp(partial.refinement.maxPasses ?? current.refinement.maxPasses, 1, 10),
      minImprovementDelta: clamp(
        partial.refinement.minImprovementDelta ?? current.refinement.minImprovementDelta,
        0.1,
        3.0
      ),
    };
  }

  if (partial.dimensions) {
    for (const incoming of partial.dimensions) {
      const existing = current.dimensions.find((d) => d.id === incoming.id);
      if (existing && incoming.weight != null) {
        existing.weight = clamp(incoming.weight, 0.1, 5.0);
      }
    }
  }

  if (partial.roleWeights) {
    for (const [section, roles] of Object.entries(partial.roleWeights)) {
      if (!current.roleWeights[section]) continue;
      for (const [role, weight] of Object.entries(roles)) {
        if (current.roleWeights[section][role] != null) {
          current.roleWeights[section][role] = clamp(weight, 0, 1);
        }
      }
      normalizeWeights(current.roleWeights[section]);
    }
  }

  if (partial.evidenceMultipliers) {
    for (const [key, val] of Object.entries(partial.evidenceMultipliers)) {
      if (current.evidenceMultipliers[key] != null) {
        current.evidenceMultipliers[key] = clamp(val, 0.1, 1.5);
      }
    }
  }

  saveConfig(current);
  return current;
}

function resetConfig() {
  _config = deepClone(DEFAULTS);
  saveConfig(_config);
  return _config;
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, Number(val) || min));
}

function normalizeWeights(roleMap) {
  const sum = Object.values(roleMap).reduce((a, b) => a + b, 0);
  if (sum > 0 && Math.abs(sum - 1.0) > 0.01) {
    for (const key of Object.keys(roleMap)) {
      roleMap[key] = Math.round((roleMap[key] / sum) * 100) / 100;
    }
  }
}

// --- Accessor functions used by scoring.js and refinement.js ---

function getConfig() {
  return loadConfig();
}

function getDimensions() {
  return loadConfig().dimensions;
}

function getSections() {
  return loadConfig().sections;
}

function getSectionLabels() {
  return loadConfig().sectionLabels;
}

function getThresholds() {
  return loadConfig().thresholds;
}

function getRefinementConfig() {
  return loadConfig().refinement;
}

function getRoleWeight(section, role) {
  const config = loadConfig();
  return config.roleWeights[section]?.[role] ?? 0.25;
}

function getEvidenceMultiplier(source) {
  const config = loadConfig();
  return config.evidenceMultipliers[source] ?? 1.0;
}

function getDimensionWeight(dimensionId) {
  const config = loadConfig();
  const dim = config.dimensions.find((d) => d.id === dimensionId);
  return dim?.weight ?? 1.0;
}

function classifyScore(score) {
  const { refine, review } = getThresholds();
  if (score <= refine) return "refine";
  if (score <= review) return "review";
  return "accept";
}

module.exports = {
  getConfig,
  updateConfig,
  resetConfig,
  getDimensions,
  getSections,
  getSectionLabels,
  getThresholds,
  getRefinementConfig,
  getRoleWeight,
  getEvidenceMultiplier,
  getDimensionWeight,
  classifyScore,
  DEFAULTS,
};
