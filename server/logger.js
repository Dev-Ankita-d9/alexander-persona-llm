const fs = require("fs");
const path = require("path");

const LOG_DIR = path.join(__dirname, "logs");
const LOG_FILE = path.join(LOG_DIR, "deliberations.log");

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function timestamp() {
  return new Date().toISOString();
}

function formatValue(val) {
  if (val === null || val === undefined) return "null";
  if (typeof val === "string") return val.length > 500 ? val.slice(0, 500) + "...[truncated]" : val;
  try {
    const json = JSON.stringify(val, null, 2);
    return json.length > 2000 ? json.slice(0, 2000) + "\n...[truncated]" : json;
  } catch {
    return String(val);
  }
}

function writeLine(line) {
  try {
    fs.appendFileSync(LOG_FILE, line + "\n", "utf-8");
  } catch (err) {
    console.error("Logger write failed:", err.message);
  }
}

function createSession(query, advisorIds, fileName) {
  const sessionId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const separator = "=".repeat(80);

  writeLine("");
  writeLine(separator);
  writeLine(`SESSION: ${sessionId}`);
  writeLine(`TIME:    ${timestamp()}`);
  writeLine(`QUERY:   ${query}`);
  writeLine(`ADVISORS: ${advisorIds.join(", ")}`);
  if (fileName) writeLine(`FILE:    ${fileName}`);
  writeLine(separator);

  return {
    id: sessionId,

    phase(name, message) {
      writeLine(`\n[${timestamp()}] --- PHASE: ${name} ---`);
      if (message) writeLine(`  ${message}`);
    },

    info(message) {
      writeLine(`[${timestamp()}] INFO: ${message}`);
    },

    data(label, value) {
      writeLine(`[${timestamp()}] ${label}:`);
      const formatted = formatValue(value);
      formatted.split("\n").forEach((line) => writeLine(`  ${line}`));
    },

    error(phase, message) {
      writeLine(`[${timestamp()}] ERROR [${phase}]: ${message}`);
    },

    complete(durationMs) {
      writeLine(`\n[${timestamp()}] --- SESSION COMPLETE (${(durationMs / 1000).toFixed(1)}s) ---`);
      writeLine("=".repeat(80));
    },
  };
}

module.exports = { createSession };
