

const fs = require("fs");
const path = require("path");

const DB_FILE = path.join(__dirname, "eli5-history.json");

function readAll() {
  if (!fs.existsSync(DB_FILE)) return [];
  try {
    const raw = fs.readFileSync(DB_FILE, "utf-8");
    return raw.trim() ? JSON.parse(raw) : [];
  } catch (err) {
    console.error("Failed to read history file, starting fresh:", err.message);
    return [];
  }
}

function writeAll(rows) {
  fs.writeFileSync(DB_FILE, JSON.stringify(rows, null, 2), "utf-8");
}

function saveExplanation({ pageUrl, pageTitle, readingLevel, sourceExcerpt, explanation }) {
  const rows = readAll();
  const newRow = {
    id: rows.length ? rows[rows.length - 1].id + 1 : 1,
    page_url: pageUrl,
    page_title: pageTitle,
    reading_level: readingLevel,
    source_excerpt: sourceExcerpt,
    explanation,
    created_at: new Date().toISOString(),
  };
  rows.push(newRow);
  writeAll(rows);
  return newRow.id;
}

function getHistory(limit = 20) {
  const rows = readAll();
  return rows
    .slice()
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, limit);
}

function getHistoryForUrl(pageUrl, limit = 10) {
  const rows = readAll().filter((row) => row.page_url === pageUrl);
  return rows
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, limit);
}

module.exports = { saveExplanation, getHistory, getHistoryForUrl };