#!/usr/bin/env python3
"""Server-only iKhokha iK Pay API adapter for IZAKHONO PAY."""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request

API_BASE = "https://api.ikhokha.com/public-api/v1/api"
PAYMENT_ENDPOINT = f"{API_BASE}/payment"
SECUREPAY_HOST = "securepay.ikhokha.red"
PAYLINK_RE = re.compile(r"^[A-Za-z0-9_-]+$")


class IkhokhaError(RuntimeError):
    pass


def configured() -> bool:
    return bool(os.environ.get("IKHOKHA_APP_ID", "").strip() and os.environ.get("IKHOKHA_APP_SECRET", "").strip())


def _credentials() -> tuple[str, str]:
    app_id = os.environ.get("IKHOKHA_APP_ID", "").strip()
    app_secret = os.environ.get("IKHOKHA_APP_SECRET", "").strip()
    if not app_id or not app_secret:
        raise IkhokhaError("iKhokha is not configured")
    return app_id, app_secret


def _escape_for_signature(value: str) -> str:
    out = []
    for char in value:
        if char in {"\\", '"', "'"}:
            out.append("\\" + char)
        elif char == "\x00":
            out.append("\\0")
        else:
            out.append(char)
    return "".join(out)


def signature_for(path: str, body: str, secret: str) -> str:
    payload = _escape_for_signature(path + body)
    return hmac.new(secret.strip().encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).hexdigest()


def _json_request(url: str, method: str, body: str = "") -> dict:
    app_id, app_secret = _credentials()
    parsed = urllib.parse.urlsplit(url)
    signature = signature_for(parsed.path, body, app_secret)
    headers = {
        "Accept": "application/json",
        "IK-APPID": app_id,
        "IK-SIGN": signature,
    }
    data = None
    if body:
        headers["Content-Type"] = "application/json"
        data = body.encode("utf-8")
    request = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            raw = response.read(256 * 1024)
            status = response.status
    except urllib.error.HTTPError as exc:
        raw = exc.read(64 * 1024)
        try:
            payload = json.loads(raw.decode("utf-8"))
            message = str(payload.get("message") or payload.get("error") or f"HTTP {exc.code}")
        except Exception:
            message = f"HTTP {exc.code}"
        raise IkhokhaError(f"iKhokha request failed: {message}") from exc
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        raise IkhokhaError("iKhokha request could not be completed") from exc
    if not (200 <= status < 300):
        raise IkhokhaError(f"iKhokha request failed with HTTP {status}")
    try:
        value = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise IkhokhaError("iKhokha returned invalid JSON") from exc
    if not isinstance(value, dict):
        raise IkhokhaError("iKhokha returned an invalid response")
    return value


def _safe_https(url: str, expected_host: str | None = None) -> str:
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme != "https" or not parsed.netloc or parsed.username or parsed.password:
        raise IkhokhaError("unsafe HTTPS URL")
    if expected_host and parsed.hostname != expected_host:
        raise IkhokhaError("unexpected iKhokha checkout host")
    return url


def create_payment_link(
    *,
    order_id: str,
    amount_minor: int,
    description: str,
    callback_url: str,
    success_url: str,
    failure_url: str,
    cancel_url: str,
) -> dict:
    app_id, _ = _credentials()
    if not isinstance(amount_minor, int) or amount_minor <= 0:
        raise IkhokhaError("invalid iKhokha payment amount")
    for url in (callback_url, success_url, failure_url, cancel_url):
        _safe_https(url)

    request_body = {
        "entityID": app_id,
        "amount": amount_minor,
        "currency": "ZAR",
        "requesterUrl": urllib.parse.urlsplit(callback_url)._replace(path="", query="", fragment="").geturl().rstrip("/"),
        "description": description[:180],
        "paymentReference": order_id,
        "mode": os.environ.get("IKHOKHA_MODE", "live").strip() or "live",
        "externalTransactionID": order_id,
        "urls": {
            "callbackUrl": callback_url,
            "successPageUrl": success_url,
            "failurePageUrl": failure_url,
            "cancelUrl": cancel_url,
        },
    }
    body = json.dumps(request_body, separators=(",", ":"), ensure_ascii=False)
    payload = _json_request(PAYMENT_ENDPOINT, "POST", body)
    if str(payload.get("responseCode") or "") != "00":
        raise IkhokhaError(str(payload.get("message") or "iKhokha did not create the payment link"))
    paylink_id = str(payload.get("paylinkID") or "").strip()
    paylink_url = str(payload.get("paylinkUrl") or "").strip()
    if not paylink_id or not PAYLINK_RE.fullmatch(paylink_id):
        raise IkhokhaError("iKhokha returned an invalid payment-link ID")
    _safe_https(paylink_url, SECUREPAY_HOST)
    external_id = str(payload.get("externalTransactionID") or order_id)
    if external_id != order_id:
        raise IkhokhaError("iKhokha checkout reference mismatch")
    return {
        "paylink_id": paylink_id,
        "redirect_url": paylink_url,
        "external_transaction_id": external_id,
    }


def get_payment_status(paylink_id: str) -> dict:
    clean = paylink_id.strip()
    if not PAYLINK_RE.fullmatch(clean):
        raise IkhokhaError("invalid iKhokha payment-link ID")
    endpoint = f"{API_BASE}/getStatus/{urllib.parse.quote(clean, safe='')}"
    payload = _json_request(endpoint, "GET")
    returned = str(payload.get("paylinkID") or "").strip()
    if returned != clean:
        raise IkhokhaError("iKhokha status response did not match the payment link")
    try:
        amount = int(payload.get("amount"))
    except (TypeError, ValueError) as exc:
        raise IkhokhaError("iKhokha status response did not contain a valid amount") from exc
    return {
        "paylink_id": returned,
        "status": str(payload.get("status") or "").upper(),
        "amount_minor": amount,
        "raw": payload,
    }


def verify_webhook(*, request_path: str, raw_body: bytes, app_id_header: str | None, signature_header: str | None) -> bool:
    app_id, app_secret = _credentials()
    if not app_id_header or not hmac.compare_digest(app_id_header.strip(), app_id):
        return False
    if not signature_header:
        return False
    received = signature_header.strip().lower()
    if not re.fullmatch(r"[0-9a-f]{64}", received):
        return False
    try:
        body = raw_body.decode("utf-8")
    except UnicodeDecodeError:
        return False
    expected = signature_for(request_path, body, app_secret)
    return hmac.compare_digest(received, expected)
