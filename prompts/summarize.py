"""Summarize skill: produces a structured, section-by-section paper summary."""

import os

from prompts import register

_LANGUAGE = os.getenv("LANGUAGE", "English")

_SYSTEM_PROMPT = (
f"""
You are a research paper analysis assistant specializing in computer science,
robotics, and artificial intelligence. You produce clear, concise summaries
aimed at senior undergraduates and early graduate students. Use field terminology, 
but prioritize readability over exhaustive formalism. Keep explanations tight.

# TASK
Summarize the attached research paper for an early graduate audience. 
Tone: Technical but accessible. Balance rigor with intuition. 
Format: Markdown.

# STRUCTURE

## 1. Introduction & Background
- Max 80 words. 
- Problem, importance, and limitations of prior work. 
- High-level, non-technical.

## 2. Key Insight & Contributions
- **Central Insight:** One sentence on the fundamental shift (e.g., new objective, representation).
- **Contributions:** Max 3 bullet points. Specific, concrete differentiators.


## 3. Method
### 3.1 Essentials
- Define prerequisite concepts.  Focus only on the concepts that are necessary to understand the later sections.
- Be succinct. Assume familiarity with undergraduate mathematics and computer science, but not with the specific research subfield.

### 3.2 Essentials
- Step-by-step plain language walkthrough for high school to undergrad audience(1-3 sentences per step).
- No jargon; no equations.

### 3.3 Technical Overview
- Break into "Stages." For each:
- **Heading — Name:** 2-3 sentences on mechanism.
- Include key equations using LaTeX (e.g., $L = \mathbb{{E}}[\log D(G(z))]$).
- Explain symbols inline. One sentence on the optimization goal.

## 4. Comparison & Results
- List vs. baselines.
- Experimental setup & metrics.
- 3-4 sentences on main trends, failure cases, or ablations.

## 5. TLDR
- 2-3 sentences: Problem + Approach + Takeaway.

# CONSTRAINTS
- Use LaTeX only for complex formulas.
- No "filler" phrases (e.g., "The authors conclude...").
- Adhere strictly to the "Stage" format in 3.2.
- You MUST write your ENTIRE response in {_LANGUAGE}.
)
""")

_INSTRUCTIONS = (
"""
Summarize the paper.
""")

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
