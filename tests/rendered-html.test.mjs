import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { dialogueIdForNpc, findNearbyNpc, shouldPreferNpcInteraction } from "../interaction.js";
import { calculateViewport, createCamera, positionCamera } from "../viewport.js";

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
  const [index, styles, game, player, world, quests, dialogue, saveSystem, avatarEditor, viewport, interaction] =
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
      readFile(new URL("../viewport.js", import.meta.url), "utf8"),
      readFile(new URL("../interaction.js", import.meta.url), "utf8"),
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
  assert.match(viewport, /calculateViewport/);
  assert.match(viewport, /positionCamera/);
  assert.match(interaction, /findNearbyNpc/);
});

test("selects the nearest visible NPC and maps it to dialogue", () => {
  const player = { x: 10, y: 10 };
  const npc = findNearbyNpc(player, [
    { id: "baker", name: "Tilda", x: 11.6, y: 10 },
    { id: "elder", name: "Elder Rowan", x: 11, y: 10 },
    { id: "smith", name: "Brann", x: 10.5, y: 10, hidden: true },
  ]);

  assert.equal(npc?.id, "elder");
  assert.equal(dialogueIdForNpc(npc), "elderRowan");
  assert.equal(dialogueIdForNpc({ id: "fox" }), "foxIntro");
});

test("prefers NPC chat unless the player is directly using a prop", () => {
  const player = { x: 10, y: 10 };
  const npc = { id: "herbalist", x: 11, y: 10 };

  assert.equal(shouldPreferNpcInteraction(player, npc, null), true);
  assert.equal(
    shouldPreferNpcInteraction(player, npc, { type: "item", x: 10, y: 10, w: 1, h: 1 }),
    false,
  );
  assert.equal(
    shouldPreferNpcInteraction(player, npc, { type: "item", x: 11, y: 10, w: 1, h: 1 }),
    true,
  );
  assert.equal(
    shouldPreferNpcInteraction(player, npc, { type: "door", x: 12, y: 10, w: 1, h: 2 }),
    false,
  );
});

test("calculates an integer-scaled canvas without distorting its logical viewport", () => {
  const desktop = calculateViewport(1400, 700, 2);
  assert.deepEqual(
    {
      css: [desktop.cssWidth, desktop.cssHeight],
      buffer: [desktop.bufferWidth, desktop.bufferHeight],
      logical: [desktop.logicalWidth, desktop.logicalHeight],
      scale: desktop.renderScale,
    },
    {
      css: [1400, 700],
      buffer: [1400, 700],
      logical: [700, 350],
      scale: 2,
    },
  );

  const mobile = calculateViewport(390, 600, 3);
  assert.equal(mobile.renderScale, 1);
  assert.deepEqual([mobile.logicalWidth, mobile.logicalHeight], [390, 600]);
  assert.deepEqual([mobile.bufferWidth, mobile.bufferHeight], [780, 1200]);
});

test("centres small maps and clamps large maps", () => {
  const camera = createCamera();
  camera.viewportWidth = 700;
  camera.viewportHeight = 350;

  positionCamera(camera, { x: 144, y: 128, width: 16, height: 16 }, 384, 288, {
    immediate: true,
  });
  assert.deepEqual([camera.x, camera.y], [-158, -31]);

  positionCamera(camera, { x: 700, y: 400, width: 16, height: 16 }, 832, 544, {
    immediate: true,
  });
  assert.deepEqual([camera.x, camera.y], [132, 194]);
});
