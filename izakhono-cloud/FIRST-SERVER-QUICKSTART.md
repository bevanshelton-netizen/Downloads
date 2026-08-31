# IZAKHONO CLOUD v1.4 — First Server Quickstart

For an Ubuntu 24.04 host with Docker capability and a public IPv4 address:

1. Permit inbound TCP 80 and 443. Permit SSH 22 only when remote administration is required.
2. Preferred: use `cloud-init.yaml` as the VM's user-data during creation.
3. Otherwise, after signing in to the host, run the immutable installer:

```bash
curl -fsSL https://raw.githubusercontent.com/bevanshelton-netizen/Downloads/0cb1db194926ea5d6e9e40ba2ce8eb806aac2e0d/izakhono-cloud/install-first-server.sh | sudo bash
```

The installer pins release payload commit `e25d56c37116cebca639c6d0cbf5f72b92bb301c` and verifies SHA-256 `3df20c679d0ce8956ccfba7f4deb7528e221b9f112a2ceb238a22b045e9d939f` before installation.

Check the result:

```bash
sudo /opt/izakhono-cloud/check-first-server.sh
```

A successful installation records `/var/lib/izakhono-cloud/READY`. A failed proof records `/var/lib/izakhono-cloud/FAILED`; it does not promote the server as ready. Owner credentials are copied root-only to `/root/izakhono-owner-credentials`.

Do not market IZAKHONO CLOUD as commercially live until the first real host records READY and the public HTTPS endpoints are independently verified.
