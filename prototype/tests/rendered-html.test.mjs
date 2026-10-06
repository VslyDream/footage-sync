import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("https://prototype.example/", {
      headers: { accept: "text/html", host: "prototype.example" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Footage Sync prototype", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Footage Sync — Premiere UI Prototype<\/title>/i);
  assert.match(html, /Interactive prototype/);
  assert.match(html, /Main panel/);
  assert.match(html, /Link existing bin/);
  assert.match(html, /Create matching bins/);
  assert.match(html, /Links window/);
  assert.match(html, /Status window/);
  assert.doesNotMatch(html, /Settings window/);
  assert.match(html, /Initial sync/);
  assert.match(html, /Review changes/);
  assert.match(html, /https:\/\/prototype\.example\/og-v3\.png/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});
