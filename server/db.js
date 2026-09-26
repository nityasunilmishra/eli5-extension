
const fs = require("fs/promises");
const path = require("path");

const DB_FILE = path.join(__dirname, "eli5-history.json");

async function readAll() {
  try {
    const raw = await fs.readFile(DB_FILE, "utf-8");
    return raw.trim() ? JSON.parse(raw) : [];
  } catch (err) {
    if (err.code === "ENOENT") return []; 
    console.error("Failed to read history file, starting fresh:", err.message);
    return [];
  }
}

async function writeAll(rows) {
  await fs.writeFile(DB_FILE, JSON.stringify(rows, null, 2), "utf-8");
}


let writeQueue = Promise.resolve();

function enqueueWrite(task) {
  const next = writeQueue.then(task, task); 
  writeQueue = next.catch(() => {}); 
  return next;
}

async function saveExplanation({ pageUrl, pageTitle, readingLevel, sourceExcerpt, explanation }) {
  return enqueueWrite(async () => {
    const rows = await readAll();
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
    await writeAll(rows);
    return newRow.id;
  });
}

async function getHistory(limit = 20) {
  const rows = await readAll();
  return rows
    .slice()
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, limit);
}

async function getHistoryForUrl(pageUrl, limit = 10) {
  const rows = (await readAll()).filter((row) => row.page_url === pageUrl);
  return rows
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, limit);
}

module.exports = { saveExplanation, getHistory, getHistoryForUrl };