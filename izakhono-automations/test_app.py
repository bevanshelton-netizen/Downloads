import os, tempfile, unittest
from datetime import datetime, timezone

_tmp=tempfile.TemporaryDirectory()
os.environ["IZA_AUTOMATIONS_DB"]=_tmp.name+"/test.db"
os.environ["IZA_AUTOMATIONS_ADMIN_TOKEN"]="test-token"

import app

class SchedulerTests(unittest.TestCase):
    def setUp(self):
        app.init_db()

    def test_interval_next_run(self):
        after=datetime(2026,9,15,20,0,tzinfo=timezone.utc)
        n=app.compute_next_run("interval",{"interval_minutes":15},after)
        self.assertEqual((n-after).total_seconds(),900)

    def test_daily_johannesburg(self):
        after=datetime(2026,9,15,5,0,tzinfo=timezone.utc) # 07:00 SAST
        n=app.compute_next_run("daily",{"time":"08:00","timezone":"Africa/Johannesburg"},after)
        self.assertEqual(n.hour,6)
        self.assertEqual(n.day,15)

    def test_weekly(self):
        after=datetime(2026,9,15,20,0,tzinfo=timezone.utc) # Tuesday
        n=app.compute_next_run("weekly",{"days":[0],"time":"08:00","timezone":"Africa/Johannesburg"},after)
        self.assertEqual(n.weekday(),0)

    def test_create_many_tasks_has_no_slot_limit(self):
        for i in range(75):
            app.create_task({"title":f"T{i}","mode":"interval","schedule":{"interval_minutes":60},"action":{"type":"log","message":"x"}})
        with app.db() as c:
            count=c.execute("select count(*) from tasks").fetchone()[0]
        self.assertEqual(count,75)

    def test_webhook_gets_token(self):
        item=app.create_task({"title":"Hook","mode":"webhook","action":{"type":"log","message":"ok"}})
        self.assertTrue(item["webhook_token"])
        self.assertIsNone(item["next_run"])

if __name__=="__main__":
    unittest.main()
