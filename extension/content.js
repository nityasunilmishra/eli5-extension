
function extractPageText() {
  
  const clone = document.body.cloneNode(true);

  const noise = clone.querySelectorAll(
    "script, style, noscript, nav, footer, header, svg, iframe, [aria-hidden='true']"
  );
  noise.forEach((el) => el.remove());

  const text = clone.innerText || clone.textContent || "";
  
  return text.replace(/\n{2,}/g, "\n").replace(/[ \t]{2,}/g, " ").trim();
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

  
  return true;
});
