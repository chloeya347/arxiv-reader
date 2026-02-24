"""LLM provider factory."""

import os

from llm.base import BaseLLMProvider

# Maps config string -> (module_path, class_name)
_PROVIDERS = {
    "anthropic": ("llm.anthropic_provider", "AnthropicProvider"),
    "openai": ("llm.openai_provider", "OpenAIProvider"),
    "gemini": ("llm.gemini_provider", "GeminiProvider"),
    "qwen": ("llm.openai_provider", "QwenProvider"),
    "kimi": ("llm.openai_provider", "KimiProvider"),
    "deepseek": ("llm.openai_provider", "DeepSeekProvider"),
}

_instances: dict[str, BaseLLMProvider] = {}


def get_provider(name: str | None = None) -> BaseLLMProvider:
    """Return a cached LLM provider by name.

    If ``name`` is None, falls back to the LLM_PROVIDER env var (default: "anthropic").
    Providers are lazily instantiated and cached per name.
    """
    if name is None:
        name = os.environ.get("LLM_PROVIDER", "anthropic").lower()
    else:
        name = name.lower()

    if name in _instances:
        return _instances[name]

    if name not in _PROVIDERS:
        available = ", ".join(sorted(_PROVIDERS.keys()))
        raise RuntimeError(
            f"Unknown LLM provider '{name}'. Available: {available}"
        )

    import importlib

    module_path, class_name = _PROVIDERS[name]
    module = importlib.import_module(module_path)
    cls = getattr(module, class_name)
    _instances[name] = cls()
    return _instances[name]
