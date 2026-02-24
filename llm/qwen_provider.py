"""Qwen provider via DashScope's OpenAI-compatible API."""

import os
from collections.abc import Generator

from openai import OpenAI

from llm.base import BaseLLMProvider, UserContent

# DashScope OpenAI-compatible base URL
_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"

# Model tiers (cheap → capable)
# qwen-turbo   — fastest, cheapest
# qwen-plus    — balanced
# qwen-max     — most capable
# qwen-long    — large context window


class QwenProvider(BaseLLMProvider):
    """LLM provider backed by Qwen via DashScope's OpenAI-compatible API."""

    def __init__(self):
        api_key = os.environ.get("QWEN_API_KEY")
        if not api_key:
            raise RuntimeError(
                "QWEN_API_KEY not set. Add it to your .env file. "
                "Get a key at https://dashscope.console.aliyun.com/"
            )
        self.client = OpenAI(api_key=api_key, base_url=_BASE_URL)
        self.model = os.environ.get("QWEN_MODEL", "qwen-turbo")
        self.max_tokens = int(os.environ.get("QWEN_MAX_TOKENS", "4096"))

    def _build_messages(self, *, system: str | None, user: UserContent) -> list[dict]:
        messages = []
        if system:
            messages.append({"role": "system", "content": system})

        if isinstance(user, str):
            messages.append({"role": "user", "content": user})
        else:
            # user is a list of Anthropic-style content blocks — extract text only
            text_parts = [
                block["text"]
                for block in user
                if isinstance(block, dict) and block.get("type") == "text"
            ]
            if not text_parts:
                raise ValueError(
                    "Qwen provider received non-text content blocks (e.g. PDF). "
                    "Only text content is supported."
                )
            messages.append({"role": "user", "content": "\n\n".join(text_parts)})

        return messages

    def complete(self, *, system: str | None, user: UserContent) -> str:
        messages = self._build_messages(system=system, user=user)
        response = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            max_tokens=self.max_tokens,
        )
        return response.choices[0].message.content

    def stream(self, *, system: str | None, user: UserContent) -> Generator[str, None, None]:
        messages = self._build_messages(system=system, user=user)
        with self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            max_tokens=self.max_tokens,
            stream=True,
        ) as stream:
            for chunk in stream:
                delta = chunk.choices[0].delta.content
                if delta:
                    yield delta
