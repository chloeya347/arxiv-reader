// sidepanel.js — controls the side panel UI and handles paper extraction
const SERVER_URL = 'http://127.0.0.1:5000';

// Cached payload ready for summarization (set after auto-download completes)
let cachedPayload = null;

// Get UI elements
const contentDiv = document.getElementById('sidebar-content');

// Add summarize button (disabled until download finishes)
const extractButton = document.createElement('button');
extractButton.className = 'extract-btn';
extractButton.textContent = 'Summarize Paper';
extractButton.disabled = true;
extractButton.addEventListener('click', handleSummarize);

// Add to sidebar
const header = document.querySelector('.sidebar-header');
header.appendChild(extractButton);

// Auto-download paper on startup; if a cached summary exists, show that instead
initPanel();

function setButtonState(text) {
  extractButton.disabled = true;
  extractButton.textContent = text;
}

function resetButton() {
  extractButton.disabled = !cachedPayload;
  extractButton.textContent = 'Summarize Paper';
}

async function handleSummarize() {
  if (!cachedPayload) return;
  await summarize(cachedPayload);
}

async function initPanel() {
  // If we already have a cached summary for this URL, show it immediately
  const cached = await loadCachedSummary();
  if (cached) return;

  // Otherwise, start downloading the paper content
  await autoDownload();
}

async function autoDownload() {
  try {
    showLoading('Downloading paper...');

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      showError('Cannot extract from Chrome internal pages. Please navigate to a website or arXiv page.');
      return;
    }

    // Ensure content script is injected
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
    } catch (e) {
      console.log('Content script injection:', e.message);
    }

    await new Promise(resolve => setTimeout(resolve, 100));

    const response = await chrome.tabs.sendMessage(tab.id, { action: 'extract' });

    if (response.type === 'arxiv') {
      await downloadArxivPaper(response.arxivId);
    } else if (response.type === 'pdf') {
      await downloadPdfPaper(response.url);
    } else if (response.type === 'text') {
      cachedPayload = { paper_content: response.content };
      showReady();
    } else if (response.type === 'error') {
      showError(response.error);
    }

  } catch (error) {
    console.error('Error extracting:', error);
    showError(`Failed to extract: ${error.message}\n\nMake sure you're on a regular webpage, not a Chrome internal page.`);
  }
}

async function checkServer() {
  const healthCheck = await fetch(`${SERVER_URL}/health`).catch(() => null);
  if (!healthCheck || !healthCheck.ok) {
    showError(
      'Python server not running. Please start it with:\n\n' +
      'cd /Users/chloeya/CodingProjects/paperagent\n' +
      'python server.py'
    );
    return false;
  }
  return true;
}

async function downloadArxivPaper(arxivId) {
  try {
    showLoading(`Downloading arXiv paper ${arxivId}...`);

    if (!await checkServer()) return;

    const response = await fetch(`${SERVER_URL}/process-arxiv`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        arxiv_id: arxivId,
        keep_comments: false,
        remove_appendix: true,
        abstract_only: false,
      }),
    });

    const data = await response.json();

    if (data.success) {
      cachedPayload = { paper_content: data.content };
      showReady();
    } else {
      showError(`Failed to process paper: ${data.error}`);
    }

  } catch (error) {
    console.error('Error processing arXiv paper:', error);
    showError(`Failed to process arXiv paper: ${error.message}`);
  }
}

async function downloadPdfPaper(url) {
  try {
    showLoading('Downloading PDF...');

    if (!await checkServer()) return;

    const response = await fetch(`${SERVER_URL}/process-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });

    const data = await response.json();

    if (data.success) {
      cachedPayload = { pdf_cache_key: data.pdf_id };
      showReady();
    } else {
      showError(`Failed to download PDF: ${data.error}`);
    }

  } catch (error) {
    console.error('Error processing PDF:', error);
    showError(`Failed to process PDF: ${error.message}`);
  }
}

function showReady() {
  extractButton.disabled = false;
  contentDiv.innerHTML = '<p class="empty-state">Paper downloaded. Click "Summarize Paper" to generate a summary.</p>';
}

async function summarize(payload) {
  setButtonState('Generating summary...');
  showLoading('Generating summary...');

  const resultDiv = document.createElement('div');
  resultDiv.id = 'llm-result';
  resultDiv.className = 'llm-result';

  try {
    const response = await fetch(`${SERVER_URL}/llm-skill-stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skill: 'summarize', ...payload }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Server error');
    }

    contentDiv.innerHTML = '';
    contentDiv.appendChild(resultDiv);
    resultDiv.innerHTML = '<div class="llm-text"></div>';
    const mdDiv = resultDiv.querySelector('.llm-text');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const lines = decoder.decode(value, { stream: true }).split('\n');
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const chunk = JSON.parse(line.slice(6));
        if (chunk.error) throw new Error(chunk.error);
        if (chunk.done) break;
        if (chunk.chunk) {
          fullText += chunk.chunk;
          renderMd(mdDiv, fullText);
        }
      }
    }

    // Cache the summary for this tab
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.url) {
        const key = getCacheKey(tab.url);
        await chrome.storage.local.set({ [key]: fullText });
      }
    } catch (e) {
      console.log('Failed to cache summary:', e.message);
    }

    const copyBtn = document.createElement('button');
    copyBtn.className = 'action-btn';
    copyBtn.textContent = 'Copy Summary';
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(fullText);
      showNotification('Summary copied to clipboard!');
    });
    resultDiv.appendChild(copyBtn);

  } catch (error) {
    showError(`Summarization failed: ${error.message}`);
  } finally {
    resetButton();
  }
}

function getCacheKey(url) {
  // Normalize arxiv URLs so /abs/ and /pdf/ share the same key
  const arxivMatch = url.match(/arxiv\.org\/(?:abs|pdf)\/(\d+\.\d+)/);
  if (arxivMatch) return `summary:arxiv:${arxivMatch[1]}`;
  return `summary:${url}`;
}

async function loadCachedSummary() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) return false;
    const key = getCacheKey(tab.url);
    const result = await chrome.storage.local.get(key);
    if (result[key]) {
      displaySummary(result[key]);
      return true;
    }
  } catch (e) {
    console.log('Cache check failed:', e.message);
  }
  return false;
}

function displaySummary(text) {
  const resultDiv = document.createElement('div');
  resultDiv.id = 'llm-result';
  resultDiv.className = 'llm-result';
  resultDiv.innerHTML = '<div class="llm-text"></div>';
  contentDiv.innerHTML = '';
  contentDiv.appendChild(resultDiv);

  const mdDiv = resultDiv.querySelector('.llm-text');
  renderMd(mdDiv, text);

  const copyBtn = document.createElement('button');
  copyBtn.className = 'action-btn';
  copyBtn.textContent = 'Copy Summary';
  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(text);
    showNotification('Summary copied to clipboard!');
  });
  resultDiv.appendChild(copyBtn);
}

function showLoading(message) {
  contentDiv.innerHTML = `
    <div class="loading">
      <div class="spinner"></div>
      <p>${message}</p>
    </div>
  `;
}

function showError(message) {
  contentDiv.innerHTML = `
    <div class="error">
      <h3>⚠️ Error</h3>
      <pre>${escapeHtml(message)}</pre>
    </div>
  `;
}

function showNotification(message) {
  const notification = document.createElement('div');
  notification.className = 'notification';
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.classList.add('show');
  }, 10);

  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, 2000);
}

function renderMd(element, text) {
  // Protect math from markdown processing before marked sees it.
  // Placeholders use only alphanumeric chars so marked won't mangle them.
  const mathBlocks = [];
  function saveMath(match) {
    const idx = mathBlocks.length;
    mathBlocks.push(match);
    return `KATEX${idx}PLACEHOLDER`;
  }

  const protectedText = text
    .replace(/\$\$([\s\S]*?)\$\$/g, saveMath)       // display $$...$$
    .replace(/\\\[([\s\S]*?)\\\]/g, saveMath)        // display \[...\]
    .replace(/\\\(([\s\S]*?)\\\)/g, saveMath)        // inline \(...\)
    .replace(/\$([^\$\n]+?)\$/g, saveMath);          // inline $...$

  let html = marked.parse(protectedText);

  // Restore math blocks so KaTeX can process them
  html = html.replace(/KATEX(\d+)PLACEHOLDER/g, (_, i) => mathBlocks[+i]);

  element.innerHTML = html;

  renderMathInElement(element, {
    throwOnError: false,
    delimiters: [
      { left: '$$', right: '$$', display: true },
      { left: '\\[', right: '\\]', display: true },
      { left: '\\(', right: '\\)', display: false },
      { left: '$', right: '$', display: false },
    ],
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
