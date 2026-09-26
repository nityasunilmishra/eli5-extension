
const NOISE_TAGS = new Set([
  "SCRIPT", "STYLE", "NOSCRIPT", "NAV", "FOOTER", "HEADER", "SVG", "IFRAME",
]);

function isInsideNoise(textNode) {
  let el = textNode.parentElement;
  while (el) {
    if (NOISE_TAGS.has(el.tagName)) return true;
    if (el.getAttribute && el.getAttribute("aria-hidden") === "true") return true;
    el = el.parentElement;
  }
  return false;
}

function extractPageText() {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      return isInsideNoise(node) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
    },
  });

  const chunks = [];
  let node;
  while ((node = walker.nextNode())) {
    chunks.push(node.nodeValue.trim());
  }

  return chunks.join(" ").replace(/\s{2,}/g, " ").trim();
}


chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "GET_PAGE_TEXT") {
    sendResponse({
      pageText: extractPageText(),
      pageTitle: document.title,
      pageUrl: window.location.href,
    });
  }

  if (message.type === "GET_SELECTION") {
    const selectionText = window.getSelection().toString();
    sendResponse({
      selectionText,
      pageTitle: document.title,
      pageUrl: window.location.href,
    });
  }
});