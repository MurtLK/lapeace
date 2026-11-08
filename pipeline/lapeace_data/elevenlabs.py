"""Small synchronous Scribe transport: exact settings, bounded IO, no paid retries."""

import json
import socket
import uuid
from urllib.error import HTTPError, URLError
from urllib.request import HTTPRedirectHandler, Request, build_opener

ENDPOINT = "https://api.elevenlabs.io/v1/speech-to-text"
MAX_RESPONSE = 16 * 1024 * 1024


class ProviderFailure(Exception):
    def __init__(self, code):
        self.code = code
        super().__init__(code)  # Never include headers, credentials, or provider error bodies.


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def multipart(audio, model_id, settings):
    if not audio or len(audio) > 32 * 1024 * 1024:
        raise ValueError("Pilot audio must be nonempty and below 32 MiB")
    boundary = "lapeace-" + uuid.uuid4().hex
    parts = []
    for key, value in {"model_id": model_id, **settings}.items():
        value = str(value).lower() if isinstance(value, bool) else str(value)
        parts.append((f'--{boundary}\r\nContent-Disposition: form-data; name="{key}"\r\n\r\n'
                      f'{value}\r\n').encode())
    parts.extend([(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; '
                   'filename="sample.mp3"\r\nContent-Type: audio/mpeg\r\n\r\n').encode(),
                  audio, f'\r\n--{boundary}--\r\n'.encode()])
    return b"".join(parts), "multipart/form-data; boundary=" + boundary


def transcribe_audio(audio, model_id, settings, api_key):
    body, content_type = multipart(audio, model_id, settings)
    req = Request(ENDPOINT, data=body, method="POST",
                  headers={"xi-api-key": api_key, "Content-Type": content_type})
    try:
        with build_opener(NoRedirect).open(req, timeout=90) as response:
            raw = response.read(MAX_RESPONSE + 1)
            request_id = response.headers.get("request-id") or response.headers.get("x-request-id")
    except HTTPError as error:
        error.close()
        raise ProviderFailure(f"http_{error.code}") from None
    except (URLError, TimeoutError, socket.timeout, OSError):
        raise ProviderFailure("network_or_timeout") from None
    if len(raw) > MAX_RESPONSE:
        raise ProviderFailure("response_too_large")
    # Parsing is done after raw response persistence by the caller.
    return raw, request_id


def transcript_text(raw):
    try:
        payload = json.loads(raw)
    except (ValueError, UnicodeError):
        raise ProviderFailure("invalid_json") from None
    if not isinstance(payload, dict) or not isinstance(payload.get("text"), str):
        raise ProviderFailure("missing_transcript_text")
    return payload["text"]  # Empty string is a valid all-deletions prediction.
