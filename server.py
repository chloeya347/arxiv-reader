"""
Simple Flask server to process arXiv papers using arxiv-to-prompt,
with a PDF fallback for non-arXiv pages.
"""
import base64
import hashlib
import json
import os
import shutil
import time
import urllib.request

from dotenv import load_dotenv

load_dotenv()

from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from arxiv_to_prompt import process_latex_source

from prompts import get_prompt, list_skills
from llm import get_provider
from llm.base import count_tokens, TokenLimitExceeded, TOKEN_LIMIT

app = Flask(__name__)
CORS(app)  # Allow requests from Chrome extension

CACHE_DIR = os.path.expanduser("~/.cache/arxiv-to-prompt")
PDF_CACHE_DIR = os.path.expanduser("~/.cache/paperagent/pdfs")
SUMMARY_CACHE_DIR = os.path.expanduser("~/.cache/paperagent/summaries")
CACHE_MAX_AGE_DAYS = 0.5
SUMMARY_CACHE_MAX_AGE_DAYS = 30

def clean_old_cache():
    """Delete cached paper folders older than CACHE_MAX_AGE_DAYS days."""
    for cache_dir in (CACHE_DIR, PDF_CACHE_DIR):
        if not os.path.isdir(cache_dir):
            continue
        cutoff = time.time() - CACHE_MAX_AGE_DAYS * 86400
        for entry in os.scandir(cache_dir):
            if entry.stat().st_mtime < cutoff:
                if entry.is_dir():
                    shutil.rmtree(entry.path, ignore_errors=True)
                else:
                    os.remove(entry.path)

def _summary_cache_path(skill_name: str, data: dict) -> str | None:
    """Return the cache file path for a skill + paper combination."""
    paper_content = data.get("paper_content")
    pdf_cache_key = data.get("pdf_cache_key")
    if paper_content:
        content_id = hashlib.sha256(paper_content.encode()).hexdigest()[:24]
    elif pdf_cache_key:
        content_id = pdf_cache_key
    else:
        return None
    key = hashlib.sha256(f"{skill_name}::{content_id}".encode()).hexdigest()[:16]
    os.makedirs(SUMMARY_CACHE_DIR, exist_ok=True)
    return os.path.join(SUMMARY_CACHE_DIR, f"{key}.txt")


def _read_summary_cache(path: str | None) -> str | None:
    """Return cached summary if it exists and is within max age, else None."""
    if not path or not os.path.exists(path):
        return None
    if (time.time() - os.path.getmtime(path)) / 86400 > SUMMARY_CACHE_MAX_AGE_DAYS:
        os.remove(path)
        return None
    with open(path) as f:
        return f.read()


def _write_summary_cache(path: str | None, text: str) -> None:
    if path:
        with open(path, "w") as f:
            f.write(text)


@app.route('/process-arxiv', methods=['POST'])
def process_arxiv():
    """
    Process an arXiv paper and return the LaTeX source.

    Expected JSON body:
    {
        "arxiv_id": "2303.08774",
        "keep_comments": false,
        "remove_appendix": true,
        "abstract_only": false
    }
    """
    try:
        clean_old_cache()
        data = request.json
        arxiv_id = data.get('arxiv_id')

        if not arxiv_id:
            return jsonify({'error': 'arxiv_id is required'}), 400

        # Extract options from request
        keep_comments = data.get('keep_comments', False)
        remove_appendix = data.get('remove_appendix', True)
        abstract_only = data.get('abstract_only', False)

        # Process the arXiv paper
        result = process_latex_source(
            arxiv_id,
            keep_comments=keep_comments,
            remove_appendix_section=remove_appendix,
            abstract_only=abstract_only
        )

        return jsonify({
            'success': True,
            'content': result,
            'arxiv_id': arxiv_id
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/process-pdf', methods=['POST'])
def process_pdf():
    """
    Download a PDF from a URL and cache it locally.

    Expected JSON body:
    {
        "url": "https://example.com/paper.pdf"
    }

    Returns a pdf_id that can be passed to /llm-skill-stream later.
    """
    try:
        clean_old_cache()
        data = request.json
        url = data.get('url')

        if not url:
            return jsonify({'error': 'url is required'}), 400

        # Deterministic cache key from the URL
        pdf_id = hashlib.sha256(url.encode()).hexdigest()[:16]
        os.makedirs(PDF_CACHE_DIR, exist_ok=True)
        pdf_path = os.path.join(PDF_CACHE_DIR, f"{pdf_id}.pdf")

        # Download if not already cached
        if not os.path.exists(pdf_path):
            req = urllib.request.Request(url, headers={"User-Agent": "PaperAgent/1.0"})
            with urllib.request.urlopen(req, timeout=30) as resp:
                with open(pdf_path, "wb") as f:
                    f.write(resp.read())

        size_bytes = os.path.getsize(pdf_path)
        filename = url.rsplit("/", 1)[-1] or "paper.pdf"

        return jsonify({
            'success': True,
            'pdf_id': pdf_id,
            'filename': filename,
            'size_bytes': size_bytes,
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/skills', methods=['GET'])
def skills():
    """List all available LLM skills."""
    return jsonify({'skills': list_skills()})


def _resolve_prompt_kwargs(data: dict) -> dict:
    """Build keyword arguments for get_prompt() from a request body.

    Supports two modes:
      - ``paper_content``: pass LaTeX text directly.
      - ``pdf_cache_key``: read a previously cached PDF and pass as base64.
    """
    paper_content = data.get('paper_content')
    pdf_cache_key = data.get('pdf_cache_key')

    if pdf_cache_key:
        pdf_path = os.path.join(PDF_CACHE_DIR, f"{pdf_cache_key}.pdf")
        if not os.path.exists(pdf_path):
            raise ValueError(f"Cached PDF '{pdf_cache_key}' not found. Re-extract the paper.")
        with open(pdf_path, "rb") as f:
            pdf_b64 = base64.standard_b64encode(f.read()).decode("ascii")
        return {"pdf_base64": pdf_b64}

    if paper_content:
        return {"paper_content": paper_content}

    raise ValueError("Either paper_content or pdf_cache_key is required")


@app.route('/llm-skill', methods=['POST'])
def llm_skill():
    """
    Run an LLM skill on paper content.

    Expected JSON body (one of):
    {
        "skill": "summarize",
        "paper_content": "<full LaTeX text>"
    }
    or:
    {
        "skill": "summarize",
        "pdf_cache_key": "<id from /process-pdf>"
    }
    """
    try:
        data = request.json
        skill_name = data.get('skill')

        if not skill_name:
            return jsonify({'success': False, 'error': 'skill is required'}), 400

        cache_path = _summary_cache_path(skill_name, data)
        cached = _read_summary_cache(cache_path)
        if cached:
            return jsonify({'success': True, 'result': cached, 'cached': True})

        prompt_kwargs = _resolve_prompt_kwargs(data)
        prompt = get_prompt(skill_name, **prompt_kwargs)

        n_tokens = count_tokens(prompt["user"])
        if prompt.get("system"):
            n_tokens += count_tokens(prompt["system"])
        if n_tokens > TOKEN_LIMIT:
            raise TokenLimitExceeded(n_tokens)

        provider = get_provider()
        result = provider.complete(system=prompt["system"], user=prompt["user"])
        _write_summary_cache(cache_path, result)

        return jsonify({'success': True, 'result': result})

    except ValueError as e:
        return jsonify({'success': False, 'error': str(e)}), 400
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/llm-skill-stream', methods=['POST'])
def llm_skill_stream():
    """
    Run an LLM skill with streaming response via Server-Sent Events.

    Same request body as /llm-skill.
    Response is text/event-stream with chunks:
        data: {"chunk": "partial text"}
        ...
        data: {"done": true}
    """
    try:
        data = request.json
        skill_name = data.get('skill')

        if not skill_name:
            return jsonify({'success': False, 'error': 'skill is required'}), 400

        cache_path = _summary_cache_path(skill_name, data)
        cached = _read_summary_cache(cache_path)
        if cached:
            def generate_cached():
                yield f"data: {json.dumps({'chunk': cached})}\n\n"
                yield f"data: {json.dumps({'done': True, 'cached': True})}\n\n"
            return Response(generate_cached(), mimetype='text/event-stream')

        prompt_kwargs = _resolve_prompt_kwargs(data)
        prompt = get_prompt(skill_name, **prompt_kwargs)

        n_tokens = count_tokens(prompt["user"])
        if prompt.get("system"):
            n_tokens += count_tokens(prompt["system"])
        if n_tokens > TOKEN_LIMIT:
            raise TokenLimitExceeded(n_tokens)

        provider = get_provider()

        def generate():
            accumulated = []
            try:
                for chunk in provider.stream(system=prompt["system"], user=prompt["user"]):
                    accumulated.append(chunk)
                    yield f"data: {json.dumps({'chunk': chunk})}\n\n"
                _write_summary_cache(cache_path, "".join(accumulated))
                yield f"data: {json.dumps({'done': True})}\n\n"
            except Exception as e:
                yield f"data: {json.dumps({'error': str(e)})}\n\n"

        return Response(generate(), mimetype='text/event-stream')

    except ValueError as e:
        return jsonify({'success': False, 'error': str(e)}), 400
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'ok'})

if __name__ == '__main__':
    print("Starting arXiv processing server on http://localhost:5000")
    app.run(debug=True, port=5000)
