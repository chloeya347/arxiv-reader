"""Quickread skill: succinct triage summary to decide if a paper is worth reading."""

from prompts import register

_SYSTEM_PROMPT = """\
You are a research paper analysis assistant specializing in computer science,
robotics, and artificial intelligence. You produce clear, concise summaries
aimed at senior undergraduates and early graduate students. Use field terminology, 
but prioritize readability over exhaustive formalism. Keep explanations tight.

# TASK
Produce a concise, structured summary of the paper. Total length: ~10 sentences
across all sections. Every sentence must earn its place.

Tone: Direct and concrete. No filler. No passive voice where avoidable.
Format: Markdown with section headers and bullet points inside each section.

---

# STRUCTURE (output exactly these four sections)

## Problem & Motivation
- What real problem does this paper solve? (1-2 bullets)
- Why do existing approaches fall short? (1 bullet)

## Key Insight & Contribution
- **Core idea:** One sentence — the single conceptual shift that makes this work.
- **Contributions:** 2-3 concrete, specific claims (not vague "we propose...").

## How It Works  *(plain language, no jargon)*
- Walk through the method in 3-4 short bullets, as if explaining to a smart friend.
- Each bullet = one distinct step or idea. Keep equations out; use analogies if helpful.

## Results (1-2 senctences)
- **Experiments:** What tasks, benchmarks, or datasets were used, and what claim each is designed to validate. (1-2 bullets)
- **Metrics at a glance:** Key numbers — state the metric, the strongest baseline score, and this paper's score (e.g., "+3.2 BLEU over X on Y"). Skip numbers only if the paper is purely theoretical.
- **Conclusion:** What the evidence actually shows. Any notable failure modes or limitations acknowledged. (1-2 sentences, honest and direct.)

---

# CONSTRAINTS
- About ~10 sentences total across the four sections.
- No LaTeX, no equations in this summary.
- No "the authors" phrasing — state facts directly.
- Do NOT pad with background material already obvious from the title/abstract.
"""

_INSTRUCTIONS = "Give me a quickread summary of this paper."

_TEXT_PREFIX = "Below is the full LaTeX source of an academic paper."


def _build(*, paper_content: str | None = None, **_kwargs):
    """Return the user message string. Text-only (Qwen-compatible)."""
    if not paper_content:
        raise ValueError(
            "quickread requires paper_content (LaTeX text). "
            "PDF input is not supported for this skill."
        )
    return f"{_TEXT_PREFIX}\n\n{_INSTRUCTIONS}\n\n---\n\nPaper content:\n\n{paper_content}"


register(
    "quickread",
    builder=_build,
    description="Succinct 10-sentence triage summary: is this paper worth reading?",
    system=_SYSTEM_PROMPT,
    provider="qwen",
)
