"""
translators.py — Pluggable Hindi→English translation providers for the pipeline.

Select a provider with the TRANSLATOR environment variable (default: google):

    google — Google Cloud Translation v2 (GOOGLE_CLOUD_API_KEY). No word alignment.
    azure  — Azure Translator (AZURE_TRANSLATOR_KEY, AZURE_TRANSLATOR_REGION).
             Also returns word-level alignment.

Every provider implements:
    translate(text)       -> (english, alignment_proj)  alignment_proj is "" when unsupported
    translate_batch(texts) -> list[str]
"""

import os
from typing import Protocol

import requests

AZURE_ENDPOINT = "https://api.cognitive.microsofttranslator.com/translate"
GOOGLE_ENDPOINT = "https://translation.googleapis.com/language/translate/v2"
GOOGLE_BATCH_SIZE = 100  # API limit is 128 strings per request


class Translator(Protocol):
    name: str
    supports_alignment: bool
    batch_size: int

    def translate(self, text: str) -> tuple[str, str]: ...

    def translate_batch(self, texts: list[str]) -> list[str]: ...


class AzureTranslator:
    name = "azure"
    supports_alignment = True
    batch_size = 100

    def __init__(self, key: str, region: str) -> None:
        self._key = key
        self._region = region

    def _post(self, texts: list[str], align: bool) -> list[dict]:
        params = {"api-version": "3.0", "from": "hi", "to": "en"}
        if align:
            params["includeAlignment"] = "true"
        response = requests.post(
            AZURE_ENDPOINT,
            params=params,
            headers={
                "Ocp-Apim-Subscription-Key": self._key,
                "Ocp-Apim-Subscription-Region": self._region,
                "Content-Type": "application/json",
            },
            json=[{"text": t} for t in texts],
            timeout=30,
        )
        response.raise_for_status()
        return response.json()

    def translate(self, text: str) -> tuple[str, str]:
        result = self._post([text], align=True)[0]["translations"][0]
        return result["text"], result.get("alignment", {}).get("proj", "")

    def translate_batch(self, texts: list[str]) -> list[str]:
        return [item["translations"][0]["text"] for item in self._post(texts, align=False)]


class GoogleTranslator:
    name = "google"
    supports_alignment = False
    batch_size = GOOGLE_BATCH_SIZE

    def __init__(self, key: str) -> None:
        self._key = key

    def translate_batch(self, texts: list[str]) -> list[str]:
        response = requests.post(
            GOOGLE_ENDPOINT,
            params={"key": self._key},
            data={"q": texts, "source": "hi", "target": "en", "format": "text"},
            timeout=30,
        )
        response.raise_for_status()
        return [t["translatedText"] for t in response.json()["data"]["translations"]]

    def translate(self, text: str) -> tuple[str, str]:
        return self.translate_batch([text])[0], ""


def get_translator() -> Translator:
    """Build the provider selected by TRANSLATOR, exiting with a clear message if misconfigured."""
    name = os.environ.get("TRANSLATOR", "google").lower()
    if name == "google":
        key = os.environ.get("GOOGLE_CLOUD_API_KEY")
        if not key:
            raise SystemExit("Error: GOOGLE_CLOUD_API_KEY not set (TRANSLATOR=google)")
        return GoogleTranslator(key)
    if name == "azure":
        key = os.environ.get("AZURE_TRANSLATOR_KEY")
        if not key:
            raise SystemExit("Error: AZURE_TRANSLATOR_KEY not set (TRANSLATOR=azure)")
        return AzureTranslator(key, os.environ.get("AZURE_TRANSLATOR_REGION", "eastus"))
    raise SystemExit(f"Error: unknown TRANSLATOR '{name}' (expected 'google' or 'azure')")
