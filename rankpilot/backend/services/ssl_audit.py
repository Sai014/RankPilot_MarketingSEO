import logging
import socket
import ssl
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)


def _score_ssl(cert: dict[str, Any], tls_version: str | None, hostname: str) -> int:
    score = 0
    not_after = cert.get("not_after")
    days_left = cert.get("days_until_expiry")

    if cert.get("valid"):
        score += 50
    if days_left is not None and days_left > 30:
        score += 25
    if days_left is not None and days_left > 90:
        score += 15
    if tls_version and tls_version >= "TLSv1.2":
        score += 10

    # Hostname mismatch is a serious issue
    if cert.get("hostname_match") is False:
        score = max(0, score - 40)

    return max(0, min(100, score))


def run_ssl_audit(hostname: str, port: int = 443) -> dict[str, Any]:
    """
    Check TLS certificate and protocol using Python's ssl module.
    Lightweight alternative to SSLyze for Phase 1 deployments.
    """
    hostname = hostname.strip().lower()
    context = ssl.create_default_context()

    cert_info: dict[str, Any] = {
        "hostname": hostname,
        "port": port,
        "valid": False,
        "hostname_match": None,
        "issuer": None,
        "subject": None,
        "not_after": None,
        "days_until_expiry": None,
        "tls_version": None,
        "issues": [],
    }

    try:
        with socket.create_connection((hostname, port), timeout=15) as sock:
            with context.wrap_socket(sock, server_hostname=hostname) as ssock:
                cert = ssock.getpeercert()
                tls_version = ssock.version()
                cert_info["tls_version"] = tls_version
                cert_info["valid"] = True

                if cert:
                    not_after_str = cert.get("notAfter")
                    if not_after_str:
                        not_after = datetime.strptime(not_after_str, "%b %d %H:%M:%S %Y %Z")
                        not_after = not_after.replace(tzinfo=timezone.utc)
                        now = datetime.now(timezone.utc)
                        days_left = (not_after - now).days
                        cert_info["not_after"] = not_after.isoformat()
                        cert_info["days_until_expiry"] = days_left
                        if days_left < 0:
                            cert_info["issues"].append("Certificate expired")
                        elif days_left < 30:
                            cert_info["issues"].append(f"Certificate expires in {days_left} days")

                    issuer = cert.get("issuer")
                    if issuer:
                        cert_info["issuer"] = dict(x[0] for x in issuer if x)
                    subject = cert.get("subject")
                    if subject:
                        cert_info["subject"] = dict(x[0] for x in subject if x)

                try:
                    context.check_hostname = True
                    context.verify_mode = ssl.CERT_REQUIRED
                    with socket.create_connection((hostname, port), timeout=15) as sock2:
                        with context.wrap_socket(sock2, server_hostname=hostname):
                            cert_info["hostname_match"] = True
                except ssl.CertificateError:
                    cert_info["hostname_match"] = False
                    cert_info["issues"].append("Certificate hostname mismatch")

                if tls_version and tls_version < "TLSv1.2":
                    cert_info["issues"].append(f"Weak TLS version: {tls_version}")

    except ssl.SSLError as exc:
        cert_info["issues"].append(f"SSL error: {exc}")
        logger.warning("SSL audit failed hostname=%s: %s", hostname, exc)
    except OSError as exc:
        cert_info["issues"].append(f"Connection error: {exc}")
        logger.warning("SSL audit connection failed hostname=%s: %s", hostname, exc)

    score = _score_ssl(cert_info, cert_info.get("tls_version"), hostname)
    cert_info["score"] = score

    logger.info("SSL audit hostname=%s score=%d issues=%d", hostname, score, len(cert_info["issues"]))
    return cert_info
