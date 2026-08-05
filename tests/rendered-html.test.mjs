import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const htmlPreview = /<title>Echoes of Alderwood<\/title>/i;

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
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

test("server-renders the Alderwood game shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, htmlPreview);
  assert.match(html, /Echoes of Alderwood/);
  assert.match(html, /game-mount/);
  assert.doesNotMatch(html, /react-loading-skeleton/);
  assert.doesNotMatch(html, /codex-preview/);
});

test("keeps the standalone asset entrypoint available", async () => {
  const [index, styles, game, player, world, quests, dialogue, saveSystem, avatarEditor] =
    await Promise.all([
      readFile(new URL("../index.html", import.meta.url), "utf8"),
      readFile(new URL("../styles.css", import.meta.url), "utf8"),
      readFile(new URL("../game.js", import.meta.url), "utf8"),
      readFile(new URL("../player.js", import.meta.url), "utf8"),
      readFile(new URL("../world.js", import.meta.url), "utf8"),
      readFile(new URL("../quests.js", import.meta.url), "utf8"),
      readFile(new URL("../dialogue.js", import.meta.url), "utf8"),
      readFile(new URL("../save-system.js", import.meta.url), "utf8"),
      readFile(new URL("../avatar-editor.js", import.meta.url), "utf8"),
    ]);

  assert.match(index, /Echoes of Alderwood/);
  assert.match(index, /type="module"/);
  assert.match(styles, /image-rendering:\s*pixelated/);
  assert.match(game, /startGame/);
  assert.match(player, /drawAvatar/);
  assert.match(world, /CHAPTERS/);
  assert.match(quests, /brokenLantern/);
  assert.match(dialogue, /foxIntro/);
  assert.match(saveSystem, /saveAutosave/);
  assert.match(avatarEditor, /openAvatarEditor/);
});
