

const API_BASE = "https://eli5-extension.onrender.com";

const CACHE_TTL_MS = 60 * 60 * 1000; 
const HISTORY_FETCH_TIMEOUT_MS = 3000;

const levelPills = document.querySelectorAll(".level-pill");
const explainBtn = document.getElementById("explainBtn");
const resultCard = document.getElementById("resultCard");
const resultText = document.getElementById("resultText");
const historySection = document.getElementById("historySection");
const historyList = document.getElementById("historyList");
const statusText = document.getElementById("statusText");

let currentLevel = "teen";

function hashString(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

function cacheKey(pageUrl, readingLevel) {
  return `explainCache:${hashString(pageUrl + "|" + readingLevel)}`;
}

async function getCachedExplanation(pageUrl, readingLevel) {
  const key = cacheKey(pageUrl, readingLevel);
  const result = await chrome.storage.local.get(key);
  const entry = result[key];
  if (!entry) return null;
  if (Date.now() - entry.savedAt > CACHE_TTL_MS) return null; 
  return entry.explanation;
}

async function setCachedExplanation(pageUrl, readingLevel, explanation) {
  const key = cacheKey(pageUrl, readingLevel);
  await chrome.storage.local.set({
    [key]: { explanation, savedAt: Date.now() },
  });
}

function setActivePill(level) {
  levelPills.forEach((pill) => {
    pill.classList.toggle("active", pill.dataset.level === level);
  });
}

async function init() {
  const { readingLevel } = await chrome.storage.sync.get("readingLevel");
  currentLevel = readingLevel || "teen";
  setActivePill(currentLevel);
  loadHistoryForCurrentTab();
}

levelPills.forEach((pill) => {
  pill.addEventListener("click", async () => {
    currentLevel = pill.dataset.level;
    setActivePill(currentLevel);
    await chrome.storage.sync.set({ readingLevel: currentLevel });
  });
});

function getActiveTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      resolve(tabs[0]);
    });
  });
}

function sendMessageToTab(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

async function loadHistoryForCurrentTab() {
  const tab = await getActiveTab();
  if (!tab?.url) return;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), HISTORY_FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(
      `${API_BASE}/history?url=${encodeURIComponent(tab.url)}&limit=3`,
      { signal: controller.signal }
    );
    if (!res.ok) return;
    const { history } = await res.json();
    if (!history?.length) return;
    const fragment = document.createDocumentFragment();
    history.forEach((row) => {
      const li = document.createElement("li");
      li.className = "history-item";
      li.textContent = row.explanation.slice(0, 100) + (row.explanation.length > 100 ? "\u2026" : "");
      fragment.appendChild(li);
    });
    historyList.innerHTML = "";
    historyList.appendChild(fragment);
    historySection.classList.remove("hidden");
  } catch (err) {
    console.error("Failed to load history:", err);
  } finally {
    clearTimeout(timeoutId);
  }
}

explainBtn.addEventListener("click", async () => {
  explainBtn.disabled = true;
  explainBtn.textContent = "Thinking\u2026";
  statusText.textContent = "";

  try {
    const tab = await getActiveTab();
    if (!tab?.id) throw new Error("No active tab found.");

    const { pageText, pageTitle, pageUrl } = await sendMessageToTab(tab.id, {
      type: "GET_PAGE_TEXT",
    });

    if (!pageText || pageText.length < 20) {
      throw new Error("Couldn't find readable text on this page.");
    }

    const cached = await getCachedExplanation(pageUrl, currentLevel);
    let explanation;

    if (cached) {
      explanation = cached;
    } else {
      const res = await fetch(`${API_BASE}/explain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageText,
          pageTitle,
          pageUrl,
          readingLevel: currentLevel,
        }),
      });

      if (!res.ok) throw new Error(`Backend returned ${res.status}`);
      const data = await res.json();
      explanation = data.explanation;
      await setCachedExplanation(pageUrl, currentLevel, explanation);
    }

    resultText.textContent = explanation;
    resultCard.classList.remove("hidden");
    loadHistoryForCurrentTab();
  } catch (err) {
    resultText.textContent =
      err.message.includes("Receiving end")
        ? "Reload this tab, then try again (the extension just installed/updated)."
        : `Something went wrong: ${err.message}`;
    resultCard.classList.remove("hidden");
  } finally {
    explainBtn.disabled = false;
    explainBtn.textContent = "Explain this page";
  }
});

init().catch((err) => {
  console.error("Failed to initialize popup:", err);
});