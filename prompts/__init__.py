"""
Prompt library for PaperAgent.

Registry pattern: each skill module registers itself by calling register().
Usage:
    from prompts import get_prompt, list_skills
    prompt = get_prompt("summarize", paper_content="...")
"""

import os

_registry: dict[str, dict] = {}


def register(name: str, *, builder, description: str = "", system: str | None = None):
    """Register a prompt skill.

    Args:
        name: Unique skill identifier (e.g., "summarize").
        builder: Callable(paper_content: str, **kwargs) -> str that returns
                 the user message content.
        description: Human-readable description of the skill.
        system: Optional system prompt.
    """
    _registry[name] = {
        "builder": builder,
        "description": description,
        "system": system,
    }


def get_prompt(name: str, **kwargs) -> dict:
    """Look up a skill and build the prompt messages.

    Returns:
        {"system": str | None, "user": str | list[dict]}
    The ``user`` value is a plain string for text-based content, or a list of
    Anthropic content blocks when a PDF document is involved.
    """
    if name not in _registry:
        available = ", ".join(sorted(_registry.keys()))
        raise ValueError(f"Unknown skill '{name}'. Available skills: {available}")

    entry = _registry[name]
    user_content = entry["builder"](**kwargs)
    system = entry["system"]

    lang = os.environ.get("LANGUAGE", "").strip()
    if system and lang and lang.lower() != "english":
        system += f"\n\nIMPORTANT: You MUST write your entire response in {lang}."

    return {
        "system": system,
        "user": user_content,
    }


def list_skills() -> list[dict]:
    """Return metadata for all registered skills."""
    return [
        {"name": name, "description": entry["description"]}
        for name, entry in sorted(_registry.items())
    ]


# Auto-import skill modules so they self-register.
# To add a new skill, create a module and add an import here.
from prompts import summarize  # noqa: E402, F401
