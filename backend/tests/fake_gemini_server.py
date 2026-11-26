"""
A tiny local imitation of Gemini's generateContent REST endpoint.

It lets the tests run the REAL google-genai SDK (request building, headers,
error mapping, structured-output parsing) without touching Google. It proves
how our code behaves with the real SDK, NOT that Google's live service works.
"""
from __future__ import annotations

import json
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

_STATUS = {400: "INVALID_ARGUMENT", 401: "UNAUTHENTICATED", 403: "PERMISSION_DENIED", 404: "NOT_FOUND",
           429: "RESOURCE_EXHAUSTED", 500: "INTERNAL", 503: "UNAVAILABLE", 504: "DEADLINE_EXCEEDED"}


class FakeGeminiServer:
    """
    script maps model name (or "*") to a list of steps, consumed in order; the
    last step repeats forever. A step is one of:
        ("status", http_code[, message])
        ("ok", text[, finish_reason])
        ("sleep_then_ok", seconds, text)
    """

    def __init__(self, script: dict[str, list[tuple]] | None = None, catalogue: list[dict] | None = None) -> None:
        self.script = {m: list(s) for m, s in (script or {}).items()}
        self.catalogue = catalogue or []
        self.requests: list[dict[str, Any]] = []
        self._lock = threading.Lock()
        outer = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *args: Any) -> None:  # keep test output clean
                pass

            def do_GET(self) -> None:  # noqa: N802  (models.list)
                payload = json.dumps({"models": outer.catalogue}).encode()
                self.send_response(200)
                self.send_header("content-type", "application/json")
                self.send_header("content-length", str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)

            def do_POST(self) -> None:  # noqa: N802
                length = int(self.headers.get("content-length", 0))
                body = json.loads(self.rfile.read(length) or b"{}")
                model = self.path.split("/models/")[1].split(":")[0]
                with outer._lock:
                    outer.requests.append({"model": model, "headers": {k.lower(): v for k, v in self.headers.items()}, "body": body})
                    steps = outer.script.get(model) or outer.script.get("*") or [("status", 404)]
                    step = steps.pop(0) if len(steps) > 1 else steps[0]
                if step[0] == "sleep_then_ok":
                    time.sleep(step[1])
                    step = ("ok", step[2])
                try:
                    if step[0] == "status":
                        code = step[1]
                        msg = step[2] if len(step) > 2 else f"{_STATUS.get(code, 'ERROR')} (simulated)"
                        payload = json.dumps({"error": {"code": code, "message": msg, "status": _STATUS.get(code, "ERROR")}}).encode()
                    else:
                        code = 200
                        payload = json.dumps({
                            "candidates": [{"content": {"role": "model", "parts": [{"text": step[1]}]},
                                            "finishReason": step[2] if len(step) > 2 else "STOP", "index": 0}],
                            "usageMetadata": {"promptTokenCount": 10, "candidatesTokenCount": 10, "totalTokenCount": 20},
                        }).encode()
                    self.send_response(code)
                    self.send_header("content-type", "application/json")
                    self.send_header("content-length", str(len(payload)))
                    self.end_headers()
                    self.wfile.write(payload)
                except (BrokenPipeError, ConnectionResetError):
                    pass  # client gave up (timeout test)

        self._httpd = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self._thread = threading.Thread(target=self._httpd.serve_forever, daemon=True)

    @property
    def base_url(self) -> str:
        return f"http://127.0.0.1:{self._httpd.server_address[1]}"

    def __enter__(self) -> "FakeGeminiServer":
        self._thread.start()
        return self

    def __exit__(self, *exc: Any) -> None:
        self._httpd.shutdown()
        self._httpd.server_close()

    def calls(self, model: str | None = None) -> list[dict[str, Any]]:
        return [r for r in self.requests if model is None or r["model"] == model]
