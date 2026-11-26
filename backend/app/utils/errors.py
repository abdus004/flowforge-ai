"""
Structured application errors.

Every error the API returns to the client uses the shape:

    { "error": { "code": "...", "message": "..." } }

Internal details (stack traces, provider payloads, env vars) are logged
server-side only and never included in the response.
"""


class AppError(Exception):
    """A safe, user-facing application error."""

    def __init__(self, code: str, message: str, status_code: int = 400):
        self.code = code
        self.message = message
        self.status_code = status_code
        super().__init__(message)
