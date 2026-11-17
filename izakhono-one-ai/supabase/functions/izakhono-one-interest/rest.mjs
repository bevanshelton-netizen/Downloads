export class SupabaseRestError extends Error {
  constructor(message, { status = null, code = null, body = null, cause = null } = {}) {
    super(message);
    this.name = "SupabaseRestError";
    this.status = status;
    this.code = code;
    this.body = body;
    this.cause = cause;
  }
}

/**
 * @param {{
 *   baseUrl: string,
 *   serviceRoleKey: string,
 *   table: string,
 *   filters?: Record<string, string>,
 *   fetchImpl?: typeof fetch,
 *   timeoutMs?: number
 * }} options
 * @returns {Promise<number>}
 */
export async function countRows({
  baseUrl,
  serviceRoleKey,
  table,
  filters = {},
  fetchImpl = fetch,
  timeoutMs = 10000,
} = {}) {
  if (typeof baseUrl !== "string" || !baseUrl.trim()
    || typeof serviceRoleKey !== "string" || !serviceRoleKey.trim()) {
    throw new SupabaseRestError("Supabase REST configuration is missing");
  }
  if (typeof table !== "string" || !/^[a-z_][a-z0-9_]*$/i.test(table)) {
    throw new SupabaseRestError("Invalid Supabase REST table name");
  }

  const endpoint = new URL(`${baseUrl.replace(/\/+$/, "")}/rest/v1/${table}`);
  endpoint.searchParams.set("select", "id");
  for (const [key, value] of Object.entries(filters)) {
    if (!/^[a-z_][a-z0-9_]*$/i.test(key) || typeof value !== "string") {
      throw new SupabaseRestError("Invalid Supabase REST filter");
    }
    endpoint.searchParams.set(key, value);
  }

  const headers = new Headers({
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    Accept: "application/json",
    "Accept-Profile": "public",
    Prefer: "count=exact",
    Range: "0-0",
  });

  let response;
  try {
    response = await fetchImpl(endpoint.toString(), {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (cause) {
    throw new SupabaseRestError(`Supabase REST count request failed for ${table}`, { cause });
  }

  const responseBody = await response.text();
  if (!response.ok) {
    let parsed = null;
    try { parsed = JSON.parse(responseBody); } catch {}
    throw new SupabaseRestError(
      `Supabase REST count request failed for ${table} (HTTP ${response.status})`,
      {
        status: response.status,
        code: response.headers.get("sb-error-code") || parsed?.code || null,
        body: responseBody.slice(0, 400),
      },
    );
  }

  const contentRange = response.headers.get("content-range") || "";
  const match = contentRange.match(/\/(\d+)$/);
  if (!match) {
    throw new SupabaseRestError(
      `Supabase REST count response for ${table} omitted a valid Content-Range`,
      { status: response.status, body: contentRange.slice(0, 120) },
    );
  }
  return Number(match[1]);
}
