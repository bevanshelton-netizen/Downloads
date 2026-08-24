# Controlled Beta Deployment Runbook

Launch sequence:
1. Internal smoke test with one owner/admin learner account.
2. Approve exactly one external beta learner.
3. Verify signup -> email verification -> invite approval -> consent -> Learning Passport -> paper practice -> signout/signin persistence.
4. Verify the external learner cannot access another learner's data.
5. Expand to five invited learners only after the first learner completes the journey without privacy/security defects.
6. Review support issues and behavioural-risk flags before further expansion.

Go/no-go conditions:
- all activation checks green;
- no privileged secrets exposed publicly;
- no cross-user access possible;
- all disclosures current;
- live execution/client funds/leverage/advice/broker connectivity remain disabled.

This beta is not a live trading launch.
