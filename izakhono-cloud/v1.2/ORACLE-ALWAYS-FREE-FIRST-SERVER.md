# First live staging server — Oracle Cloud Always Free

Recommended bootstrap target when zero monthly infrastructure cost is the priority:

- Image: Ubuntu 24.04
- Shape: VM.Standard.A1.Flex (Arm), Always Free eligible
- Allocate: 2 OCPUs, 8–12 GB RAM if the tenancy allows it
- Boot volume: 50–80 GB within the Always Free block-volume allowance
- Public IPv4: enabled
- SSH: public-key authentication
- Ingress: TCP 22, 80, 443

After the VM exists, run the v1.2 bootstrap. It detects the IP, creates an sslip.io staging hostname, installs Docker, starts IZAKHONO CLOUD and prints the Owner Console URL.

Do not enable customer billing on this staging host until backup/restore and live deployment/rollback tests pass.
