import importlib.util
import json
import os
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("portfolio_watch", HERE / "app.py")
watch = importlib.util.module_from_spec(spec)
spec.loader.exec_module(watch)

class PortfolioWatchTests(unittest.TestCase):
    def test_clean_html_removes_script_and_markup(self):
        raw = "<html><script>secret()</script><body><h1>New AI plan</h1><p>$10 / month</p></body></html>"
        clean = watch.clean_html(raw)
        self.assertIn("New AI plan", clean)
        self.assertIn("$10 / month", clean)
        self.assertNotIn("secret()", clean)

    def test_extract_signal_keeps_material_terms_and_prices(self):
        text = "Welcome. We launched a new AI assistant for small business teams. Premium is $12 / month. Footer text."
        signal, prices = watch.extract_signal(text, ["launch", "ai", "small business", "pricing"])
        self.assertIn("AI assistant", signal)
        self.assertTrue(any("$12" in p for p in prices))

    def test_pricing_change_is_meaningful(self):
        old = "Premium plan costs $10 / month."
        new = "Premium plan costs $12 / month and includes a new AI assistant."
        score, labels, added, removed, prices, meaningful = watch.classify_change(
            old, new, ["$10 / month"], ["$12 / month"], {"alert_threshold": 4}
        )
        self.assertTrue(meaningful)
        self.assertIn("pricing", labels)
        self.assertIn("ai", labels)
        self.assertGreaterEqual(score, 4)

    def test_registry_has_broad_portfolio_coverage(self):
        registry = json.loads((HERE / "portfolio.json").read_text(encoding="utf-8"))
        ids = {p["id"] for p in registry["platforms"]}
        required = {
            "creative-suite", "kora-network", "allegro-vibez", "edu-build",
            "faisready", "doxa-sure", "auto-ai", "worknow", "fortress",
            "connecta", "izakhono-one-ai", "izakhono-cloud", "izakhono-send",
            "blockchain-academy", "izakhono-os"
        }
        self.assertTrue(required.issubset(ids))
        self.assertGreaterEqual(len(ids), 40)
        self.assertTrue(registry.get("inherit_future_platforms"))

    def test_every_platform_has_sources(self):
        registry = json.loads((HERE / "portfolio.json").read_text(encoding="utf-8"))
        for platform in registry["platforms"]:
            self.assertTrue(platform.get("sources"), platform["id"])
            for source in platform["sources"]:
                self.assertTrue(source["url"].startswith(("https://", "http://")))

if __name__ == "__main__":
    unittest.main()
