"""Abstract base class for LLM providers."""

from abc import ABC, abstractmethod
from collections.abc import Generator

# user content can be a plain string or a list of content blocks
# (e.g. [{"type": "document", ...}, {"type": "text", ...}])
UserContent = str | list[dict]

TOKEN_LIMIT = 120_000


class TokenLimitExceeded(ValueError):
    def __init__(self, estimated: int, limit: int = TOKEN_LIMIT):
        super().__init__(
            f"Input too long: estimated {estimated:,} tokens exceeds the "
            f"{limit:,}-token limit. Summary not generated."
        )
        self.estimated = estimated
        self.limit = limit


def count_tokens(content: UserContent) -> int:
    """Estimate token count from prompt content (4 chars ≈ 1 token)."""
    if isinstance(content, str):
        return len(content) // 4
    total = 0
    for block in content:
        if not isinstance(block, dict):
            continue
        total += len(block.get("text", "")) // 4
        total += len(block.get("data", "")) // 4  # base64-encoded PDF
    return total


class BaseLLMProvider(ABC):
    """Interface that all LLM providers must implement."""

    @abstractmethod
    def complete(self, *, system: str | None, user: UserContent) -> str:
        """Send a prompt and return the full response as a string."""
        ...

    @abstractmethod
    def stream(self, *, system: str | None, user: UserContent) -> Generator[str, None, None]:
        """Send a prompt and yield response chunks as they arrive."""
        ...
