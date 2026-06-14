import re


def normalize_domain(domain: str) -> str:
    """Strip protocol, www, trailing slash → bare domain."""
    domain = domain.strip().lower()
    domain = re.sub(r"^https?://", "", domain)
    domain = domain.split("/")[0]
    domain = re.sub(r"^www\.", "", domain)
    return domain


def site_url_from_domain(domain: str) -> str:
    return f"https://{normalize_domain(domain)}"
