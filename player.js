const BODY_TYPES = [
  { id: "slim", label: "Slim", width: 12, height: 18, shoulder: 10 },
  { id: "steadfast", label: "Steadfast", width: 14, height: 19, shoulder: 12 },
  { id: "broad", label: "Broad", width: 16, height: 20, shoulder: 14 },
];

const SKIN_TONES = [
  { id: "porcelain", label: "Porcelain", value: "#f3d9cf", shadow: "#d1a89d" },
  { id: "olive", label: "Olive", value: "#d0a47b", shadow: "#996d4f" },
  { id: "honey", label: "Honey", value: "#c98c62", shadow: "#8a583d" },
  { id: "ember", label: "Ember", value: "#9f6549", shadow: "#6d402c" },
];

const HAIRSTYLES = [
  { id: "short", label: "Short", cap: "short" },
  { id: "messy", label: "Messy", cap: "messy" },
  { id: "braid", label: "Braid", cap: "braid" },
  { id: "cloak", label: "Cloak", cap: "cloak" },
  { id: "fox-tuft", label: "Fox Tuft", cap: "fox" },
];

const HAIR_COLORS = [
  { id: "chestnut", label: "Chestnut", value: "#6e412b", shade: "#482717" },
  { id: "copper", label: "Copper", value: "#b5643c", shade: "#7e4226" },
  { id: "moon", label: "Moon", value: "#cad1d9", shade: "#88919c" },
  { id: "midnight", label: "Midnight", value: "#2f3647", shade: "#1a1f2f" },
  { id: "fern", label: "Fern", value: "#4c6e58", shade: "#315141" },
];

const EYE_COLORS = [
  { id: "moss", label: "Moss", value: "#9bc27f" },
  { id: "amber", label: "Amber", value: "#ddac51" },
  { id: "ice", label: "Ice", value: "#bed8f7" },
  { id: "violet", label: "Violet", value: "#9e92d4" },
];

const SHIRTS = [
  { id: "linen", label: "Linen", value: "#d8c5a2", shade: "#a2875d" },
  { id: "spruce", label: "Spruce", value: "#61876e", shade: "#3f5d4b" },
  { id: "cinder", label: "Cinder", value: "#7b7f88", shade: "#51545b" },
  { id: "sun", label: "Sun", value: "#d9a748", shade: "#9e6c16" },
  { id: "rose", label: "Rose", value: "#b36e86", shade: "#7a4458" },
];

const JACKETS = [
  { id: "none", label: "None", value: null, shade: null },
  { id: "traveler", label: "Traveler", value: "#5f4e3d", shade: "#3f3025" },
  { id: "armour", label: "Armour", value: "#7e8a9d", shade: "#586273" },
  { id: "foxcloak", label: "Fox Cloak", value: "#a96b46", shade: "#72472e" },
];

const TROUSERS = [
  { id: "coal", label: "Coal", value: "#3c424b", shade: "#252b34" },
  { id: "moss", label: "Moss", value: "#557159", shade: "#314237" },
  { id: "oak", label: "Oak", value: "#7d6347", shade: "#533e2c" },
  { id: "twilight", label: "Twilight", value: "#4f4f77", shade: "#32324d" },
];

const SHOES = [
  { id: "boots", label: "Boots", value: "#5a3d28", shade: "#362214" },
  { id: "sandals", label: "Sandals", value: "#a48252", shade: "#745a34" },
  { id: "soft", label: "Soft", value: "#756e72", shade: "#4c4748" },
];

const ACCESSORIES = [
  { id: "none", label: "None", value: null },
  { id: "moonpin", label: "Moon Pin", value: "#d7d2f0" },
  { id: "satchel", label: "Satchel", value: "#8a6742" },
  { id: "lantern", label: "Lantern Charm", value: "#d6bf76" },
  { id: "fox-earring", label: "Fox Earring", value: "#cd8056" },
];

const OPTION_GROUPS = {
  bodyType: BODY_TYPES,
  skinTone: SKIN_TONES,
  hairstyle: HAIRSTYLES,
  hairColor: HAIR_COLORS,
  eyeColor: EYE_COLORS,
  shirt: SHIRTS,
  jacket: JACKETS,
  trousers: TROUSERS,
  shoes: SHOES,
  accessory: ACCESSORIES,
};

function byId(list, id) {
  return list.find((item) => item.id === id) ?? list[0];
}

export function getCustomizationOptions() {
  return OPTION_GROUPS;
}

export function createDefaultAppearance() {
  return {
    name: "Alder",
    bodyType: BODY_TYPES[0].id,
    skinTone: SKIN_TONES[1].id,
    hairstyle: HAIRSTYLES[0].id,
    hairColor: HAIR_COLORS[0].id,
    eyeColor: EYE_COLORS[0].id,
    shirt: SHIRTS[0].id,
    jacket: JACKETS[0].id,
    trousers: TROUSERS[0].id,
    shoes: SHOES[0].id,
    accessory: ACCESSORIES[0].id,
  };
}

export function mergeAppearance(base = {}, override = {}) {
  return {
    ...createDefaultAppearance(),
    ...base,
    ...override,
  };
}

export function createPlayer(appearance = createDefaultAppearance()) {
  const merged = mergeAppearance(createDefaultAppearance(), appearance);
  return {
    id: "player",
    name: merged.name,
    appearance: merged,
    x: 0,
    y: 0,
    px: 0,
    py: 0,
    direction: "down",
    moving: false,
    sprinting: false,
    health: 100,
    maxHealth: 100,
    energy: 100,
    maxEnergy: 100,
    attackCooldown: 0,
    inventory: [],
    abilities: [],
    unlockedCosmetics: {
      hairstyles: [BODY_TYPES[0].id],
      outfits: ["starter"],
      colors: ["default"],
      accessories: ["none"],
    },
  };
}

export function normalizeAppearance(appearance = {}) {
  return mergeAppearance(createDefaultAppearance(), appearance);
}

export function unlockFromCosmetics(unlocked, type, id) {
  const current = unlocked[type] ?? [];
  if (!current.includes(id)) {
    current.push(id);
  }
  return unlocked;
}

function paletteFor(type, id) {
  return byId(OPTION_GROUPS[type], id);
}

function pixelRect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function drawTopDownAvatar(ctx, appearance, x, y, scale, options) {
  const body = paletteFor("bodyType", appearance.bodyType);
  const skin = paletteFor("skinTone", appearance.skinTone);
  const hair = paletteFor("hairColor", appearance.hairColor);
  const shirt = paletteFor("shirt", appearance.shirt);
  const jacket = paletteFor("jacket", appearance.jacket);
  const trousers = paletteFor("trousers", appearance.trousers);
  const shoes = paletteFor("shoes", appearance.shoes);
  const accessory = paletteFor("accessory", appearance.accessory);
  const blinking = options?.blink ?? false;
  const facing = options?.facing ?? "down";
  const scaleX = scale;
  const scaleY = scale;

  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.imageSmoothingEnabled = false;

  // Shadow first, because every hero needs a dramatic footprint.
  pixelRect(ctx, -body.width / 2 + 1, body.height / 2 + 5, body.width - 2, 3, "rgba(0,0,0,0.22)");

  // Legs.
  pixelRect(ctx, -body.width / 2 + 2, 10, body.width - 4, 6, trousers.value);
  pixelRect(ctx, -body.width / 2 + 2, 14, body.width - 4, 4, trousers.shade);

  // Boots.
  pixelRect(ctx, -body.width / 2 + 1, 16, 4, 3, shoes.value);
  pixelRect(ctx, body.width / 2 - 5, 16, 4, 3, shoes.value);

  // Torso.
  pixelRect(ctx, -body.shoulder / 2, -2, body.shoulder, 12, shirt.value);
  pixelRect(ctx, -body.shoulder / 2, 6, body.shoulder, 4, shirt.shade);

  if (jacket.id !== "none") {
    pixelRect(ctx, -body.shoulder / 2 - 1, -2, body.shoulder + 2, 7, jacket.value);
    pixelRect(ctx, -body.shoulder / 2 - 1, 4, body.shoulder + 2, 2, jacket.shade);
  }

  // Head.
  pixelRect(ctx, -5, -14, 10, 9, skin.value);
  pixelRect(ctx, -4, -13, 8, 1, skin.shadow);
  pixelRect(ctx, -5, -6, 10, 1, skin.shadow);

  // Hair cap / style.
  const hairTop = appearance.hairstyle === "braid" ? -17 : -15;
  const hairHeight = appearance.hairstyle === "cloak" ? 13 : 7;
  pixelRect(ctx, -6, hairTop, 12, hairHeight, hair.value);
  pixelRect(ctx, -6, -8, 12, 2, hair.shade);
  if (appearance.hairstyle === "messy") {
    pixelRect(ctx, -7, -16, 3, 3, hair.value);
    pixelRect(ctx, 4, -16, 3, 3, hair.value);
  } else if (appearance.hairstyle === "braid") {
    pixelRect(ctx, -1, -5, 2, 11, hair.shade);
    pixelRect(ctx, -2, 3, 4, 5, hair.value);
  } else if (appearance.hairstyle === "fox-tuft") {
    pixelRect(ctx, -8, -14, 4, 5, hair.value);
    pixelRect(ctx, 4, -14, 4, 5, hair.value);
  }

  // Eyes and a little expression.
  const eyeColor = paletteFor("eyeColor", appearance.eyeColor).value;
  const eyeY = blinking ? -9 : -10;
  pixelRect(ctx, -3, eyeY, 2, blinking ? 1 : 2, eyeColor);
  pixelRect(ctx, 1, eyeY, 2, blinking ? 1 : 2, eyeColor);

  // Accessory, if any.
  if (accessory.id === "moonpin") {
    pixelRect(ctx, 3, -14, 2, 2, accessory.value);
  } else if (accessory.id === "satchel") {
    pixelRect(ctx, body.width / 2 - 2, 1, 4, 6, accessory.value);
  } else if (accessory.id === "lantern") {
    pixelRect(ctx, -1, 14, 2, 4, accessory.value);
  } else if (accessory.id === "fox-earring") {
    pixelRect(ctx, -6, -10, 1, 1, accessory.value);
    pixelRect(ctx, 5, -10, 1, 1, accessory.value);
  }

  // Tiny motion cue for run cycles.
  if (facing === "left") {
    pixelRect(ctx, -body.width / 2 - 1, 7, 2, 2, shirt.shade);
  } else if (facing === "right") {
    pixelRect(ctx, body.width / 2 - 1, 7, 2, 2, shirt.shade);
  }

  ctx.restore();
}

function drawPortraitAvatar(ctx, appearance, x, y, size) {
  const skin = paletteFor("skinTone", appearance.skinTone);
  const hair = paletteFor("hairColor", appearance.hairColor);
  const shirt = paletteFor("shirt", appearance.shirt);
  const jacket = paletteFor("jacket", appearance.jacket);
  const eyeColor = paletteFor("eyeColor", appearance.eyeColor).value;
  const accessory = paletteFor("accessory", appearance.accessory);

  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.imageSmoothingEnabled = false;

  // Portrait bust.
  pixelRect(ctx, -size * 0.22, size * 0.12, size * 0.44, size * 0.28, shirt.value);
  if (jacket.id !== "none") {
    pixelRect(ctx, -size * 0.24, size * 0.08, size * 0.48, size * 0.26, jacket.value);
  }
  pixelRect(ctx, -size * 0.14, -size * 0.03, size * 0.28, size * 0.2, skin.shadow);
  pixelRect(ctx, -size * 0.18, -size * 0.17, size * 0.36, size * 0.28, skin.value);
  pixelRect(ctx, -size * 0.2, -size * 0.2, size * 0.4, size * 0.1, hair.value);
  pixelRect(ctx, -size * 0.18, -size * 0.12, size * 0.36, size * 0.03, hair.shade);

  if (appearance.hairstyle === "braid") {
    pixelRect(ctx, -size * 0.24, -size * 0.05, size * 0.08, size * 0.22, hair.value);
    pixelRect(ctx, size * 0.16, -size * 0.05, size * 0.08, size * 0.22, hair.value);
  } else if (appearance.hairstyle === "fox-tuft") {
    pixelRect(ctx, -size * 0.24, -size * 0.18, size * 0.12, size * 0.08, hair.value);
    pixelRect(ctx, size * 0.12, -size * 0.18, size * 0.12, size * 0.08, hair.value);
  }

  pixelRect(ctx, -size * 0.07, -size * 0.02, size * 0.035, size * 0.035, eyeColor);
  pixelRect(ctx, size * 0.035, -size * 0.02, size * 0.035, size * 0.035, eyeColor);
  pixelRect(ctx, -size * 0.02, size * 0.06, size * 0.04, size * 0.02, skin.shadow);

  if (accessory.id === "moonpin") {
    pixelRect(ctx, size * 0.12, -size * 0.14, size * 0.05, size * 0.05, accessory.value);
  } else if (accessory.id === "satchel") {
    pixelRect(ctx, size * 0.2, size * 0.18, size * 0.14, size * 0.2, accessory.value);
  } else if (accessory.id === "lantern") {
    pixelRect(ctx, -size * 0.02, size * 0.2, size * 0.04, size * 0.08, accessory.value);
  } else if (accessory.id === "fox-earring") {
    pixelRect(ctx, -size * 0.2, -size * 0.03, size * 0.03, size * 0.03, accessory.value);
    pixelRect(ctx, size * 0.16, -size * 0.03, size * 0.03, size * 0.03, accessory.value);
  }

  ctx.restore();
}

export function drawAvatar(ctx, appearance, x, y, size = 64, options = {}) {
  const normalized = normalizeAppearance(appearance);
  if (options.view === "portrait") {
    drawPortraitAvatar(ctx, normalized, x, y, size);
    return;
  }
  drawTopDownAvatar(ctx, normalized, x, y, size, options);
}

export function drawFoxPortrait(ctx, x, y, size = 64, mood = "calm") {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.imageSmoothingEnabled = false;

  const orange = mood === "alarm" ? "#d66b38" : "#ce7a3e";
  const shadow = mood === "alarm" ? "#8f4423" : "#8a4c28";
  pixelRect(ctx, -size * 0.18, -size * 0.08, size * 0.36, size * 0.24, orange);
  pixelRect(ctx, -size * 0.16, -size * 0.18, size * 0.12, size * 0.1, orange);
  pixelRect(ctx, size * 0.04, -size * 0.18, size * 0.12, size * 0.1, orange);
  pixelRect(ctx, -size * 0.14, -size * 0.04, size * 0.28, size * 0.12, shadow);
  pixelRect(ctx, -size * 0.07, -size * 0.02, size * 0.03, size * 0.03, "#fff1d2");
  pixelRect(ctx, size * 0.04, -size * 0.02, size * 0.03, size * 0.03, "#fff1d2");
  pixelRect(ctx, -size * 0.02, size * 0.05, size * 0.04, size * 0.03, "#6d3420");
  ctx.restore();
}

export {
  BODY_TYPES,
  SKIN_TONES,
  HAIRSTYLES,
  HAIR_COLORS,
  EYE_COLORS,
  SHIRTS,
  JACKETS,
  TROUSERS,
  SHOES,
  ACCESSORIES,
};

