// content.js — injected into every page at document_idle
// Responds to extract requests from the side panel via background.js

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action !== "extract") return;

  // Check if this is an arXiv page
  const arxivId = extractArxivId(window.location.href);
  if (arxivId) {
    sendResponse({ type: "arxiv", arxivId: arxivId, url: window.location.href });
    return true;
  }

  if (isPDF()) {
    sendResponse({ type: "pdf", url: window.location.href });
  } else {
    const text = extractWebpageText();
    if (text.length < 100) {
      sendResponse({ type: "error", error: "Not enough readable text found on this page." });
    } else {
      sendResponse({ type: "text", content: text });
    }
  }

  // Return true to keep the message channel open for async sendResponse if needed later
  return true;
});

function extractArxivId(url) {
  // Match arXiv URLs like:
  // - arxiv.org/pdf/2303.08774.pdf
  // - arxiv.org/pdf/2303.08774
  // - arxiv.org/abs/2303.08774
  const patterns = [
    /arxiv\.org\/pdf\/(\d+\.\d+)/,
    /arxiv\.org\/abs\/(\d+\.\d+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

function isPDF() {
  return (
    document.contentType === "application/pdf" ||
    window.location.href.toLowerCase().endsWith(".pdf")
  );
}

function extractWebpageText() {
  // Try increasingly broad selectors to find the main content
  const candidates = [
    document.querySelector("article"),
    document.querySelector("main"),
    document.querySelector('[role="main"]'),
    document.querySelector(".paper-content"),
    document.querySelector("#content"),
    document.body,
  ];

  const container = candidates.find((el) => el !== null);
  if (!container) return "";

  // Clone so we can remove noise without affecting the page
  const clone = container.cloneNode(true);

  // Remove elements that are unlikely to be paper content
  const noiseSelectors = [
    "nav", "header", "footer", "aside",
    "script", "style", "noscript",
    ".nav", ".navbar", ".menu", ".sidebar",
    ".cookie", ".banner", ".ad", ".advertisement",
    ".references", ".bibliography",  // optionally keep — remove if you want refs included
  ];
  noiseSelectors.forEach((sel) => {
    clone.querySelectorAll(sel).forEach((el) => el.remove());
  });

  // Collect text from meaningful tags, preserving rough structure
  const blocks = [];
  clone.querySelectorAll("h1, h2, h3, h4, p, li, td, th").forEach((el) => {
    const text = el.innerText?.trim() || el.textContent?.trim();
    if (text) blocks.push(text);
  });

  // Fall back to full innerText if no blocks found
  const result = blocks.length > 0
    ? blocks.join("\n")
    : (clone.innerText || clone.textContent || "").trim();

  return collapseWhitespace(result);
}

function collapseWhitespace(text) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")       // collapse horizontal whitespace
    .replace(/\n{3,}/g, "\n\n")    // max two consecutive newlines
    .trim();
}
