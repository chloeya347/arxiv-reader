"""LLM provider factory."""

import os

from llm.base import BaseLLMProvider

# Maps config string -> (module_path, class_name)
_PROVIDERS = {
    "anthropic": ("llm.anthropic_provider", "AnthropicProvider"),
    # "openai": ("llm.openai_provider", "OpenAIProvider"),
}

_instance: BaseLLMProvider | None = None


def get_provider() -> BaseLLMProvider:
    """Return a singleton LLM provider based on the LLM_PROVIDER env var.

    Lazily instantiated on first call.
    """
    global _instance
    if _instance is not None:
        return _instance

    provider_name = os.environ.get("LLM_PROVIDER", "anthropic").lower()
    if provider_name not in _PROVIDERS:
        available = ", ".join(sorted(_PROVIDERS.keys()))
        raise RuntimeError(
            f"Unknown LLM_PROVIDER '{provider_name}'. Available: {available}"
        )

    import importlib

    module_path, class_name = _PROVIDERS[provider_name]
    module = importlib.import_module(module_path)
    cls = getattr(module, class_name)
    _instance = cls()
    return _instance
