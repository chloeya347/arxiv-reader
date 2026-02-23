"""Summarize skill: produces a structured, section-by-section paper summary."""

from prompts import register

_SYSTEM_PROMPT = (
    "You are a research paper analysis assistant specializing in computer science, "
    "robotics, and artificial intelligence. You produce clear, technically precise "
    "summaries aimed at researchers and graduate students and advanced undergraduates. Use the terminology of "
    "the field. Do not simplify concepts unnecessarily."
)

_INSTRUCTIONS = """\
Provide a structured summary organized as follows:

## Title & Authors
State the paper title and list of authors.

## TL;DR
One to two sentences capturing the core contribution.

## Problem & Motivation
What problem does this paper address? Why does it matter?

## Approach / Method
Describe the proposed method, architecture, or framework. Include key \
technical details (model components, loss functions, algorithms, etc.).

## Experiments & Results
Summarize the experimental setup (datasets, baselines, metrics) and the \
main quantitative results. Highlight where the method outperforms or \
underperforms baselines.

## Key Contributions
Bullet-point list of the paper's main contributions as claimed by the authors.

## Limitations & Future Work
Note any limitations acknowledged by the authors or apparent from the results, \
and any suggested future directions."""

_TEXT_PREFIX = "Below is the full LaTeX source of an academic paper."
_PDF_PREFIX = "The attached PDF is an academic paper."


def _build(*, paper_content: str | None = None, pdf_base64: str | None = None, **_kwargs):
    """Return a plain string (text path) or a list of content blocks (PDF path)."""
    if pdf_base64:
        return [
            {
                "type": "document",
                "source": {
                    "type": "base64",
                    "media_type": "application/pdf",
                    "data": pdf_base64,
                },
            },
            {
                "type": "text",
                "text": f"{_PDF_PREFIX} {_INSTRUCTIONS}",
            },
        ]

    return f"{_TEXT_PREFIX} {_INSTRUCTIONS}\n\n---\n\nPaper content:\n\n{paper_content}"


register(
    "summarize",
    builder=_build,
    description="Structured section-by-section summary of a research paper",
    system=_SYSTEM_PROMPT,
)
