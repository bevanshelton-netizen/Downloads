KORA — IZAKHONO ISN-01 PRIVATE BETA

Safety boundary
- Runs only at http://127.0.0.1:18107 on ISN-01.
- Does not change public DNS or customer traffic.
- Forces PayFast sandbox mode and disables live checkout approvals.
- Does not use or deploy to Vercel.

Before starting
1. Run START-IZAKHONO-ENGINE-ISN-01.cmd and confirm its proof passes.
2. Confirm C:\ProgramData\IZAKHONO\ISN-01\KORA.env contains the approved KORA runtime values.
3. Keep all four files from this release in the same folder.

Start
Double-click START-KORA-PRIVATE-BETA-OFFLINE.cmd and approve the Administrator prompt.

Success
The installer prints "KORA IZAKHONO PRIVATE BETA: VERIFIED".
Open http://127.0.0.1:18107 on ISN-01.
The signed-off receipt is stored at:
C:\ProgramData\IZAKHONO\ISN-01\KORA-CUTOVER.json
