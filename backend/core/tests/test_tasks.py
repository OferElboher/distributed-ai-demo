from django.test import TestCase
from core.tasks import add


class TestTask(TestCase):
    def test_add_task(self):
        print("\ntesting task add...")
        result = add.delay(2, 3)
        self.assertEqual(result.get(timeout=5), 5)
