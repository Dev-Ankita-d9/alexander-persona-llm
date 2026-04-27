require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const advisorRoutes = require("./routes/advisors");
const feedbackRoutes = require("./routes/feedback");
const scoringConfigRoutes = require("./routes/scoring-config");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

app.use("/api/advisors", advisorRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/scoring-config", scoringConfigRoutes);

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

const frontendPath = path.join(__dirname, "../client/dist");

// Serve static files
app.use(express.static(frontendPath));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../client/dist/index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
