from django.test import TestCase
from core.tasks import add


class TestTask(TestCase):
    def test_add_task(self):
        print("\ntesting task add...")
        # Temporarily test synchronously in same process.
        result = add.run(
            2, 3
        )  # Avoid Celery semantics entirely and makes intent clearer, while same as add.apply(args=(2, 3)).get(), in which: .apply runs synchronously in same process (no Redis needed, no worker needed, no hang caused, CI-safe); .get extracts the actual result from the EagerResult object returned by .apply.
        self.assertEqual(result, 5)
        # # Later on async broker (Redis/Kafka/etc.) will be used instead.
        # result = add.delay(2, 3).get(timeout=5)  # .delay uses async broker (Redis/Kafka/etc.); .get extracts the actual result from the AsyncResult object returned by .delay.
        # self.assertEqual(result, 5)
