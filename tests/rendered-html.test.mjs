import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    {
      ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the weekly challenge tracker", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>FIVE\/WEEK — Armon vs Victor<\/title>/i);
  assert.match(html, /Five good problems/);
  assert.match(html, /Five each week keeps the streak alive/);
  assert.match(html, /Weekly score/i);
  assert.match(html, /Assignment log/);
  assert.match(html, /Streak watch/i);
  assert.match(html, /first person to miss while the other finishes loses/i);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/i);
});

test("shared tracker replaces the starter preview", async () => {
  const [page, layout, packageJson, apiRoute, hosting] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../app/api/challenge/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /FIVE\/WEEK/);
  assert.match(layout, /Armon vs Victor/);
  assert.match(apiRoute, /challenge_settings/);
  assert.match(hosting, /"d1": "DB"/);
  assert.doesNotMatch(page, /localStorage/);
  assert.doesNotMatch(page, /SkeletonPreview|codex-preview/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await assert.rejects(access(new URL("app/_sites-preview", templateRoot)));
});
