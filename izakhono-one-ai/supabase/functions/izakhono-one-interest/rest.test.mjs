import assert from "node:assert/strict";
import test from "node:test";
import { countRows, SupabaseRestError } from "./rest.mjs";

test("countRows uses GET, exact count and a one-row range without exposing row data", async () => {
  let captured;
  const count = await countRows({
    baseUrl: "https://example.supabase.co/",
    serviceRoleKey: "test-service-role-key",
    table: "one_launch_interest",
    filters: { status: "neq.unsubscribed" },
    fetchImpl: async (url, init) => {
      captured = { url: new URL(url), init };
      return new Response(JSON.stringify([{ id: "not-returned-to-caller" }]), {
        status: 206,
        headers: { "content-range": "0-0/17" },
      });
    },
  });
  assert.equal(count, 17);
  assert.equal(captured.init.method, "GET");
  assert.equal(captured.url.pathname, "/rest/v1/one_launch_interest");
  assert.equal(captured.url.searchParams.get("select"), "id");
  assert.equal(captured.url.searchParams.get("status"), "neq.unsubscribed");
  assert.equal(captured.init.headers.get("Prefer"), "count=exact");
  assert.equal(captured.init.headers.get("Range"), "0-0");
  assert.equal(captured.init.headers.get("Accept-Profile"), "public");
  assert.equal(captured.init.headers.get("Authorization"), "Bearer test-service-role-key");
  assert.equal(captured.init.headers.get("apikey"), "test-service-role-key");
});

test("countRows correctly parses an empty table", async () => {
  const count = await countRows({
    baseUrl: "https://example.supabase.co",
    serviceRoleKey: "test-key",
    table: "one_pilot_feedback",
    fetchImpl: async () => new Response("[]", {
      status: 200,
      headers: { "content-range": "*/0" },
    }),
  });
  assert.equal(count, 0);
});

test("countRows returns bounded HTTP error evidence without leaking credentials", async () => {
  await assert.rejects(
    countRows({
      baseUrl: "https://example.supabase.co",
      serviceRoleKey: "do-not-log-this-key",
      table: "one_launch_interest",
      fetchImpl: async () => new Response(JSON.stringify({ code: "PGRST106", message: "schema not exposed" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      }),
    }),
    error => error instanceof SupabaseRestError
      && error.status === 404
      && error.code === "PGRST106"
      && !error.message.includes("do-not-log-this-key")
      && error.body.includes("schema not exposed"),
  );
});

test("countRows wraps network failures without exposing the service role key", async () => {
  await assert.rejects(
    countRows({
      baseUrl: "https://example.supabase.co",
      serviceRoleKey: "do-not-log-this-key",
      table: "one_launch_interest",
      fetchImpl: async () => { throw new TypeError("fetch failed"); },
    }),
    error => error instanceof SupabaseRestError
      && error.cause instanceof TypeError
      && !error.message.includes("do-not-log-this-key"),
  );
});

test("countRows rejects unsafe table names and filters", async () => {
  await assert.rejects(countRows({
    baseUrl: "https://example.supabase.co",
    serviceRoleKey: "test-key",
    table: "one_launch_interest;drop table users",
  }), error => error instanceof SupabaseRestError && error.message === "Invalid Supabase REST table name");
  await assert.rejects(countRows({
    baseUrl: "https://example.supabase.co",
    serviceRoleKey: "test-key",
    table: "one_launch_interest",
    filters: { "status;drop": "neq.unsubscribed" },
  }), error => error instanceof SupabaseRestError);
});
