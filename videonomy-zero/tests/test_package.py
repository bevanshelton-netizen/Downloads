import json, sqlite3, unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

class PackageTests(unittest.TestCase):
    def test_schema_applies_and_seed_exists(self):
        db=sqlite3.connect(':memory:')
        
        for migration in sorted((ROOT/'migrations').glob('*.sql')):
            db.executescript(migration.read_text())
        row=db.execute("select slug,status from platforms where slug='videonomy'").fetchone()
        self.assertEqual(row, ('videonomy','beta'))
        tables={r[0] for r in db.execute("select name from sqlite_master where type='table'")}
        for name in ['leads','creator_invites','creators','sessions','videos','viewer_sessions','watch_sessions','ledger_entries','rate_limits','audit_log','commerce_packages','payment_intents','data_requests','content_reports','email_jobs']:
            self.assertIn(name,tables)


    def test_commerce_packages_and_payfast_adapter(self):
        db=sqlite3.connect(':memory:')
        for migration in sorted((ROOT/'migrations').glob('*.sql')):
            db.executescript(migration.read_text())
        pkgs=db.execute("select code,amount_minor,currency from commerce_packages order by amount_minor").fetchall()
        self.assertEqual(pkgs, [('VZ-LAUNCH-1500',150000,'ZAR'),('VZ-GROW-5000',500000,'ZAR'),('VZ-FOUNDING-12500',1250000,'ZAR')])
        pay=(ROOT/'src/payfast.ts').read_text()
        for needle in ['md5Ascii','signPayFast','validatePayFastItn','invalid_source_ip','amount_mismatch','eng/query/validate']:
            self.assertIn(needle,pay)
        src=(ROOT/'src/index.ts').read_text()
        for needle in ['/api/commerce/payment-intents','/api/payfast/itn','payment_receipt','/api/data-requests','/api/reports']:
            self.assertIn(needle,src)

    def test_cloudflare_auto_provision_config_has_no_account_placeholders(self):
        raw=(ROOT/'wrangler.jsonc').read_text()
        cfg=json.loads(raw)
        self.assertEqual(cfg['d1_databases'][0], {'binding':'DB','migrations_dir':'migrations'})
        self.assertEqual(cfg['r2_buckets'][0], {'binding':'MEDIA'})
        self.assertNotIn('REPLACE_', raw)

    def test_security_controls_present(self):
        src=(ROOT/'src/index.ts').read_text()
        self.assertNotIn("'access-control-allow-origin': '*'",src)
        for needle in ['HttpOnly','SameSite=Lax','ABUSE_SALT','rate_limits','x-admin-secret','x-upload-bytes','QUALIFIED_SECONDS = 30','elapsed + 2']:
            self.assertIn(needle,src)
        for secret in ['ADMIN_SECRET=', 'ABUSE_SALT=']:
            for html in (ROOT/'public').rglob('*.html'):
                self.assertNotIn(secret,html.read_text())

    def test_operational_surfaces_exist(self):
        for rel in ['public/index.html','public/admin/index.html','public/creator/index.html','public/privacy.html','public/terms.html','public/creator-terms.html','public/community.html','scripts/bootstrap.sh','docs/LAUNCH-RUNBOOK.md']:
            self.assertTrue((ROOT/rel).exists(),rel)
        public=(ROOT/'public/index.html').read_text()
        self.assertIn('R1,500',public); self.assertIn('R5,000',public); self.assertIn('R12,500',public)
        self.assertIn('/api/videos?platform=videonomy',public)

    def test_bootstrap_limits_are_explicit(self):
        src=(ROOT/'src/index.ts').read_text()
        self.assertIn('90 * 1024 * 1024',src)
        self.assertIn('8 * 1024 * 1024 * 1024',src)
        self.assertIn('Bootstrap media capacity is full',src)
        self.assertIn('LEADS_PER_IP_DAY = 10',src)
        self.assertIn('LEADS_PER_EMAIL_DAY = 5',src)
        terms=(ROOT/'public/terms.html').read_text()
        self.assertIn('do not guarantee',terms.lower())

if __name__=='__main__': unittest.main()
