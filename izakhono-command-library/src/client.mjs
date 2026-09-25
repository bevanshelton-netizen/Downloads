export class IzakhonoCommandClient {
  constructor({ baseUrl = "", fetchImpl = globalThis.fetch } = {}) {
    if (typeof fetchImpl !== "function") throw new Error("A fetch implementation is required.");
    this.baseUrl = String(baseUrl).replace(/\/$/, "");
    this.fetch = fetchImpl;
  }

  async list({ category } = {}) {
    const query = category ? `?category=${encodeURIComponent(category)}` : "";
    return this.#json(`/v1/commands${query}`);
  }

  async get(name) {
    return this.#json(`/v1/commands/${encodeURIComponent(String(name).replace(/^\//, ""))}`);
  }

  async expand(input, options = {}) {
    return this.#json("/v1/expand", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input,
        platform: options.platform,
        language: options.language,
        context: options.context
      })
    });
  }

  async health() {
    return this.#json("/healthz");
  }

  async #json(path, init) {
    const response = await this.fetch(`${this.baseUrl}${path}`, init);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.error || `Command Library request failed (${response.status}).`);
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  }
}
