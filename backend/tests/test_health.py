import unittest
from app.main import root
from app.routes.health import health_check


class TestHealth(unittest.TestCase):
    def test_root_endpoint(self):
        response = root()
        self.assertEqual(response, {"message": "FlowForge Backend Running"})

    def test_health_endpoint(self):
        response = health_check()
        self.assertEqual(response["status"], "ok")
        self.assertEqual(response["service"], "flowforge-api")


if __name__ == "__main__":
    unittest.main()
