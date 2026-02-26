# Paper Agent

[中文版](README.zh.md)

A Chrome extension that summarizes arXiv papers using LaTeX source extraction and your choice of LLM.

## Features

- Automatically detects arXiv papers (PDF or abstract pages)
- Extracts full LaTeX source using `arxiv-to-prompt`
- Summarizes papers with streaming LLM output
- Supports multiple providers: Anthropic, OpenAI, Qwen, Kimi, DeepSeek
- Caches papers and summaries locally
- Renders markdown with LaTeX math

---

## Onboarding (~5 minutes)

### Prerequisites

- **[conda](https://docs.conda.io/en/latest/miniconda.html)** — for the Python environment
- **Chrome** (or any Chromium-based browser — Arc, Brave, Edge, etc.)
- **An API key** for at least one supported LLM provider:
  - [Anthropic](https://console.anthropic.com/) (Claude)
  - [OpenAI](https://platform.openai.com/api-keys) (GPT-4o)
  - [DashScope](https://dashscope.aliyun.com/) (Qwen)
  - [Moonshot AI](https://platform.moonshot.cn/) (Kimi)
  - [DeepSeek](https://platform.deepseek.com/) (DeepSeek)

---

### Step 1 — Clone the repo

```bash
git clone <repo-url>
cd paperagent
```

---

### Step 2 — Run setup

```bash
./setup.sh
```

The interactive script will:

1. Create a `paperagent` conda environment from `environment.yml`
2. Ask which LLM provider(s) you want to use and prompt for your API key(s)
3. Set your preferred output language for summaries (default: English)
4. Write everything to a `.env` file

You can configure multiple providers — the first one you enter becomes the default. To switch providers later, edit `.env` and change `LLM_PROVIDER=`.

---

### Step 3 — Start the backend server

```bash
./start.sh
```

You should see:

```
* Running on http://127.0.0.1:5000
```

Keep this terminal open while using the extension. The server handles paper fetching, LLM calls, and caching.

---

### Step 4 — Load the extension in Chrome (one-time)

1. Open Chrome and navigate to **`chrome://extensions/`**
2. Toggle **Developer mode** on — the switch is in the **top-right corner**
3. Click **Load unpacked**
4. In the file picker, select the **`paperagent` folder** (the root of this repo)
5. The **Paper Agent** extension will appear in the list with its icon

> **Tip:** Pin the extension for easy access — click the puzzle-piece icon in the Chrome toolbar, find Paper Agent, and click the pin icon.

---

### Step 5 — Use it

1. Navigate to any arXiv paper, e.g.:
   - Abstract page: `https://arxiv.org/abs/2303.08774`
   - PDF page: `https://arxiv.org/pdf/2303.08774`
2. Click the **Paper Agent icon** in the Chrome toolbar to open the side panel
3. Click **Summarize Paper**
4. The summary streams in, rendered with markdown and LaTeX math

---

### Updating the extension

After pulling new code, reload the extension so Chrome picks up the changes:

1. Go to `chrome://extensions/`
2. Find Paper Agent and click the **refresh icon** (↺)

No need to re-run `setup.sh` unless `environment.yml` changed.

---

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
