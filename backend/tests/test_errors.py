import unittest
from app.utils.errors import AppError
from app.services.ai_provider import AIProviderError


class TestErrors(unittest.TestCase):
    def test_app_error_attributes(self):
        err = AppError(code="TEST_ERROR", message="Something broke", status_code=400)
        self.assertEqual(err.code, "TEST_ERROR")
        self.assertEqual(err.message, "Something broke")
        self.assertEqual(err.status_code, 400)

    def test_ai_provider_error_subclass(self):
        err = AIProviderError(code="AI_NOT_CONFIGURED", message="AI not configured", status_code=503)
        self.assertTrue(issubclass(AIProviderError, AppError))
        self.assertTrue(isinstance(err, AppError))
        self.assertEqual(err.status_code, 503)


if __name__ == "__main__":
    unittest.main()
