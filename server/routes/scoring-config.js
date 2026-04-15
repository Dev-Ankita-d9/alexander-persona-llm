const express = require("express");
const router = express.Router();
const { getConfig, updateConfig, resetConfig, DEFAULTS } = require("../scoring-config");

router.get("/", (_req, res) => {
  try {
    const config = getConfig();
    res.json({ config, defaults: DEFAULTS });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/", (req, res) => {
  try {
    const updated = updateConfig(req.body);
    res.json({ config: updated });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/reset", (_req, res) => {
  try {
    const config = resetConfig();
    res.json({ config, defaults: DEFAULTS });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
