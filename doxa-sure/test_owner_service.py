import hashlib
import hmac
import json
import tempfile
import unittest
from pathlib import Path

import owner_service as service


class OwnerStoreTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.db = Path(self.temp.name) / "test.sqlite3"
        service.init_db(self.db)
        self.value = {
            "event": "payment.paid", "event_id": "evt_" + "a" * 40, "merchant": "doxa-sure",
            "order": {"id": "ord_0123456789abcdef", "product_code": "rescue-readiness-pack",
              "customer_reference": "case-1", "payment_reference": "DOXASURE-A1B2C3D4",
              "bank_reference": "FNB-SETTLED-1", "amount_minor": 19900, "currency": "ZAR",
              "paid_at": "2026-09-02T16:00:00Z",
              "entitlement": {"kind": "service", "service": "rescue-readiness-pack"}}}

    def tearDown(self):
        self.temp.cleanup()

    def test_exact_event_creates_one_entitlement_and_duplicate_is_safe(self):
        value = service.validate(self.value)
        self.assertEqual(service.record(value, self.db)["outcome"], "created")
        self.assertEqual(service.record(value, self.db)["outcome"], "duplicate")
        with service.connect(self.db) as db:
            self.assertEqual(db.execute("select count(*) from payment_events").fetchone()[0], 1)
            self.assertEqual(db.execute("select count(*) from service_entitlements").fetchone()[0], 1)

    def test_wrong_amount_is_rejected(self):
        self.value["order"]["amount_minor"] = 9900
        with self.assertRaisesRegex(ValueError, "settlement"):
            service.validate(self.value)

    def test_signature_and_replay_window(self):
        raw = json.dumps(self.value, separators=(",", ":"), sort_keys=True).encode()
        secret = "ci-owner-callback-secret-0123456789"
        ts = "1788364800"
        sig = hmac.new(secret.encode(), ts.encode() + b"." + raw, hashlib.sha256).hexdigest()
        service.verify_signature(raw, ts, sig, secret, now=1788364800)
        with self.assertRaises(PermissionError):
            service.verify_signature(raw, ts, "0" * 64, secret, now=1788364800)
        with self.assertRaises(PermissionError):
            service.verify_signature(raw, ts, sig, secret, now=1788365401)

    def test_same_event_id_with_changed_payload_is_rejected(self):
        service.record(service.validate(self.value), self.db)
        self.value["order"]["bank_reference"] = "CHANGED"
        with self.assertRaisesRegex(ValueError, "mismatch"):
            service.record(service.validate(self.value), self.db)


if __name__ == "__main__":
    unittest.main()
