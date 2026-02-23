// sidepanel.js — controls the side panel UI and handles paper extraction
const SERVER_URL = 'http://127.0.0.1:5000';

// Get UI elements
const contentDiv = document.getElementById('sidebar-content');

// Add extract button
const extractButton = document.createElement('button');
extractButton.className = 'extract-btn';
extractButton.textContent = 'Extract Paper';
extractButton.addEventListener('click', handleExtract);

// Add to sidebar
const header = document.querySelector('.sidebar-header');
header.appendChild(extractButton);

async function handleExtract() {
  try {
    showLoading('Extracting paper content...');

    // Get the current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Check if we can access the tab (not chrome:// or extension pages)
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
      showContent(response.content, 'Webpage Text');
    } else if (response.type === 'error') {
      showError(response.error);
    }

  } catch (error) {
    console.error('Error extracting:', error);
    showError(`Failed to extract: ${error.message}\n\nMake sure you're on a regular webpage, not a Chrome internal page.`);
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
      showContent(data.content, `arXiv:${arxivId}`);
    } else {
      showError(`Failed to process paper: ${data.error}`);
    }

  } catch (error) {
    console.error('Error processing arXiv paper:', error);
    showError(`Failed to process arXiv paper: ${error.message}`);
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
      return;
    }

    const response = await fetch(`${SERVER_URL}/process-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });

    const data = await response.json();

    if (data.success) {
      const sizeKB = Math.round(data.size_bytes / 1024);
      showPdfContent(data.pdf_id, data.filename, sizeKB);
    } else {
      showError(`Failed to download PDF: ${data.error}`);
    }

  } catch (error) {
    console.error('Error processing PDF:', error);
    showError(`Failed to process PDF: ${error.message}`);
  }
}

function showPdfContent(pdfId, filename, sizeKB) {
  contentDiv.innerHTML = `
    <div class="content">
      <h2>${escapeHtml(filename)}</h2>
      <p class="meta">PDF — ${sizeKB.toLocaleString()} KB</p>
      <p class="meta">PDF downloaded and ready for analysis.</p>
      <div class="actions">
        <button class="action-btn" id="summarize-btn">Summarize</button>
      </div>
    </div>
  `;

  document.getElementById('summarize-btn').addEventListener('click', async () => {
    const summarizeBtn = document.getElementById('summarize-btn');
    summarizeBtn.disabled = true;
    summarizeBtn.textContent = 'Summarizing...';

    let resultDiv = document.getElementById('llm-result');
    if (!resultDiv) {
      resultDiv = document.createElement('div');
      resultDiv.id = 'llm-result';
      resultDiv.className = 'llm-result';
      document.querySelector('.content').appendChild(resultDiv);
    }
    resultDiv.innerHTML = '<div class="loading"><div class="spinner"></div><p>Generating summary...</p></div>';

    try {
      const response = await fetch(`${SERVER_URL}/llm-skill-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skill: 'summarize',
          pdf_cache_key: pdfId,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Server error');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      resultDiv.innerHTML = '<pre class="llm-text"></pre>';
      const pre = resultDiv.querySelector('.llm-text');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const lines = decoder.decode(value, { stream: true }).split('\n');
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = JSON.parse(line.slice(6));

          if (payload.error) throw new Error(payload.error);
          if (payload.done) break;
          if (payload.chunk) {
            fullText += payload.chunk;
            pre.textContent = fullText;
            resultDiv.scrollTop = resultDiv.scrollHeight;
          }
        }
      }

      const copyResultBtn = document.createElement('button');
      copyResultBtn.className = 'action-btn';
      copyResultBtn.textContent = 'Copy Summary';
      copyResultBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(fullText);
        showNotification('Summary copied to clipboard!');
      });
      resultDiv.appendChild(copyResultBtn);

    } catch (error) {
      resultDiv.innerHTML = `<div class="error"><h3>Summarization failed</h3><pre>${escapeHtml(error.message)}</pre></div>`;
    } finally {
      summarizeBtn.disabled = false;
      summarizeBtn.textContent = 'Summarize';
    }
  });
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

function showContent(content, title) {
  const wordCount = content.split(/\s+/).length;
  contentDiv.innerHTML = `
    <div class="content">
      <h2>${escapeHtml(title)}</h2>
      <p class="meta">${wordCount.toLocaleString()} words</p>
      <div class="content-text">
        <pre>${escapeHtml(content)}</pre>
      </div>
      <div class="actions">
        <button class="action-btn" id="copy-btn">Copy to Clipboard</button>
        <button class="action-btn" id="summarize-btn">Summarize</button>
      </div>
    </div>
  `;

  // Add event listeners
  document.getElementById('copy-btn').addEventListener('click', () => {
    navigator.clipboard.writeText(content);
    showNotification('Copied to clipboard!');
  });

  document.getElementById('summarize-btn').addEventListener('click', async () => {
    const summarizeBtn = document.getElementById('summarize-btn');
    summarizeBtn.disabled = true;
    summarizeBtn.textContent = 'Summarizing...';

    // Create a result area below the paper content
    let resultDiv = document.getElementById('llm-result');
    if (!resultDiv) {
      resultDiv = document.createElement('div');
      resultDiv.id = 'llm-result';
      resultDiv.className = 'llm-result';
      document.querySelector('.content').appendChild(resultDiv);
    }
    resultDiv.innerHTML = '<div class="loading"><div class="spinner"></div><p>Generating summary...</p></div>';

    try {
      const response = await fetch(`${SERVER_URL}/llm-skill-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skill: 'summarize',
          paper_content: content,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Server error');
      }

      // Read the SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      resultDiv.innerHTML = '<pre class="llm-text"></pre>';
      const pre = resultDiv.querySelector('.llm-text');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const lines = decoder.decode(value, { stream: true }).split('\n');
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = JSON.parse(line.slice(6));

          if (payload.error) throw new Error(payload.error);
          if (payload.done) break;
          if (payload.chunk) {
            fullText += payload.chunk;
            pre.textContent = fullText;
            resultDiv.scrollTop = resultDiv.scrollHeight;
          }
        }
      }

      // Add a copy button for the summary
      const copyResultBtn = document.createElement('button');
      copyResultBtn.className = 'action-btn';
      copyResultBtn.textContent = 'Copy Summary';
      copyResultBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(fullText);
        showNotification('Summary copied to clipboard!');
      });
      resultDiv.appendChild(copyResultBtn);

    } catch (error) {
      resultDiv.innerHTML = `<div class="error"><h3>Summarization failed</h3><pre>${escapeHtml(error.message)}</pre></div>`;
    } finally {
      summarizeBtn.disabled = false;
      summarizeBtn.textContent = 'Summarize';
    }
  });
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

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
