import unittest
from pydantic import ValidationError
from app.schemas.blueprint import BlueprintRequest, RecommendRequest


class TestSchemas(unittest.TestCase):
    def test_valid_blueprint_request(self):
        payload = {
            "name": "E-Commerce Platform",
            "description": "A modern multi-tenant e-commerce platform with real-time inventory.",
            "teamSize": "4",
            "experience": "intermediate",
            "timelineValue": "12",
            "timelineUnit": "weeks",
            "workflow": "ai-assisted",
        }
        req = BlueprintRequest.model_validate(payload)
        self.assertEqual(req.name, "E-Commerce Platform")
        self.assertEqual(req.team_size, "4")
        self.assertEqual(req.team_size_int, 4)
        self.assertEqual(req.experience, "intermediate")
        self.assertEqual(req.workflow, "ai-assisted")
        self.assertEqual(req.timeline_days, 12 * 7)

    def test_short_description_rejected(self):
        payload = {
            "name": "Too Short",
            "description": "short",
            "teamSize": "2",
            "experience": "beginner",
            "timelineValue": "4",
            "workflow": "traditional",
        }
        with self.assertRaises(ValidationError):
            BlueprintRequest.model_validate(payload)

    def test_invalid_team_size_rejected(self):
        payload = {
            "description": "A full description of the software project proposal.",
            "teamSize": "0",
            "experience": "advanced",
            "timelineValue": "4",
            "workflow": "full-ai",
        }
        with self.assertRaises(ValidationError):
            BlueprintRequest.model_validate(payload)

    def test_invalid_experience_level_rejected(self):
        payload = {
            "description": "A full description of the software project proposal.",
            "teamSize": "3",
            "experience": "master",  # invalid
            "timelineValue": "4",
            "workflow": "full-ai",
        }
        with self.assertRaises(ValidationError):
            BlueprintRequest.model_validate(payload)


if __name__ == "__main__":
    unittest.main()
