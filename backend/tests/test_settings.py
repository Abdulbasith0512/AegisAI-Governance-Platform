"""Regression tests for settings sanitization.

API keys pasted from dashboards routinely carry trailing newlines, which
HTTP clients reject (e.g. Qdrant "Illegal header value"). These tests prove
such values are stripped at load. Pure unit tests, no DB required.
"""

from app.config.settings import Settings


def test_api_key_trailing_newline_stripped() -> None:
    """The exact Render failure: key ending in \\n must load clean."""
    settings = Settings(QDRANT_API_KEY="eyJhbGciOiJIUzI1NiJ9.payload.sig\n")
    assert settings.QDRANT_API_KEY == "eyJhbGciOiJIUzI1NiJ9.payload.sig"
    assert "\n" not in settings.QDRANT_API_KEY


def test_api_key_surrounding_whitespace_stripped() -> None:
    """Spaces/tabs around provider keys are never significant."""
    settings = Settings(
        OPENAI_API_KEY="  sk-test-123  ",
        ANTHROPIC_API_KEY="\tsome-key\t",
        HUGGINGFACE_API_TOKEN="tok\n",
    )
    assert settings.OPENAI_API_KEY == "sk-test-123"
    assert settings.ANTHROPIC_API_KEY == "some-key"
    assert settings.HUGGINGFACE_API_TOKEN == "tok"


def test_empty_keys_stay_empty() -> None:
    """Unset keys must remain empty strings, not crash validation."""
    settings = Settings()
    assert settings.QDRANT_API_KEY == ""
    assert settings.OPENAI_API_KEY == ""


def test_passwords_not_stripped() -> None:
    """Passwords may legitimately contain spaces — leave them untouched."""
    settings = Settings(DB_PASSWORD="correct horse battery")
    assert settings.DB_PASSWORD == "correct horse battery"
