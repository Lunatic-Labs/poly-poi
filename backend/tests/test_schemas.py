"""
Tests for Pydantic schema validators.

TenantCreate.validate_slug enforces: r"^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$"
Min length 3 (one leading + 1-48 middle + one trailing), max length 50.
"""
import pytest
from pydantic import ValidationError

from app.schemas.tenant import TenantCreate


@pytest.mark.parametrize("slug", [
    "my-museum",            # typical
    "abc",                  # minimum length (3)
    "a" + "x" * 48 + "z",  # maximum length (50)
])
def test_valid_slugs(slug):
    t = TenantCreate(slug=slug, name="Test Org")
    assert t.slug == slug


@pytest.mark.parametrize("slug, reason", [
    ("ab",                      "too short"),
    ("a" + "x" * 49 + "z",     "too long"),
    ("-museum",                 "leading hyphen"),
    ("museum-",                 "trailing hyphen"),
    ("My-Museum",               "uppercase"),
    ("my_museum",               "underscore"),
    ("my museum",               "space"),
])
def test_invalid_slugs(slug, reason):
    with pytest.raises(ValidationError, match="Slug"):
        TenantCreate(slug=slug, name="Test Org")
