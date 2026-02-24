# Paper Agent

A Chrome extension that summarizes arXiv papers using LaTeX source extraction and Claude.

## Features

- Automatically detects arXiv papers (PDF or abstract pages)
- Extracts full LaTeX source using `arxiv-to-prompt`
- Summarizes papers with Claude (streaming)
- Caches papers and summaries locally
- Renders markdown with LaTeX math

## Quick Setup (~5 minutes)

**Prerequisites:** [conda](https://docs.conda.io/en/latest/miniconda.html) and an [Anthropic API key](https://console.anthropic.com/)

### 1. Clone and run setup

```bash
git clone <repo-url>
cd paperagent
./setup.sh
```

The script creates a conda environment and prompts you for your API key.

### 2. Start the server

```bash
./start.sh
```

Keep this terminal open while using the extension.

### 3. Load the Chrome extension (one-time)

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select the `paperagent` folder

### 4. Use it

1. Navigate to any arXiv paper (e.g., `https://arxiv.org/abs/2303.08774`)
2. Click the Paper Agent icon in the toolbar
3. Click **Summarize Paper**

## Architecture

```
Chrome Extension (sidepanel.js)
        │
        │  HTTP requests to localhost:5000
        ▼
Flask Backend (server.py)
        │
        ├── arxiv-to-prompt  →  Downloads & processes LaTeX source
        └── Anthropic API    →  Streams paper summaries
```

## Troubleshooting

### "Python server not running" error
- Make sure you ran `./start.sh` and the terminal is still open
- Check that it shows "Running on http://127.0.0.1:5000"

### Extension not detecting arXiv papers
- Make sure you're on `arxiv.org/pdf/{id}` or `arxiv.org/abs/{id}`
- Check the browser console for errors (F12 → Console)

### Test the backend directly
```bash
curl -X POST http://localhost:5000/process-arxiv \
  -H "Content-Type: application/json" \
  -d '{"arxiv_id": "2303.08774"}'
```
