"""Map target country names to ValueSERP / Google locale parameters."""

from typing import Any

# location label -> google_domain, gl, hl
_COUNTRY_LOCALE: dict[str, dict[str, str]] = {
    "united states": {"google_domain": "google.com", "gl": "us", "hl": "en"},
    "united kingdom": {"google_domain": "google.co.uk", "gl": "uk", "hl": "en"},
    "canada": {"google_domain": "google.ca", "gl": "ca", "hl": "en"},
    "australia": {"google_domain": "google.com.au", "gl": "au", "hl": "en"},
    "india": {"google_domain": "google.co.in", "gl": "in", "hl": "en"},
    "germany": {"google_domain": "google.de", "gl": "de", "hl": "de"},
    "france": {"google_domain": "google.fr", "gl": "fr", "hl": "fr"},
    "netherlands": {"google_domain": "google.nl", "gl": "nl", "hl": "nl"},
    "spain": {"google_domain": "google.es", "gl": "es", "hl": "es"},
    "italy": {"google_domain": "google.it", "gl": "it", "hl": "it"},
    "brazil": {"google_domain": "google.com.br", "gl": "br", "hl": "pt"},
    "mexico": {"google_domain": "google.com.mx", "gl": "mx", "hl": "es"},
    "japan": {"google_domain": "google.co.jp", "gl": "jp", "hl": "ja"},
    "singapore": {"google_domain": "google.com.sg", "gl": "sg", "hl": "en"},
    "united arab emirates": {"google_domain": "google.ae", "gl": "ae", "hl": "en"},
}

_DEFAULT = {"google_domain": "google.com", "gl": "us", "hl": "en"}


def locale_for_country(location: str) -> dict[str, str]:
    key = (location or "").strip().lower()
    return _COUNTRY_LOCALE.get(key, _DEFAULT)


def locale_kwargs(location: str) -> dict[str, Any]:
    loc = locale_for_country(location)
    return {
        "google_domain": loc["google_domain"],
        "gl": loc["gl"],
        "hl": loc["hl"],
    }
