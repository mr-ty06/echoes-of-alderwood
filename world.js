export const TILE = 16;

export const CHAPTERS = [
  {
    id: 1,
    title: "The Silent Village",
    summary:
      "Wake in Alderwood, meet the fox companion, learn the controls, and restore the first broken lantern.",
  },
  {
    id: 2,
    title: "The Whispering Forest",
    summary:
      "Help forest creatures, solve environmental puzzles, and decide whether to trust the travelling merchant.",
  },
  {
    id: 3,
    title: "The Sunken Ruins",
    summary:
      "Explore an underground civilisation and discover the first proof that the disaster was not accidental.",
  },
  {
    id: 4,
    title: "The Ashen Kingdom",
    summary:
      "Enter the ruined city, face the corrupted guardian, and choose between fighting, forgiving, or helping.",
  },
  {
    id: 5,
    title: "The Final Light",
    summary:
      "Learn the truth behind the missing memories and decide which ending Alderwood deserves.",
  },
];

function grid(width, height, fill = "grass") {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => fill));
}

function paintRect(scene, x, y, w, h, tile) {
  for (let py = y; py < y + h; py += 1) {
    if (py < 0 || py >= scene.height) continue;
    for (let px = x; px < x + w; px += 1) {
      if (px < 0 || px >= scene.width) continue;
      scene.tiles[py][px] = tile;
    }
  }
}

function paintLine(scene, x1, y1, x2, y2, tile, thickness = 1) {
  const dx = Math.sign(x2 - x1);
  const dy = Math.sign(y2 - y1);
  let x = x1;
  let y = y1;
  while (x !== x2 || y !== y2) {
    paintRect(scene, x - Math.floor(thickness / 2), y - Math.floor(thickness / 2), thickness, thickness, tile);
    if (x !== x2) x += dx;
    if (y !== y2) y += dy;
  }
  paintRect(scene, x2 - Math.floor(thickness / 2), y2 - Math.floor(thickness / 2), thickness, thickness, tile);
}

function fillPerimeter(scene, tile = "hedge") {
  paintRect(scene, 0, 0, scene.width, 1, tile);
  paintRect(scene, 0, scene.height - 1, scene.width, 1, tile);
  paintRect(scene, 0, 0, 1, scene.height, tile);
  paintRect(scene, scene.width - 1, 0, 1, scene.height, tile);
}

function makeScene(id, name, width, height, ambient, music) {
  return {
    id,
    name,
    width,
    height,
    ambience: ambient,
    music,
    tiles: grid(width, height),
    props: [],
    npcs: [],
    interactables: [],
    exits: [],
    weather: "clear",
    palette: "day",
  };
}

function villageScene() {
  const scene = makeScene(
    "village",
    "Alderwood Village",
    52,
    34,
    "birds, shutters, and a gentle wind",
    "Lantern Lullaby",
  );

  fillPerimeter(scene, "tree");
  paintRect(scene, 0, 20, 52, 14, "grass");
  paintLine(scene, 2, 22, 45, 22, "path", 2);
  paintLine(scene, 8, 20, 8, 10, "path", 2);
  paintLine(scene, 18, 22, 18, 12, "path", 2);
  paintLine(scene, 33, 22, 33, 10, "path", 2);
  paintLine(scene, 43, 22, 47, 22, "path", 2);

  // Houses and village landmarks.
  paintRect(scene, 4, 10, 6, 4, "floor");
  paintRect(scene, 3, 9, 8, 1, "roof");
  paintRect(scene, 15, 9, 7, 5, "floor");
  paintRect(scene, 14, 8, 9, 1, "roof");
  paintRect(scene, 29, 8, 7, 5, "floor");
  paintRect(scene, 28, 7, 9, 1, "roof");
  paintRect(scene, 41, 10, 7, 5, "forge");
  paintRect(scene, 40, 9, 9, 1, "roof");
  paintRect(scene, 11, 23, 9, 7, "floor");
  paintRect(scene, 10, 22, 11, 1, "roof");
  paintRect(scene, 23, 24, 8, 6, "floor");
  paintRect(scene, 22, 23, 10, 1, "roof");

  paintRect(scene, 24, 18, 5, 5, "lantern");
  paintRect(scene, 24, 17, 5, 1, "stone");
  paintRect(scene, 26, 16, 1, 1, "fire");

  paintRect(scene, 45, 5, 3, 3, "cart");
  paintRect(scene, 36, 24, 5, 4, "flower");
  paintRect(scene, 6, 26, 3, 3, "well");
  paintRect(scene, 37, 17, 3, 3, "flower");
  paintRect(scene, 13, 15, 2, 2, "flower");
  paintRect(scene, 21, 14, 2, 2, "flower");

  // Trees and hedges keep the village feeling tucked away.
  paintRect(scene, 1, 3, 2, 3, "tree");
  paintRect(scene, 48, 3, 2, 3, "tree");
  paintRect(scene, 5, 4, 3, 3, "tree");
  paintRect(scene, 40, 4, 4, 3, "tree");
  paintRect(scene, 4, 29, 4, 3, "tree");
  paintRect(scene, 43, 28, 4, 4, "tree");

  scene.npcs = [
    { id: "fox", name: "Ember", kind: "fox", x: 7, y: 18, facing: "left", scene: "village" },
    { id: "elder", name: "Elder Rowan", kind: "elder", x: 18, y: 14, facing: "down", scene: "village" },
    { id: "baker", name: "Tilda", kind: "baker", x: 12, y: 27, facing: "right", scene: "village" },
    { id: "smith", name: "Brann", kind: "smith", x: 44, y: 14, facing: "left", scene: "village" },
    { id: "herbalist", name: "Nia", kind: "herbalist", x: 31, y: 12, facing: "down", scene: "village" },
    { id: "merchant", name: "Moss Vale", kind: "merchant", x: 45, y: 7, facing: "down", scene: "village" },
    { id: "child", name: "Pip", kind: "child", x: 27, y: 27, facing: "up", scene: "village" },
  ];

  scene.interactables = [
    { id: "home-door", type: "door", x: 14, y: 28, w: 2, h: 1, target: "home", spawn: { x: 9, y: 8 }, label: "your home" },
    { id: "forest-gate", type: "door", x: 25, y: 2, w: 2, h: 1, target: "forest", spawn: { x: 23, y: 28 }, label: "the whispering forest" },
    { id: "western-road", type: "locked", x: 49, y: 19, w: 2, h: 2, label: "ruined road", requirement: "chapter2" },
    { id: "lantern", type: "lantern", x: 26, y: 18, w: 1, h: 2, label: "the village lantern" },
    { id: "wardrobe", type: "wardrobe", x: 15, y: 26, w: 1, h: 1, label: "wardrobe mirror" },
    { id: "well", type: "puzzle", x: 7, y: 27, w: 2, h: 2, label: "old well" },
    { id: "merchant-cart", type: "merchant", x: 46, y: 5, w: 3, h: 3, label: "travelling merchant" },
    { id: "flour-sack-a", type: "item", item: "flour sack", x: 10, y: 25, w: 1, h: 1, quest: "breadline" },
    { id: "flour-sack-b", type: "item", item: "flour sack", x: 20, y: 25, w: 1, h: 1, quest: "breadline" },
    { id: "tea-herbs", type: "item", item: "tea herbs", x: 32, y: 13, w: 1, h: 1, quest: "forest-friends" },
  ];

  scene.exits = [
    { id: "home", x: 14, y: 29, w: 2, h: 1, target: "home", spawn: { x: 9, y: 8 } },
    { id: "forest", x: 25, y: 2, w: 2, h: 1, target: "forest", spawn: { x: 23, y: 28 } },
  ];

  return scene;
}

function homeScene() {
  const scene = makeScene("home", "Foxglove House", 24, 18, "embers in the hearth", "Memory Room");

  paintRect(scene, 0, 0, 24, 18, "floor");
  paintRect(scene, 0, 0, 24, 1, "wall");
  paintRect(scene, 0, 17, 24, 1, "wall");
  paintRect(scene, 0, 0, 1, 18, "wall");
  paintRect(scene, 23, 0, 1, 18, "wall");
  paintRect(scene, 7, 3, 4, 2, "bed");
  paintRect(scene, 16, 4, 4, 2, "table");
  paintRect(scene, 4, 12, 3, 2, "rug");
  paintRect(scene, 14, 10, 2, 3, "mirror");
  paintRect(scene, 5, 6, 2, 2, "crate");
  paintRect(scene, 9, 13, 3, 1, "loose");
  paintRect(scene, 10, 2, 2, 1, "attic");
  paintRect(scene, 12, 16, 2, 1, "door");
  paintRect(scene, 2, 2, 3, 3, "books");
  paintRect(scene, 18, 11, 3, 3, "shelf");

  scene.npcs = [
    { id: "fox", name: "Ember", kind: "fox", x: 13, y: 11, facing: "right", scene: "home" },
  ];

  scene.interactables = [
    { id: "home-door", type: "door", x: 12, y: 16, w: 2, h: 1, target: "village", spawn: { x: 14, y: 27 }, label: "the village" },
    { id: "mirror", type: "wardrobe", x: 14, y: 10, w: 2, h: 3, label: "mirror and wardrobe" },
    { id: "attic", type: "secret", x: 10, y: 2, w: 2, h: 1, label: "attic hatch" },
    { id: "loose-board", type: "secret-item", x: 9, y: 13, w: 3, h: 1, item: "moon thread", label: "loose floorboard" },
  ];

  scene.exits = [{ id: "village", x: 12, y: 16, w: 2, h: 1, target: "village", spawn: { x: 14, y: 27 } }];
  return scene;
}

function forestScene() {
  const scene = makeScene(
    "forest",
    "The Whispering Forest",
    40,
    30,
    "fog among the pines and leaves overhead",
    "Whispers in Moss",
  );

  fillPerimeter(scene, "tree");
  paintRect(scene, 0, 0, 40, 30, "grass");
  paintLine(scene, 23, 28, 23, 6, "path", 2);
  paintLine(scene, 11, 18, 31, 18, "path", 2);
  paintRect(scene, 7, 8, 4, 4, "pond");
  paintRect(scene, 30, 8, 5, 4, "pond");
  paintRect(scene, 16, 9, 4, 4, "stones");
  paintRect(scene, 18, 12, 1, 1, "rune");
  paintRect(scene, 19, 10, 1, 1, "rune");
  paintRect(scene, 20, 12, 1, 1, "rune");
  paintRect(scene, 31, 17, 4, 4, "cave");
  paintRect(scene, 7, 22, 5, 4, "grove");
  paintRect(scene, 8, 23, 3, 2, "spirit");
  paintRect(scene, 2, 21, 3, 2, "flowers");
  paintRect(scene, 35, 21, 3, 2, "flowers");
  paintRect(scene, 9, 4, 4, 4, "tree");
  paintRect(scene, 24, 4, 4, 4, "tree");
  paintRect(scene, 32, 5, 4, 4, "tree");

  // Corrupted wisp zone.
  paintRect(scene, 33, 19, 2, 2, "corruption");
  paintRect(scene, 21, 8, 1, 1, "clue");
  paintRect(scene, 12, 25, 2, 2, "shard");

  scene.npcs = [
    { id: "deer", name: "Sprig Deer", kind: "spirit", x: 10, y: 24, facing: "right", scene: "forest" },
    { id: "merchant", name: "Moss Vale", kind: "merchant", x: 26, y: 19, facing: "left", scene: "forest" },
  ];

  scene.interactables = [
    { id: "forest-exit", type: "door", x: 22, y: 29, w: 2, h: 1, target: "village", spawn: { x: 25, y: 4 }, label: "the village" },
    { id: "rune-1", type: "puzzle", x: 18, y: 12, w: 1, h: 1, label: "rune stone 1", puzzle: "forest-runes", index: 0 },
    { id: "rune-2", type: "puzzle", x: 19, y: 10, w: 1, h: 1, label: "rune stone 2", puzzle: "forest-runes", index: 1 },
    { id: "rune-3", type: "puzzle", x: 20, y: 12, w: 1, h: 1, label: "rune stone 3", puzzle: "forest-runes", index: 2 },
    { id: "cave", type: "combat", x: 31, y: 17, w: 4, h: 4, label: "corrupted cave", enemy: "wisp" },
    { id: "hidden-grove", type: "secret-item", x: 7, y: 22, w: 5, h: 4, item: "forest charm", label: "hidden grove" },
    { id: "hammer", type: "item", item: "smith hammer", x: 32, y: 24, w: 1, h: 1, quest: "smith-hammer" },
    { id: "lantern-shard", type: "item", item: "lantern shard", x: 12, y: 25, w: 2, h: 2, quest: "broken-lantern" },
  ];

  scene.exits = [{ id: "village", x: 22, y: 29, w: 2, h: 1, target: "village", spawn: { x: 25, y: 4 } }];
  return scene;
}

export const SCENES = {
  home: homeScene(),
  village: villageScene(),
  forest: forestScene(),
};

export function createWorld() {
  return {
    chapters: CHAPTERS,
    scenes: SCENES,
    startScene: "home",
    storyFlags: {
      chapter: 1,
      lanternRestored: false,
      merchantTrusted: false,
      guardianMercy: false,
      memorySacrificed: false,
      corruptionTamed: false,
      newGamePlusUnlocked: false,
    },
  };
}

export function getScene(sceneId) {
  return SCENES[sceneId] ?? SCENES.home;
}

export function isSolidTile(tile) {
  return [
    "tree",
    "hedge",
    "roof",
    "wall",
    "pond",
    "cave",
    "door",
    "forge",
    "lantern",
    "table",
    "bed",
    "mirror",
    "crate",
    "shelf",
    "books",
    "rune",
    "corruption",
  ].includes(tile);
}

export function tileAt(scene, x, y) {
  if (!scene) return "void";
  if (x < 0 || y < 0 || x >= scene.width || y >= scene.height) return "void";
  return scene.tiles[y][x];
}

export function sceneMusic(sceneId) {
  return getScene(sceneId).music;
}

