
const API_BASE = "https://eli5-extension.onrender.com";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "eli5-explain-selection",
    title: "Explain this with AI",
    contexts: ["selection"],
  });
});

async function getReadingLevel() {
  const { readingLevel } = await chrome.storage.sync.get("readingLevel");
  return readingLevel || "teen";
}


function renderResultCard({ state, text }) {
  const existing = document.getElementById("__eli5_card__");
  if (existing) existing.remove();

  const card = document.createElement("div");
  card.id = "__eli5_card__";
  Object.assign(card.style, {
    position: "fixed",
    bottom: "24px",
    right: "24px",
    maxWidth: "340px",
    background: "#2B3A32",
    color: "#F5F1E8",
    padding: "16px 18px",
    borderRadius: "10px",
    boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
    fontFamily: "system-ui, sans-serif",
    fontSize: "14px",
    lineHeight: "1.5",
    zIndex: 2147483647,
  });

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "\u00D7";
  Object.assign(closeBtn.style, {
    position: "absolute",
    top: "6px",
    right: "10px",
    background: "transparent",
    border: "none",
    color: "#F2C94C",
    fontSize: "18px",
    cursor: "pointer",
  });
  closeBtn.onclick = () => card.remove();

  const body = document.createElement("div");
  body.style.marginTop = "4px";
  body.textContent = state === "loading" ? "Thinking\u2026" : text;

  card.style.position = "fixed";
  card.appendChild(closeBtn);
  card.appendChild(body);
  document.body.appendChild(card);
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "eli5-explain-selection" || !tab?.id) return;


  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: renderResultCard,
    args: [{ state: "loading", text: "" }],
  });

  try {
    const readingLevel = await getReadingLevel();
    const response = await fetch(`${API_BASE}/explain-selection`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        selectionText: info.selectionText,
        pageUrl: tab.url,
        pageTitle: tab.title,
        readingLevel,
      }),
    });

    if (!response.ok) throw new Error(`Backend returned ${response.status}`);
    const data = await response.json();

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: renderResultCard,
      args: [{ state: "done", text: data.explanation }],
    });
  } catch (err) {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: renderResultCard,
      args: [{
        state: "done",
        text: "Couldn't reach the ELI5 backend. Is it running on localhost:3001?",
      }],
    });
  }
});
