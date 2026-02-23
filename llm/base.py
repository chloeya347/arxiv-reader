"""Abstract base class for LLM providers."""

from abc import ABC, abstractmethod
from collections.abc import Generator

# user content can be a plain string or a list of content blocks
# (e.g. [{"type": "document", ...}, {"type": "text", ...}])
UserContent = str | list[dict]


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
