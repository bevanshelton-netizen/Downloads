#!/usr/bin/env node
import { readFileSync } from "node:fs";

function fail(message) { throw new Error(message); }
function readEnv(path) {
  const values = {};
  for (const raw of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const at = line.indexOf("=");
    if (at > 0) values[line.slice(0, at).trim()] = line.slice(at + 1);
  }
  return values;
}
async function main() {
  const replica = readEnv("/etc/izakhono/replica-node.env");
  const peerConfig = readEnv("/etc/izakhono/node02-peer.env");
  const adminKey = replica.IZAKHONO_REPLICA_ADMIN_KEY;
  const baseUrl = peerConfig.NODE02_REPLICA_URL;
  const receiveKey = peerConfig.NODE02_REPLICA_RECEIVE_KEY;
  if (!adminKey || !baseUrl || !receiveKey) fail("NODE02_PEER_CONFIGURATION_INCOMPLETE");
  const url = new URL(baseUrl);
  if (url.protocol !== "https:" || url.pathname !== "/" || url.search || url.hash) fail("NODE02_PEER_URL_MUST_BE_HTTPS_ORIGIN");
  const canonicalBaseUrl = url.origin;
  const allowlist = (replica.IZAKHONO_REPLICA_TARGET_ALLOWLIST || "").split(",").map(x => x.trim().toLowerCase()).filter(Boolean);
  if (!allowlist.includes(url.hostname.toLowerCase())) fail("NODE02_HOST_NOT_IN_REPLICA_TARGET_ALLOWLIST");
  const health = await fetch(new URL("/health", url), { signal: AbortSignal.timeout(5000) });
  const healthBody = await health.json().catch(() => ({}));
  if (!health.ok || healthBody.status !== "healthy") fail("NODE02_RECEIVER_NOT_HEALTHY");

  const localBase = "http://" + (replica.HOST || "127.0.0.1") + ":" + (replica.PORT || "8890");
  const headers = { "x-izakhono-key": adminKey, "content-type": "application/json" };
  const existingResponse = await fetch(localBase + "/v1/peers", { headers, signal: AbortSignal.timeout(10000) });
  const existingBody = await existingResponse.json().catch(() => ({}));
  if (!existingResponse.ok) fail("LOCAL_REPLICA_PEER_LIST_FAILED");
  const existing = (existingBody.peers || []).find(x => x.name === "node02");
  if (existing) {
    if (existing.base_url !== canonicalBaseUrl || !existing.enabled) fail("NODE02_PEER_EXISTS_WITH_DIFFERENT_CONFIGURATION");
    process.stdout.write("NODE02_REPLICA_PEER=ALREADY_CONFIGURED\n");
    return;
  }

  const response = await fetch(localBase + "/v1/peers", {
    method: "POST",
    headers,
    body: JSON.stringify({ name: "node02", baseUrl: canonicalBaseUrl, receiveKey, enabled: true }),
    signal: AbortSignal.timeout(15000)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) fail("NODE02_PEER_CREATE_FAILED:" + response.status + ":" + (result.error || "unknown error"));
  process.stdout.write("NODE02_REPLICA_PEER=CONFIGURED\n");
}
main().catch(error => {
  process.stderr.write("[IZAKHONO NODE02 PEER] " + String(error.message || error) + "\n");
  process.exitCode = 1;
});
