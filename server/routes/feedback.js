const express = require("express");
const fs = require("fs");
const path = require("path");
const router = express.Router();

const FEEDBACK_FILE = path.join(__dirname, "..", "feedback.json");

function loadFeedback() {
  try {
    if (fs.existsSync(FEEDBACK_FILE)) {
      return JSON.parse(fs.readFileSync(FEEDBACK_FILE, "utf-8"));
    }
  } catch {
    /* ignore parse errors */
  }
  return [];
}

function saveFeedback(entries) {
  fs.writeFileSync(FEEDBACK_FILE, JSON.stringify(entries, null, 2));
}

router.post("/", (req, res) => {
  const { id, query, synthesis, rating, advisorsUsed } = req.body;

  if (!query || !synthesis || !rating) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const entry = {
    id: id || crypto.randomUUID(),
    timestamp: Date.now(),
    query,
    synthesis,
    rating,
    advisorsUsed: advisorsUsed || [],
    refined: false,
  };

  const entries = loadFeedback();
  entries.unshift(entry);
  saveFeedback(entries);

  res.json(entry);
});

router.get("/", (_req, res) => {
  const entries = loadFeedback();
  res.json(entries.slice(0, 50));
});

router.patch("/:id", (req, res) => {
  const entries = loadFeedback();
  const idx = entries.findIndex((e) => e.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Not found" });

  entries[idx] = { ...entries[idx], ...req.body };
  saveFeedback(entries);
  res.json(entries[idx]);
});

module.exports = router;
