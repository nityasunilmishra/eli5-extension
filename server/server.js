
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { GoogleGenAI } = require("@google/genai");
const { saveExplanation, getHistory, getHistoryForUrl } = require("./db");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: "2mb" }));

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = "gemini-3.6-flash";

const MAX_INPUT_CHARS = 8000;

const READING_LEVELS = {
  five: "Explain this like I'm 5 years old. Use very short sentences, simple everyday words, and a fun concrete analogy. No jargon at all.",
  teen: "Explain this like I'm a smart 14-year-old. Plain language, short paragraphs, define any technical term the first time you use it.",
  adult: "Explain this clearly for a curious adult with no background in the topic. Plain English, no unnecessary jargon, but you don't need to oversimplify.",
};

function buildSystemPrompt(readingLevel) {
  const levelInstruction = READING_LEVELS[readingLevel] || READING_LEVELS.teen;
  return `You are a friendly explainer that summarizes web content clearly.
${levelInstruction}
Keep your explanation under 200 words. Use short paragraphs or a few bullet points if that helps. Do not add a preamble like "Sure, here's an explanation" — just explain.`;
}

async function callGemini({ text, readingLevel, isSelection }) {
  const systemPrompt = buildSystemPrompt(readingLevel);
  const userPrompt = isSelection
    ? `Explain the following highlighted passage from a web page:\n\n"""${text}"""`
    : `Explain what the following web page is about and its key points:\n\n"""${text}"""`;

  const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: fullPrompt,
  });

  return response.text || "";
}

app.post("/explain", async (req, res) => {
  try {
    const { pageUrl, pageTitle, pageText, readingLevel } = req.body;
    if (!pageText || !pageText.trim()) {
      return res.status(400).json({ error: "pageText is required" });
    }

    const trimmedText = pageText.slice(0, MAX_INPUT_CHARS);
    const explanation = await callGemini({
      text: trimmedText,
      readingLevel,
      isSelection: false,
    });

    saveExplanation({
      pageUrl: pageUrl || "unknown",
      pageTitle: pageTitle || "",
      readingLevel: readingLevel || "teen",
      sourceExcerpt: trimmedText.slice(0, 300),
      explanation,
    });

    res.json({ explanation });
  } catch (err) {
    console.error("Error in /explain:", err);
    res.status(500).json({ error: "Failed to generate explanation" });
  }
});

app.post("/explain-selection", async (req, res) => {
  try {
    const { pageUrl, pageTitle, selectionText, readingLevel } = req.body;
    if (!selectionText || !selectionText.trim()) {
      return res.status(400).json({ error: "selectionText is required" });
    }

    const trimmedText = selectionText.slice(0, MAX_INPUT_CHARS);
    const explanation = await callGemini({
      text: trimmedText,
      readingLevel,
      isSelection: true,
    });

    saveExplanation({
      pageUrl: pageUrl || "unknown",
      pageTitle: pageTitle || "",
      readingLevel: readingLevel || "teen",
      sourceExcerpt: trimmedText.slice(0, 300),
      explanation,
    });

    res.json({ explanation });
  } catch (err) {
    console.error("Error in /explain-selection:", err);
    res.status(500).json({ error: "Failed to generate explanation" });
  }
});

app.get("/history", (req, res) => {
  try {
    const { url, limit } = req.query;
    const rows = url
      ? getHistoryForUrl(url, Number(limit) || 10)
      : getHistory(Number(limit) || 20);
    res.json({ history: rows });
  } catch (err) {
    console.error("Error in /history:", err);
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

app.get("/", (_req, res) => {
  res.send("ELI5 extension backend is running.");
});

app.listen(PORT, () => {
  console.log(`ELI5 backend listening on https://eli5-extension.onrender.com`);
});