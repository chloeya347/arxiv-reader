"""OpenAI-compatible providers.

Base class for any service that exposes an OpenAI-compatible chat completions
API.  Subclass and override the class-level constants to add a new provider.
"""

import os
from collections.abc import Generator

from openai import OpenAI

from llm.base import BaseLLMProvider, UserContent


class OpenAICompatibleProvider(BaseLLMProvider):
    """Reusable base for any OpenAI-compatible API."""

    # Subclasses override these ---
    ENV_PREFIX: str = "OPENAI"
    DEFAULT_BASE_URL: str | None = None
    DEFAULT_MODEL: str = "gpt-4o"
    DISPLAY_NAME: str = "OpenAI"

    def __init__(self):
        prefix = self.ENV_PREFIX
        api_key = os.environ.get(f"{prefix}_API_KEY")
        if not api_key:
            raise RuntimeError(
                f"{prefix}_API_KEY not set. Add it to your .env file."
            )
        base_url = os.environ.get(f"{prefix}_BASE_URL") or self.DEFAULT_BASE_URL
        self.client = OpenAI(api_key=api_key, base_url=base_url)
        self.model = os.environ.get(f"{prefix}_MODEL", self.DEFAULT_MODEL)
        self.max_tokens = int(os.environ.get(f"{prefix}_MAX_TOKENS", "4096"))

    def _convert_content_blocks(self, blocks: list[dict]) -> list[dict]:
        """Convert Anthropic-style content blocks to OpenAI-compatible format.

        Subclasses can override this to support provider-specific block types.
        The default implementation keeps only text blocks and raises if none
        are found.
        """
        has_document = any(b.get("type") == "document" for b in blocks)
        text_parts = [
            block["text"]
            for block in blocks
            if isinstance(block, dict) and block.get("type") == "text"
        ]
        if has_document:
            raise ValueError(
                f"{self.DISPLAY_NAME} provider does not support PDF input. "
                "Switch to the Anthropic or OpenAI provider, or use an arXiv "
                "link so LaTeX text can be extracted."
            )
        if not text_parts:
            raise ValueError(
                f"{self.DISPLAY_NAME} provider received empty content blocks."
            )
        return [{"type": "text", "text": "\n\n".join(text_parts)}]

    def _build_messages(self, *, system: str | None, user: UserContent) -> list[dict]:
        messages = []
        if system:
            messages.append({"role": "system", "content": system})

        if isinstance(user, str):
            messages.append({"role": "user", "content": user})
        else:
            content = self._convert_content_blocks(user)
            messages.append({"role": "user", "content": content})

        return messages

    def complete(self, *, system: str | None, user: UserContent) -> str:
        messages = self._build_messages(system=system, user=user)
        response = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            max_completion_tokens=self.max_tokens,
        )
        return response.choices[0].message.content

    def stream(self, *, system: str | None, user: UserContent) -> Generator[str, None, None]:
        messages = self._build_messages(system=system, user=user)
        with self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            max_completion_tokens=self.max_tokens,
            stream=True,
        ) as stream:
            for chunk in stream:
                delta = chunk.choices[0].delta.content
                if delta:
                    yield delta


class OpenAIProvider(OpenAICompatibleProvider):
    """OpenAI (GPT-4o, etc.)."""

    ENV_PREFIX = "OPENAI"
    DEFAULT_BASE_URL = None  # uses the official OpenAI endpoint
    DEFAULT_MODEL = "gpt-5-mini"
    DISPLAY_NAME = "OpenAI"

    def _convert_content_blocks(self, blocks: list[dict]) -> list[dict]:
        """Convert Anthropic document blocks to OpenAI file blocks."""
        converted = []
        for block in blocks:
            if not isinstance(block, dict):
                continue
            if block.get("type") == "text":
                converted.append({"type": "text", "text": block["text"]})
            elif block.get("type") == "document":
                source = block.get("source", {})
                data = source.get("data", "")
                media_type = source.get("media_type", "application/pdf")
                converted.append({
                    "type": "file",
                    "file": {
                        "filename": "paper.pdf",
                        "file_data": f"data:{media_type};base64,{data}",
                    },
                })
        if not converted:
            raise ValueError("OpenAI provider received empty content blocks.")
        return converted


class QwenProvider(OpenAICompatibleProvider):
    """Qwen via DashScope's OpenAI-compatible API."""

    ENV_PREFIX = "QWEN"
    DEFAULT_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    DEFAULT_MODEL = "qwen-long"
    DISPLAY_NAME = "Qwen"


class KimiProvider(OpenAICompatibleProvider):
    """Kimi (Moonshot AI) via their OpenAI-compatible API."""

    ENV_PREFIX = "KIMI"
    DEFAULT_BASE_URL = "https://api.moonshot.cn/v1"
    DEFAULT_MODEL = "kimi-k2-0905-preview"
    DISPLAY_NAME = "Kimi"


class DeepSeekProvider(OpenAICompatibleProvider):
    """DeepSeek via their OpenAI-compatible API."""

    ENV_PREFIX = "DEEPSEEK"
    DEFAULT_BASE_URL = "https://api.deepseek.com"
    DEFAULT_MODEL = "deepseek-chat"
    DISPLAY_NAME = "DeepSeek"
