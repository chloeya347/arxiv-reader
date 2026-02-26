// sidepanel.js — controls the side panel UI and handles paper extraction
const SERVER_URL = 'http://127.0.0.1:5000';

// Cached payload ready for summarization (set after auto-download completes)
let cachedPayload = null;

// Get UI elements
const contentDiv = document.getElementById('sidebar-content');

// Add language selector
const langContainer = document.createElement('div');
langContainer.className = 'lang-selector';

const langLabel = document.createElement('label');
langLabel.textContent = 'Language';
langLabel.htmlFor = 'lang-select';

const langSelect = document.createElement('select');
langSelect.id = 'lang-select';
const languages = [
  { value: 'English', label: 'English' },
  { value: 'Chinese', label: '中文' },
];
for (const lang of languages) {
  const opt = document.createElement('option');
  opt.value = lang.value;
  opt.textContent = lang.label;
  langSelect.appendChild(opt);
}

// Restore saved preferences, falling back to server-configured defaults
(async () => {
  const stored = await chrome.storage.local.get(['selectedLanguage', 'selectedProvider']);

  // Fetch server config for defaults and provider list
  let cfg = {};
  try {
    const resp = await fetch(`${SERVER_URL}/config`);
    if (resp.ok) cfg = await resp.json();
  } catch (_) { /* server not running yet */ }

  // Language
  if (stored.selectedLanguage) {
    langSelect.value = stored.selectedLanguage;
  } else if (cfg.default_language) {
    langSelect.value = cfg.default_language;
  }

  // Populate provider dropdown from server
  const providers = cfg.providers || [];
  for (const name of providers) {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    providerSelect.appendChild(opt);
  }

  // Restore saved provider or use server default
  if (stored.selectedProvider && providers.includes(stored.selectedProvider)) {
    providerSelect.value = stored.selectedProvider;
  } else if (cfg.default_provider) {
    providerSelect.value = cfg.default_provider;
  }

  applyLanguage();
})();
// Add provider selector (must be declared before the async IIFE and event listeners reference it)
const providerContainer = document.createElement('div');
providerContainer.className = 'lang-selector';

const providerLabel = document.createElement('label');
providerLabel.textContent = 'Provider';
providerLabel.htmlFor = 'provider-select';

const providerSelect = document.createElement('select');
providerSelect.id = 'provider-select';

providerContainer.appendChild(providerLabel);
providerContainer.appendChild(providerSelect);

langSelect.addEventListener('change', () => {
  chrome.storage.local.set({ selectedLanguage: langSelect.value });
  applyLanguage();
});
providerSelect.addEventListener('change', () => {
  chrome.storage.local.set({ selectedProvider: providerSelect.value });
});

langContainer.appendChild(langLabel);
langContainer.appendChild(langSelect);

// UI strings per language
const UI_STRINGS = {
  English: {
    title: 'Paper Agent',
    summarize: 'Summarize Paper',
    generating: 'Generating summary...',
    downloading: 'Downloading paper...',
    downloadingArxiv: (id) => `Downloading arXiv paper ${id}...`,
    downloadingPdf: 'Downloading PDF...',
    ready: 'Paper downloaded. Click "Summarize Paper" to generate a summary.',
    copySummary: 'Copy Summary',
    regenerate: 'Regenerate Summary',
    copied: 'Summary copied to clipboard!',
    language: 'Language',
    provider: 'Provider',
    retryDownload: 'Re-download Paper',
  },
  Chinese: {
    title: 'Paper Agent',
    summarize: '总结论文',
    generating: '正在生成摘要...',
    downloading: '正在下载论文...',
    downloadingArxiv: (id) => `正在下载 arXiv 论文 ${id}...`,
    downloadingPdf: '正在下载 PDF...',
    ready: '论文已下载。点击"总结论文"生成摘要。',
    copySummary: '复制摘要',
    regenerate: '重新生成摘要',
    copied: '摘要已复制到剪贴板！',
    language: '语言',
    provider: '模型',
    retryDownload: '重新下载论文',
  },
};

function t(key) {
  return UI_STRINGS[langSelect.value]?.[key] || UI_STRINGS.English[key];
}

function applyLanguage() {
  document.querySelector('.sidebar-header h1').textContent = t('title');
  langLabel.textContent = t('language');
  providerLabel.textContent = t('provider');
  if (!extractButton.disabled || extractButton.textContent === t('summarize') ||
      Object.values(UI_STRINGS).some(s => s.summarize === extractButton.textContent)) {
    extractButton.textContent = t('summarize');
  }
}

// Add summarize button (disabled until download finishes)
const extractButton = document.createElement('button');
extractButton.className = 'extract-btn';
extractButton.textContent = 'Summarize Paper';
extractButton.disabled = true;
extractButton.addEventListener('click', handleSummarize);

// Add to sidebar
const header = document.querySelector('.sidebar-header');
header.appendChild(langContainer);
header.appendChild(providerContainer);
header.appendChild(extractButton);

// Auto-download paper on startup; if a cached summary exists, show that instead
initPanel();

function setButtonState(text) {
  extractButton.disabled = true;
  extractButton.textContent = text;
}

function resetButton() {
  extractButton.disabled = !cachedPayload;
  extractButton.textContent = t('summarize');
}

async function handleSummarize(regenerate = false) {
  if (!cachedPayload) return;
  await summarize(cachedPayload, regenerate);
}

async function initPanel() {
  // If we already have a cached summary for this URL, show it immediately
  const cached = await loadCachedSummary();

  // Always download the paper content so cachedPayload is available for regeneration
  await autoDownload(cached);
}

async function autoDownload(silent = false) {
  try {
    if (!silent) showLoading(t('downloading'));

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
      await downloadArxivPaper(response.arxivId, silent);
    } else if (response.type === 'pdf') {
      await downloadPdfPaper(response.url, silent);
    } else if (response.type === 'text') {
      cachedPayload = { paper_content: response.content };
      if (!silent) showReady();
    } else if (response.type === 'error') {
      if (!silent) showError(response.error);
    }

  } catch (error) {
    console.error('Error extracting:', error);
    if (!silent) showError(`Failed to extract: ${error.message}\n\nMake sure you're on a regular webpage, not a Chrome internal page.`, () => autoDownload());
  }
}

async function checkServer() {
  const healthCheck = await fetch(`${SERVER_URL}/health`).catch(() => null);
  if (!healthCheck || !healthCheck.ok) {
    showError(
      'Python server not running. Please start it with:\n\n' +
      'cd <your-paperagent-folder>\n' +
      './start.sh'
    );
    return false;
  }
  return true;
}

async function downloadArxivPaper(arxivId, silent = false) {
  try {
    if (!silent) showLoading(UI_STRINGS[langSelect.value]?.downloadingArxiv(arxivId) || UI_STRINGS.English.downloadingArxiv(arxivId));

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
      if (!silent) showReady();
    } else {
      if (!silent) showError(`Failed to process paper: ${data.error}`, () => downloadArxivPaper(arxivId));
    }

  } catch (error) {
    console.error('Error processing arXiv paper:', error);
    if (!silent) showError(`Failed to process arXiv paper: ${error.message}`, () => downloadArxivPaper(arxivId));
  }
}

async function downloadPdfPaper(url, silent = false) {
  try {
    if (!silent) showLoading(t('downloadingPdf'));

    if (!await checkServer()) return;

    const response = await fetch(`${SERVER_URL}/process-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });

    const data = await response.json();

    if (data.success) {
      cachedPayload = { pdf_cache_key: data.pdf_id };
      if (!silent) showReady();
    } else {
      if (!silent) showError(`Failed to download PDF: ${data.error}`, () => downloadPdfPaper(url));
    }

  } catch (error) {
    console.error('Error processing PDF:', error);
    if (!silent) showError(`Failed to process PDF: ${error.message}`, () => downloadPdfPaper(url));
  }
}

function showReady() {
  extractButton.disabled = false;
  contentDiv.innerHTML = `<p class="empty-state">${escapeHtml(t('ready'))}</p>`;
}

async function summarize(payload, regenerate = false) {
  setButtonState(t('generating'));
  showLoading(t('generating'));

  const resultDiv = document.createElement('div');
  resultDiv.id = 'llm-result';
  resultDiv.className = 'llm-result';

  try {
    const body = { skill: 'summarize', language: langSelect.value, provider: providerSelect.value, ...payload };
    if (regenerate) body.regenerate = true;

    const response = await fetch(`${SERVER_URL}/llm-skill-stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
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
        const key = getCacheKey(tab.url, langSelect.value);
        await cacheSummary(key, fullText);
      }
    } catch (e) {
      console.log('Failed to cache summary:', e.message);
    }

    const btnRow = document.createElement('div');
    btnRow.className = 'action-btn-row';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'action-btn';
    copyBtn.textContent = t('copySummary');
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(fullText);
      showNotification(t('copied'));
    });
    btnRow.appendChild(copyBtn);

    const regenBtn = document.createElement('button');
    regenBtn.className = 'action-btn action-btn-secondary';
    regenBtn.textContent = t('regenerate');
    regenBtn.addEventListener('click', () => handleSummarize(true));
    btnRow.appendChild(regenBtn);

    resultDiv.appendChild(btnRow);

  } catch (error) {
    showError(`Summarization failed: ${error.message}`);
  } finally {
    resetButton();
  }
}

function getCacheKey(url, language) {
  const lang = (language || 'English').trim().toLowerCase();
  // Normalize arxiv URLs so /abs/ and /pdf/ share the same key
  const arxivMatch = url.match(/arxiv\.org\/(?:abs|pdf)\/(\d+\.\d+)/);
  if (arxivMatch) return `summary:arxiv:${arxivMatch[1]}:${lang}`;
  return `summary:${url}:${lang}`;
}

const CACHE_MAX = 10;
const CACHE_INDEX_KEY = '_summary_cache_index';

async function cacheSummary(key, text) {
  // Load the index of cached keys with timestamps
  const result = await chrome.storage.local.get(CACHE_INDEX_KEY);
  const index = result[CACHE_INDEX_KEY] || [];

  // Remove existing entry for this key (so we can re-add it as most recent)
  const filtered = index.filter(entry => entry.key !== key);

  // If at the limit, remove the oldest entry
  while (filtered.length >= CACHE_MAX) {
    const oldest = filtered.shift();
    await chrome.storage.local.remove(oldest.key);
  }

  filtered.push({ key, ts: Date.now() });

  await chrome.storage.local.set({
    [key]: text,
    [CACHE_INDEX_KEY]: filtered,
  });
}

async function loadCachedSummary() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) return false;
    const key = getCacheKey(tab.url, langSelect.value);
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

  const btnRow = document.createElement('div');
  btnRow.className = 'action-btn-row';

  const copyBtn = document.createElement('button');
  copyBtn.className = 'action-btn';
  copyBtn.textContent = t('copySummary');
  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(text);
    showNotification(t('copied'));
  });
  btnRow.appendChild(copyBtn);

  const regenBtn = document.createElement('button');
  regenBtn.className = 'action-btn action-btn-secondary';
  regenBtn.textContent = t('regenerate');
  regenBtn.addEventListener('click', () => handleSummarize(true));
  btnRow.appendChild(regenBtn);

  resultDiv.appendChild(btnRow);
}

function showLoading(message) {
  contentDiv.innerHTML = `
    <div class="loading">
      <div class="spinner"></div>
      <p>${message}</p>
    </div>
  `;
}

function showError(message, retryFn) {
  contentDiv.innerHTML = `
    <div class="error">
      <h3>⚠️ Error</h3>
      <pre>${escapeHtml(message)}</pre>
    </div>
  `;
  if (retryFn) {
    const retryBtn = document.createElement('button');
    retryBtn.className = 'action-btn retry-btn';
    retryBtn.textContent = t('retryDownload');
    retryBtn.addEventListener('click', retryFn);
    contentDiv.querySelector('.error').appendChild(retryBtn);
  }
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
