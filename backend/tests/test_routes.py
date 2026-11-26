import unittest
from app.main import app


class TestRoutes(unittest.TestCase):
    def test_registered_routes(self):
        paths = list(app.openapi()["paths"].keys())
        self.assertIn("/", paths)
        self.assertIn("/api/health", paths)
        self.assertIn("/api/generate-blueprint", paths)
        self.assertIn("/api/recommend-workflow", paths)

    def test_cors_middleware_configured(self):
        middleware_names = [m.cls.__name__ for m in app.user_middleware]
        self.assertIn("CORSMiddleware", middleware_names)


if __name__ == "__main__":
    unittest.main()
