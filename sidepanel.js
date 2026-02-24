// sidepanel.js — controls the side panel UI and handles paper extraction
const SERVER_URL = 'http://127.0.0.1:5000';

// Get UI elements
const contentDiv = document.getElementById('sidebar-content');

// Add extract button
const extractButton = document.createElement('button');
extractButton.className = 'extract-btn';
extractButton.textContent = 'Summarize Paper';
extractButton.addEventListener('click', handleExtract);

// Add to sidebar
const header = document.querySelector('.sidebar-header');
header.appendChild(extractButton);

function setButtonState(text) {
  extractButton.disabled = true;
  extractButton.textContent = text;
}

function resetButton() {
  extractButton.disabled = false;
  extractButton.textContent = 'Summarize Paper';
}

async function handleExtract() {
  try {
    setButtonState('Extracting...');
    showLoading('Extracting paper content...');

    // Get the current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Check if we can access the tab (not chrome:// or extension pages)
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      showError('Cannot extract from Chrome internal pages. Please navigate to a website or arXiv page.');
      resetButton();
      return;
    }

    // Ensure content script is injected
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
    } catch (e) {
      // Content script might already be injected, continue
      console.log('Content script injection:', e.message);
    }

    // Wait a moment for content script to initialize
    await new Promise(resolve => setTimeout(resolve, 100));

    // Send message to content script to extract content
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'extract' });

    if (response.type === 'arxiv') {
      await handleArxivPaper(response.arxivId);
    } else if (response.type === 'pdf') {
      await handlePdfPaper(response.url);
    } else if (response.type === 'text') {
      await summarize({ paper_content: response.content });
    } else if (response.type === 'error') {
      showError(response.error);
      resetButton();
    }

  } catch (error) {
    console.error('Error extracting:', error);
    showError(`Failed to extract: ${error.message}\n\nMake sure you're on a regular webpage, not a Chrome internal page.`);
    resetButton();
  }
}

async function handleArxivPaper(arxivId) {
  try {
    showLoading(`Processing arXiv paper ${arxivId}...`);

    // Check if server is running
    const healthCheck = await fetch(`${SERVER_URL}/health`).catch(() => null);
    if (!healthCheck || !healthCheck.ok) {
      showError(
        'Python server not running. Please start it with:\n\n' +
        'cd /Users/chloeya/CodingProjects/paperagent\n' +
        'python server.py'
      );
      resetButton();
      return;
    }

    // Call Python backend to process arXiv paper
    const response = await fetch(`${SERVER_URL}/process-arxiv`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        arxiv_id: arxivId,
        keep_comments: false,
        remove_appendix: true,
        abstract_only: false,
      }),
    });

    const data = await response.json();

    if (data.success) {
      await summarize({ paper_content: data.content });
    } else {
      showError(`Failed to process paper: ${data.error}`);
      resetButton();
    }

  } catch (error) {
    console.error('Error processing arXiv paper:', error);
    showError(`Failed to process arXiv paper: ${error.message}`);
    resetButton();
  }
}

async function handlePdfPaper(url) {
  try {
    showLoading('Downloading PDF...');

    // Check if server is running
    const healthCheck = await fetch(`${SERVER_URL}/health`).catch(() => null);
    if (!healthCheck || !healthCheck.ok) {
      showError(
        'Python server not running. Please start it with:\n\n' +
        'cd /Users/chloeya/CodingProjects/paperagent\n' +
        'python server.py'
      );
      resetButton();
      return;
    }

    const response = await fetch(`${SERVER_URL}/process-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });

    const data = await response.json();

    if (data.success) {
      await summarize({ pdf_cache_key: data.pdf_id });
    } else {
      showError(`Failed to download PDF: ${data.error}`);
      resetButton();
    }

  } catch (error) {
    console.error('Error processing PDF:', error);
    showError(`Failed to process PDF: ${error.message}`);
    resetButton();
  }
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
