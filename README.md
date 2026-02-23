# Paper Agent

A Chrome extension that extracts and processes arXiv papers using LaTeX source code.

## Features

- 🔍 Automatically detects arXiv papers (PDF or abstract pages)
- 📄 Extracts full LaTeX source using `arxiv-to-prompt`
- 🎯 Removes comments and appendix sections by default
- 📋 Copy extracted content to clipboard
- 🤖 Ready for AI summarization (coming soon)

## How It Works

1. **Navigate to an arXiv paper**: Visit `arxiv.org/pdf/{id}` or `arxiv.org/abs/{id}`
2. **Open the extension**: Click the Paper Agent icon
3. **Extract**: Click the "Extract Paper" button
4. **Process**: The extension detects the arXiv ID, sends it to the Python backend, which uses `arxiv-to-prompt` to fetch and process the LaTeX source

## Setup

### 1. Install Python Dependencies

```bash
cd /Users/chloeya/CodingProjects/paperagent
pip install -r requirements.txt
```

### 2. Start the Python Backend

```bash
python server.py
```

The server will run on `http://localhost:5000`

### 3. Load the Chrome Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `/Users/chloeya/CodingProjects/paperagent` folder

### 4. Use the Extension

1. Navigate to an arXiv paper (e.g., `https://arxiv.org/pdf/2303.08774`)
2. Click the Paper Agent extension icon
3. Click "Extract Paper"
4. The LaTeX source will be displayed in the sidebar

## Architecture

```
┌─────────────────┐
│  arXiv Website  │
│  (PDF/Abstract) │
└────────┬────────┘
         │
         │ (1) User clicks "Extract Paper"
         ▼
┌─────────────────┐
│  Content Script │ ─────┐
│  (content.js)   │      │ (2) Extract arXiv ID from URL
└─────────────────┘      │
                         ▼
                  ┌─────────────────┐
                  │  Side Panel     │
                  │  (sidepanel.js) │
                  └────────┬────────┘
                           │
                           │ (3) Send arXiv ID to backend
                           ▼
                  ┌─────────────────┐
                  │  Python Server  │
                  │  (server.py)    │
                  └────────┬────────┘
                           │
                           │ (4) Call arxiv-to-prompt
                           ▼
                  ┌─────────────────┐
                  │ arxiv-to-prompt │
                  │    Package      │
                  └────────┬────────┘
                           │
                           │ (5) Download & process LaTeX
                           ▼
                  ┌─────────────────┐
                  │  LaTeX Source   │
                  │  (cleaned)      │
                  └─────────────────┘
```

## Files

- **manifest.json**: Chrome extension configuration
- **content.js**: Injected into web pages, detects arXiv URLs
- **sidepanel.html/js/css**: Extension UI
- **background.js**: Opens side panel on icon click
- **server.py**: Flask backend that calls `arxiv-to-prompt`
- **requirements.txt**: Python dependencies

## API Options

The backend supports these options when processing papers:

```javascript
{
  "arxiv_id": "2303.08774",
  "keep_comments": false,      // Remove LaTeX comments
  "remove_appendix": true,     // Remove appendix sections
  "abstract_only": false       // Extract only the abstract
}
```

## Troubleshooting

### "Python server not running" error
- Make sure you started the server with `python server.py`
- Check that it's running on `http://localhost:5000`
- Verify the terminal shows "Running on http://127.0.0.1:5000"

### Extension not detecting arXiv papers
- Make sure you're on `arxiv.org/pdf/{id}` or `arxiv.org/abs/{id}`
- Check the browser console for errors (F12 → Console)

### No content extracted
- Check the Python server terminal for error messages
- Verify the arXiv ID is valid
- Try the arXiv ID directly in the server:
  ```bash
  curl -X POST http://localhost:5000/process-arxiv \
    -H "Content-Type: application/json" \
    -d '{"arxiv_id": "2303.08774"}'
  ```

## Next Steps

- [ ] Add Claude API integration for summarization
- [ ] Support local LaTeX files
- [ ] Add figure extraction
- [ ] Customize which sections to keep/remove
- [ ] Export to different formats
