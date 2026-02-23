"""Anthropic Claude provider."""

import os
from collections.abc import Generator

import anthropic

from llm.base import BaseLLMProvider, UserContent


class AnthropicProvider(BaseLLMProvider):
    """LLM provider backed by the Anthropic Messages API."""

    def __init__(self):
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError(
                "ANTHROPIC_API_KEY not set. Add it to your .env file."
            )
        self.client = anthropic.Anthropic(api_key=api_key)
        self.model = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-20250514")
        self.max_tokens = int(os.environ.get("ANTHROPIC_MAX_TOKENS", "4096"))

    def _build_kwargs(self, *, system: str | None, user: UserContent) -> dict:
        kwargs = {
            "model": self.model,
            "max_tokens": self.max_tokens,
            "messages": [{"role": "user", "content": user}],
        }
        if system:
            kwargs["system"] = system
        return kwargs

    def complete(self, *, system: str | None, user: UserContent) -> str:
        kwargs = self._build_kwargs(system=system, user=user)
        response = self.client.messages.create(**kwargs)
        return response.content[0].text

    def stream(self, *, system: str | None, user: UserContent) -> Generator[str, None, None]:
        kwargs = self._build_kwargs(system=system, user=user)
        with self.client.messages.stream(**kwargs) as stream:
            for text in stream.text_stream:
                yield text
