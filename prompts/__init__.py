"""
Prompt library for PaperAgent.

Registry pattern: each skill module registers itself by calling register().
Usage:
    from prompts import get_prompt, list_skills
    prompt = get_prompt("summarize", paper_content="...")
"""

_registry: dict[str, dict] = {}


def register(name: str, *, builder, description: str = "", system: str | None = None, provider: str | None = None):
    """Register a prompt skill.

    Args:
        name: Unique skill identifier (e.g., "summarize").
        builder: Callable(paper_content: str, **kwargs) -> str that returns
                 the user message content.
        description: Human-readable description of the skill.
        system: Optional system prompt.
        provider: Optional LLM provider name (e.g., "anthropic", "qwen").
                  Falls back to the LLM_PROVIDER env var if not set.
    """
    _registry[name] = {
        "builder": builder,
        "description": description,
        "system": system,
        "provider": provider,
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
    return {
        "system": entry["system"],
        "user": user_content,
        "provider": entry.get("provider"),
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
from prompts import quickread  # noqa: E402, F401
