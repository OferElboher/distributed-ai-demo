from django.test import TestCase


class TestHealth(TestCase):
    def test_health_endpoint(self):
        print("\ntesting health...")
        response = self.client.get("/api/health/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})
