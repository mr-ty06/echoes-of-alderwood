import {
  ACCESSORIES,
  BODY_TYPES,
  EYE_COLORS,
  HAIR_COLORS,
  HAIRSTYLES,
  JACKETS,
  SHIRTS,
  SHOES,
  SKIN_TONES,
  TROUSERS,
  createDefaultAppearance,
  createPlayer,
  drawAvatar,
  drawFoxPortrait,
  mergeAppearance,
} from "./player.js";
import { CHAPTERS, TILE, createWorld, getScene, isSolidTile, sceneMusic, tileAt } from "./world.js";
import { QUESTS, activateQuest, completeQuest, createQuestState, getJournalEntries, questStepLabel, updateQuestProgress } from "./quests.js";
import { getDialogue, getDialogueNode, listDialogues } from "./dialogue.js";
import {
  clearAutosave,
  createSaveState,
  deleteSlot,
  exportSaveData,
  hasAnySave,
  importSaveData,
  listSaveSlots,
  loadLatestSave,
  loadSlot,
  saveAutosave,
  saveSlot,
} from "./save-system.js";
import { openAvatarEditor } from "./avatar-editor.js";

const VIEW_WIDTH = 960;
const VIEW_HEIGHT = 640;
const TILE_SIZE = 16;
const SAVE_HINT = "Autosaves are stored locally in this browser. Refreshing should not wipe progress.";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function createInputState() {
  return {
    up: false,
    down: false,
    left: false,
    right: false,
    run: false,
    action: false,
    attack: false,
    interact: false,
    confirm: false,
    cancel: false,
  };
}

function makeToastStack(root) {
  const stack = document.createElement("div");
  stack.className = "toast-stack";
  root.appendChild(stack);
  return {
    show(message, ttl = 2400) {
      const toast = document.createElement("div");
      toast.className = "toast";
      toast.textContent = message;
      stack.appendChild(toast);
      window.setTimeout(() => toast.remove(), ttl);
    },
  };
}

function createAudioDirector() {
  const scenes = {
    home: { tempo: 84, root: 196, chord: [0, 4, 7] },
    village: { tempo: 96, root: 220, chord: [0, 3, 7] },
    forest: { tempo: 72, root: 174, chord: [0, 5, 9] },
  };

  let context = null;
  let gain = null;
  let currentScene = "home";
  let timer = 0;
  let step = 0;
  let ambience = null;

  function ensure() {
    if (context) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    context = new AudioContext();
    gain = context.createGain();
    gain.gain.value = 0.04;
    gain.connect(context.destination);
  }

  function note(freq, length, type = "triangle", vol = 0.42) {
    if (!context || !gain) return;
    const osc = context.createOscillator();
    const env = context.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    env.gain.value = 0.0001;
    osc.connect(env);
    env.connect(gain);
    const now = context.currentTime;
    env.gain.exponentialRampToValueAtTime(vol, now + 0.03);
    env.gain.exponentialRampToValueAtTime(0.0001, now + length);
    osc.start();
    osc.stop(now + length + 0.04);
  }

  function noiseWash() {
    if (!context || ambience) return;
    const bufferSize = 2 * context.sampleRate;
    const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i += 1) {
      data[i] = (Math.random() * 2 - 1) * 0.05;
    }
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const washGain = context.createGain();
    filter.type = "lowpass";
    filter.frequency.value = 480;
    washGain.gain.value = 0.35;
    source.buffer = buffer;
    source.loop = true;
    source.connect(filter);
    filter.connect(washGain);
    washGain.connect(gain);
    source.start();
    ambience = { source, washGain };
  }

  return {
    start() {
      ensure();
      if (!context) return;
      if (context.state === "suspended") {
        void context.resume();
      }
      noiseWash();
    },
    setScene(sceneId) {
      currentScene = sceneId;
      timer = 0;
      step = 0;
    },
    tick(dt) {
      if (!context || !gain) return;
      timer += dt;
      const config = scenes[currentScene] ?? scenes.village;
      const beat = 60 / config.tempo;
      if (timer >= beat) {
        timer = 0;
        const pattern = config.chord;
        const tone = config.root * Math.pow(2, pattern[step % pattern.length] / 12);
        note(tone, beat * 0.9, currentScene === "forest" ? "sine" : "triangle", 0.3);
        if (step % 4 === 0) {
          note(tone / 2, beat * 1.4, "sine", 0.15);
        }
        step += 1;
      }
    },
    trigger(sceneId) {
      this.start();
      this.setScene(sceneId);
    },
  };
}

function createState() {
  const appearance = createDefaultAppearance();
  return {
    mode: "intro",
    scene: "home",
    location: "Foxglove House",
    chapter: 1,
    chapterTitle: CHAPTERS[0].title,
    player: createPlayer(appearance),
    world: createWorld(),
    quests: createQuestState(),
    flags: {
      foxBond: false,
      memoryLost: false,
      lanternRestored: false,
      merchantTrusted: false,
      introSeen: false,
      mirrorUnlocked: true,
      chapterChoice: null,
      memorySacrificed: false,
      corruptionTamed: false,
      newGamePlusUnlocked: false,
    },
    discoveredLocations: ["Alderwood Village", "Foxglove House"],
    dialogueChoices: [],
    inventory: ["map scrap", "travel flask"],
    unlockedOutfits: {
      hairstyles: [appearance.hairstyle],
      outfits: ["starter"],
      colors: ["default"],
      accessories: ["none"],
      jacket: ["none"],
      shirt: [appearance.shirt],
      trousers: [appearance.trousers],
    },
    abilities: ["walk", "run", "interact"],
    weather: "clear",
    timeLabel: "Dawn",
    minutes: 7 * 60,
    day: 1,
    camera: { x: 0, y: 0 },
    transition: null,
    ui: {
      journalOpen: false,
      mapOpen: false,
      inventoryOpen: false,
      saveOpen: false,
      titleOpen: false,
      dialogueOpen: false,
      editorOpen: false,
      pauseOpen: false,
    },
    dialogue: null,
    dialogueNode: null,
    dialogueSpeaker: null,
    activeNpc: null,
    combat: null,
    particles: [],
    textQueue: [],
    toast: [],
    endingProgress: {
      restore: false,
      memory: false,
      guardian: false,
      storyComplete: false,
    },
    worldState: {
      forestPuzzle: [],
      hiddenItemFound: false,
      wispDefeated: false,
      lanternRestored: false,
      chapterChoiceMade: false,
    },
    saveSlot: null,
    autosaveTimer: 0,
    savedAt: null,
  };
}

function hydrateStateFromSave(save) {
  const state = createState();
  if (!save) return state;
  state.player.name = save.name ?? state.player.name;
  state.player.appearance = mergeAppearance(state.player.appearance, save.appearance ?? {});
  state.player.health = save.health ?? 100;
  state.player.energy = save.energy ?? 100;
  state.player.x = save.position?.x ?? state.player.x;
  state.player.y = save.position?.y ?? state.player.y;
  state.scene = save.scene ?? "home";
  state.location = save.location ?? "Foxglove House";
  state.chapter = save.chapter ?? 1;
  state.player.inventory = save.inventory ?? state.player.inventory;
  state.player.abilities = save.abilities ?? state.player.abilities;
  state.dialogueChoices = save.dialogueChoices ?? [];
  state.unlockedOutfits = save.unlockedOutfits ?? state.unlockedOutfits;
  state.discoveredLocations = save.discoveredLocations ?? state.discoveredLocations;
  state.minutes = save.gameTime?.minutes ?? state.minutes;
  state.day = save.gameTime?.day ?? state.day;
  state.weather = save.gameTime?.weather ?? state.weather;
  state.endingProgress = save.endingProgress ?? state.endingProgress;
  state.flags = { ...state.flags, ...(save.flags ?? {}) };
  state.worldState = { ...state.worldState, ...(save.worldState ?? {}) };
  state.flags.newGamePlusUnlocked = Boolean(save.newGamePlusUnlocked);
  state.savedAt = save.savedAt ?? null;
  state.quests = { ...state.quests, ...(save.completedQuests ?? {}), ...(save.activeQuests ?? {}) };

  for (const [questId, quest] of Object.entries(save.completedQuests ?? {})) {
    state.quests[questId] = { ...state.quests[questId], ...quest, status: "completed", visible: true };
  }
  for (const [questId, quest] of Object.entries(save.activeQuests ?? {})) {
    state.quests[questId] = { ...state.quests[questId], ...quest, status: quest.status ?? "active", visible: true };
  }
  return state;
}

function keyOf(entity) {
  return entity ? `${entity.id}:${entity.scene ?? entity.target ?? ""}` : "none";
}

function intersects(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function createGameCanvas() {
  const canvas = document.createElement("canvas");
  canvas.id = "viewport";
  canvas.width = VIEW_WIDTH;
  canvas.height = VIEW_HEIGHT;
  canvas.setAttribute("aria-label", "Echoes of Alderwood game screen");
  return canvas;
}

function createButton(label, className, handler) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `btn ${className ?? ""}`.trim();
  button.textContent = label;
  if (handler) button.addEventListener("click", handler);
  return button;
}

function makePanel(title) {
  const panel = document.createElement("section");
  panel.className = "panel panel--floating hidden";
  panel.innerHTML = `
    <div class="panel__header">
      <h2>${title}</h2>
      <button type="button" class="btn btn--ghost" data-close>Close</button>
    </div>
    <div class="panel__body" data-body></div>
  `;
  return panel;
}

function tilePalette(tile, t, x, y) {
  const pulse = Math.sin(t * 3 + x * 0.3 + y * 0.2);
  const fade = Math.cos(t * 2 + x * 0.15);
  switch (tile) {
    case "grass":
      return { base: "#335c43", shade: "#244032", detail: pulse > 0.3 ? "#4d7b5e" : "#39624b" };
    case "path":
      return { base: "#7b6044", shade: "#5b452f", detail: "#9a805f" };
    case "pond":
      return { base: "#2f5873", shade: "#1d3d53", detail: fade > 0 ? "#5ca3d1" : "#3d779f" };
    case "tree":
      return { base: "#27422e", shade: "#18251c", detail: "#3b5f40" };
    case "roof":
      return { base: "#8a4938", shade: "#5e3227", detail: "#b46b58" };
    case "floor":
      return { base: "#b39a71", shade: "#866e4d", detail: "#ceb691" };
    case "wall":
      return { base: "#6d6c73", shade: "#4b4a4f", detail: "#9f9ca4" };
    case "forge":
      return { base: "#685241", shade: "#47372d", detail: "#8c725f" };
    case "lantern":
      return { base: "#6a5840", shade: "#463826", detail: "#f0c96d" };
    case "fire":
      return { base: "#d06b32", shade: "#8f3d17", detail: pulse > 0 ? "#ffd27d" : "#ff9e55" };
    case "stone":
      return { base: "#7d7c7a", shade: "#595857", detail: "#a7a5a3" };
    case "cart":
      return { base: "#916d42", shade: "#604624", detail: "#d0ac73" };
    case "flower":
      return { base: "#435f3d", shade: "#2e4529", detail: "#e79cc5" };
    case "well":
      return { base: "#6b6a72", shade: "#4a4950", detail: "#bfd4e1" };
    case "bed":
      return { base: "#645157", shade: "#43353a", detail: "#bba4aa" };
    case "table":
      return { base: "#7a5e45", shade: "#54402e", detail: "#b39272" };
    case "mirror":
      return { base: "#8a8e96", shade: "#5d6168", detail: "#dfe8f1" };
    case "crate":
      return { base: "#7a5a3c", shade: "#533926", detail: "#b28c63" };
    case "rug":
      return { base: "#7c4a5b", shade: "#4f2d39", detail: "#c46e83" };
    case "loose":
      return { base: "#8e744f", shade: "#634f31", detail: "#c7ab79" };
    case "books":
    case "shelf":
      return { base: "#5f6d8a", shade: "#3d4a63", detail: "#9cb0cf" };
    case "attic":
      return { base: "#4d4235", shade: "#32291f", detail: "#7c6a57" };
    case "door":
      return { base: "#68473b", shade: "#472f26", detail: "#a87458" };
    case "hedge":
      return { base: "#214126", shade: "#152718", detail: "#2f5c37" };
    case "cave":
      return { base: "#3a434d", shade: "#1c2229", detail: "#657286" };
    case "grove":
      return { base: "#274031", shade: "#152419", detail: "#3d6a4e" };
    case "spirit":
      return { base: "#88a989", shade: "#57715a", detail: "#d4f1d5" };
    case "flowers":
      return { base: "#47634a", shade: "#2f4530", detail: "#efb0cd" };
    case "stones":
      return { base: "#6a6a70", shade: "#47474c", detail: "#a2a2a9" };
    case "rune":
      return { base: "#38414f", shade: "#1d2129", detail: pulse > 0 ? "#92e8ff" : "#71b7da" };
    case "corruption":
      return { base: "#4f224d", shade: "#2f142e", detail: pulse > 0 ? "#c469d7" : "#7a3a86" };
    case "clue":
      return { base: "#e7dcab", shade: "#9d9166", detail: "#fff8cc" };
    case "shard":
      return { base: "#86b5e0", shade: "#4a729b", detail: "#d5efff" };
    default:
      return { base: "#335c43", shade: "#244032", detail: "#4d7b5e" };
  }
}

function renderTile(ctx, tile, x, y, t) {
  const px = x * TILE_SIZE;
  const py = y * TILE_SIZE;
  const { base, shade, detail } = tilePalette(tile, t, x, y);

  ctx.fillStyle = base;
  ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

  if (tile === "grass") {
    ctx.fillStyle = detail;
    ctx.fillRect(px + 2, py + 3, 3, 1);
    ctx.fillRect(px + 10, py + 8, 2, 1);
  } else if (tile === "path") {
    ctx.fillStyle = shade;
    ctx.fillRect(px, py + 12, TILE_SIZE, 4);
    ctx.fillStyle = detail;
    ctx.fillRect(px + 3, py + 4, 5, 2);
    ctx.fillRect(px + 8, py + 10, 4, 2);
  } else if (tile === "pond") {
    ctx.fillStyle = detail;
    ctx.fillRect(px + 1, py + 3, 5, 1);
    ctx.fillRect(px + 7, py + 7, 7, 1);
    ctx.fillRect(px + 2, py + 11, 6, 1);
  } else if (tile === "tree") {
    ctx.fillStyle = shade;
    ctx.fillRect(px + 5, py + 8, 6, 8);
    ctx.fillStyle = detail;
    ctx.fillRect(px + 2, py + 2, 12, 8);
    ctx.fillRect(px + 3, py + 5, 10, 5);
  } else if (tile === "roof") {
    ctx.fillStyle = detail;
    ctx.fillRect(px + 2, py + 1, 12, 4);
    ctx.fillStyle = shade;
    ctx.fillRect(px, py + 6, TILE_SIZE, 3);
  } else if (tile === "floor") {
    ctx.fillStyle = shade;
    ctx.fillRect(px, py + 12, TILE_SIZE, 4);
    ctx.fillStyle = detail;
    ctx.fillRect(px + 2, py + 2, 4, 1);
  } else if (tile === "wall") {
    ctx.fillStyle = shade;
    ctx.fillRect(px, py + 8, TILE_SIZE, 8);
    ctx.fillStyle = detail;
    ctx.fillRect(px + 2, py + 2, 4, 4);
    ctx.fillRect(px + 10, py + 3, 3, 3);
  } else if (tile === "lantern") {
    ctx.fillStyle = detail;
    ctx.fillRect(px + 6, py + 2, 4, 8);
    ctx.fillStyle = "#fff5b8";
    ctx.fillRect(px + 7, py + 4, 2, 3);
  } else if (tile === "fire") {
    ctx.fillStyle = detail;
    ctx.fillRect(px + 5, py + 3, 6, 7);
    ctx.fillStyle = "#fff0a8";
    ctx.fillRect(px + 7, py + 5, 2, 2);
  } else if (tile === "stone" || tile === "rune" || tile === "shard") {
    ctx.fillStyle = shade;
    ctx.fillRect(px + 2, py + 2, 12, 12);
    ctx.fillStyle = detail;
    ctx.fillRect(px + 4, py + 4, 6, 4);
  } else if (tile === "mirror") {
    ctx.fillStyle = detail;
    ctx.fillRect(px + 4, py + 1, 8, 13);
    ctx.fillStyle = shade;
    ctx.fillRect(px + 5, py + 2, 1, 10);
  } else if (tile === "cave" || tile === "corruption") {
    ctx.fillStyle = shade;
    ctx.fillRect(px + 1, py + 1, 14, 14);
    ctx.fillStyle = detail;
    ctx.fillRect(px + 4, py + 4, 8, 8);
  } else {
    ctx.fillStyle = shade;
    ctx.fillRect(px, py + 12, TILE_SIZE, 4);
  }
}

function drawScene(ctx, scene, camera, t, weather, state) {
  const startX = Math.floor(camera.x / TILE_SIZE);
  const startY = Math.floor(camera.y / TILE_SIZE);
  const endX = Math.ceil((camera.x + VIEW_WIDTH) / TILE_SIZE);
  const endY = Math.ceil((camera.y + VIEW_HEIGHT) / TILE_SIZE);

  const sky = scene.id === "forest" ? "#0c1522" : scene.id === "home" ? "#1c1b29" : "#22313f";
  const horizon = scene.id === "forest" ? "#2d3742" : "#415869";
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  ctx.fillStyle = horizon;
  ctx.fillRect(0, 0, VIEW_WIDTH, 130);

  for (let y = startY; y <= endY; y += 1) {
    for (let x = startX; x <= endX; x += 1) {
      const tile = tileAt(scene, x, y);
      if (tile === "void") continue;
      renderTile(ctx, tile, x, y, t);
    }
  }

  // Weather overlays and atmosphere.
  if (weather === "rain") {
    ctx.strokeStyle = "rgba(157, 195, 235, 0.45)";
    for (let i = 0; i < 80; i += 1) {
      const x = (i * 31 + t * 180) % VIEW_WIDTH;
      const y = (i * 53 + t * 240) % VIEW_HEIGHT;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 5, y + 10);
      ctx.stroke();
    }
  } else if (weather === "fog") {
    ctx.fillStyle = "rgba(223, 230, 238, 0.08)";
    for (let i = 0; i < 6; i += 1) {
      ctx.fillRect(0, 100 + i * 70 + Math.sin(t * 0.9 + i) * 18, VIEW_WIDTH, 36);
    }
  } else if (weather === "leaves") {
    ctx.fillStyle = "#d9a94d";
    for (let i = 0; i < 24; i += 1) {
      const x = (i * 67 + t * 60) % VIEW_WIDTH;
      const y = (i * 41 + t * 120) % VIEW_HEIGHT;
      ctx.fillRect(x, y, 3, 2);
    }
  }

  // Ambient darkness deepens as the story begins to fray.
  const dusk = state.flags.lanternRestored ? 0.02 : scene.id === "forest" ? 0.18 : 0.1;
  ctx.fillStyle = `rgba(6, 8, 12, ${dusk + Math.max(0, Math.sin(t * 0.05) * 0.02)})`;
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
}

function drawPropsAndActors(ctx, scene, state, t, blinkOn) {
  const camera = state.camera;
  const drawEntity = (entity, colorSet = {}) => {
    const sx = entity.x * TILE_SIZE - camera.x;
    const sy = entity.y * TILE_SIZE - camera.y;
    if (sx < -40 || sy < -40 || sx > VIEW_WIDTH + 40 || sy > VIEW_HEIGHT + 40) return;

    if (entity.kind === "fox") {
      ctx.save();
      ctx.translate(Math.round(sx + TILE_SIZE / 2), Math.round(sy + TILE_SIZE / 2 + 2));
      ctx.fillStyle = "#d67c43";
      ctx.fillRect(-6, -5, 12, 8);
      ctx.fillStyle = "#8d4d28";
      ctx.fillRect(-5, -2, 10, 4);
      ctx.fillStyle = "#fff0c8";
      ctx.fillRect(-2, -1, 1, 1);
      ctx.fillRect(1, -1, 1, 1);
      ctx.fillRect(-1, 2, 2, 1);
      ctx.restore();
      return;
    }

    const portraitAppearance = {
      name: entity.name,
      bodyType: "steadfast",
      skinTone:
        entity.kind === "elder" ? "porcelain" : entity.kind === "merchant" ? "olive" : "honey",
      hairstyle:
        entity.kind === "baker"
          ? "braid"
          : entity.kind === "merchant"
            ? "messy"
            : entity.kind === "child"
              ? "short"
              : "cloak",
      hairColor:
        entity.kind === "elder"
          ? "moon"
          : entity.kind === "merchant"
            ? "midnight"
            : entity.kind === "child"
              ? "copper"
              : entity.kind === "smith"
                ? "chestnut"
                : "fern",
      eyeColor: entity.kind === "merchant" ? "violet" : entity.kind === "child" ? "amber" : "moss",
      shirt:
        entity.kind === "elder"
          ? "linen"
          : entity.kind === "smith"
            ? "cinder"
            : entity.kind === "baker"
              ? "rose"
              : "spruce",
      jacket:
        entity.kind === "smith"
          ? "armour"
          : entity.kind === "merchant"
            ? "traveler"
            : "none",
      trousers: entity.kind === "child" ? "twilight" : "coal",
      shoes: entity.kind === "elder" ? "soft" : "boots",
      accessory:
        entity.kind === "merchant"
          ? "satchel"
          : entity.kind === "baker"
            ? "moonpin"
            : entity.kind === "child"
              ? "fox-earring"
              : "none",
    };
    drawAvatar(ctx, portraitAppearance, sx + TILE_SIZE / 2, sy + TILE_SIZE / 2 + 3, 20, {
      view: "topdown",
      blink: blinkOn && entity.id === "fox" && Math.floor(t * 2) % 2 === 0,
      facing: entity.facing ?? "down",
    });

    if (entity.kind === "spirit") {
      ctx.fillStyle = "rgba(215, 245, 255, 0.4)";
      ctx.fillRect(sx + 2, sy + 2, 12, 6);
    }
  };

  for (const npc of scene.npcs) {
    drawEntity(npc);
  }

  if (state.combat?.enemy) {
    const enemy = state.combat.enemy;
    const sx = enemy.x * TILE_SIZE - camera.x;
    const sy = enemy.y * TILE_SIZE - camera.y;
    ctx.fillStyle = "#6d2a6f";
    ctx.fillRect(sx + 2, sy + 2, 12, 12);
    ctx.fillStyle = "#d884da";
    ctx.fillRect(sx + 4, sy + 4, 4, 4);
    ctx.fillRect(sx + 8, sy + 4, 4, 4);
    ctx.fillRect(sx + 6, sy + 8, 2, 3);
  }

  for (const particle of state.particles) {
    const sx = particle.x - camera.x;
    const sy = particle.y - camera.y;
    ctx.fillStyle = particle.color;
    ctx.globalAlpha = clamp(particle.alpha, 0, 1);
    ctx.fillRect(sx, sy, particle.size, particle.size);
    ctx.globalAlpha = 1;
  }
}

function updateParticles(state, dt) {
  state.particles = state.particles
    .map((particle) => ({
      ...particle,
      x: particle.x + particle.vx * dt,
      y: particle.y + particle.vy * dt,
      life: particle.life - dt,
      alpha: particle.alpha - dt * 0.4,
    }))
    .filter((particle) => particle.life > 0);
}

function spawnSparkles(state, x, y, color = "#fff2a4", count = 6) {
  for (let i = 0; i < count; i += 1) {
    state.particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 20,
      vy: -20 - Math.random() * 24,
      life: 0.7 + Math.random() * 0.5,
      alpha: 1,
      size: 2 + (i % 2),
      color,
    });
  }
}

function spawnLeaves(state, x, y, count = 10) {
  for (let i = 0; i < count; i += 1) {
    state.particles.push({
      x,
      y,
      vx: -10 + Math.random() * 24,
      vy: 8 + Math.random() * 18,
      life: 1.8 + Math.random(),
      alpha: 0.8,
      size: 3,
      color: i % 2 ? "#d9b05f" : "#86c08d",
    });
  }
}

function initDOM(root) {
  root.innerHTML = "";
  const shell = document.createElement("div");
  shell.className = "game-shell";

  const header = document.createElement("header");
  header.className = "game-header";
  header.innerHTML = `
    <div class="brand">
      <div class="brand__title">Echoes of Alderwood</div>
      <div class="brand__subtitle">Restoring lanterns, one regrettable decision at a time.</div>
    </div>
    <div class="hud-strip">
      <div class="hud-chip">Chapter <strong data-chapter>1</strong></div>
      <div class="hud-chip">Location <strong data-location>Foxglove House</strong></div>
      <div class="hud-chip">Time <strong data-time>Dawn</strong></div>
      <div class="hud-chip">Music <strong data-music>Memory Room</strong></div>
    </div>
    <div class="hud-actions">
      <button class="btn btn--ghost" data-journal type="button">Journal</button>
      <button class="btn btn--ghost" data-map type="button">Map</button>
      <button class="btn btn--ghost" data-inventory type="button">Inventory</button>
      <button class="btn btn--ghost" data-save type="button">Save</button>
      <button class="btn btn--accent" data-menu type="button">Menu</button>
    </div>
  `;

  const stage = document.createElement("main");
  stage.className = "stage";
  const frame = document.createElement("div");
  frame.className = "canvas-frame";
  const canvas = createGameCanvas();
  const overlayLayer = document.createElement("div");
  overlayLayer.className = "overlay-layer";
  const fade = document.createElement("div");
  fade.className = "fade-cover";
  const mobileControls = document.createElement("div");
  mobileControls.className = "mobile-controls";
  mobileControls.innerHTML = `
    <div class="mobile-pad">
      <div class="mobile-row"><button class="mobile-btn" data-key="up">▲</button></div>
      <div class="mobile-row">
        <button class="mobile-btn" data-key="left">◀</button>
        <button class="mobile-btn" data-key="down">▼</button>
        <button class="mobile-btn" data-key="right">▶</button>
      </div>
    </div>
    <div class="mobile-actions">
      <button class="mobile-btn" data-key="run">Run</button>
      <button class="mobile-btn" data-key="interact">Talk</button>
      <button class="mobile-btn" data-key="attack">Hit</button>
    </div>
  `;
  frame.append(canvas, overlayLayer, fade, mobileControls);
  stage.appendChild(frame);

  const footer = document.createElement("footer");
  footer.className = "footer-hint";
  footer.innerHTML = `
    <div data-hint>WASD / Arrows to move. Hold Shift to run. Press E or Space to interact.</div>
    <div><span class="hint-key">Esc</span> pause <span class="hint-key">I</span> journal <span class="hint-key">M</span> map</div>
  `;

  shell.append(header, stage, footer);
  root.appendChild(shell);

  return {
    shell,
    header,
    canvas,
    overlayLayer,
    fade,
    footer,
    hint: footer.querySelector("[data-hint]"),
    chapter: header.querySelector("[data-chapter]"),
    location: header.querySelector("[data-location]"),
    time: header.querySelector("[data-time]"),
    music: header.querySelector("[data-music]"),
    buttons: {
      journal: header.querySelector("[data-journal]"),
      map: header.querySelector("[data-map]"),
      inventory: header.querySelector("[data-inventory]"),
      save: header.querySelector("[data-save]"),
      menu: header.querySelector("[data-menu]"),
    },
    mobileControls,
  };
}

function renderChapterStrip(state) {
  return CHAPTERS.map((chapter) => {
    const active = chapter.id === state.chapter ? "active" : "";
    const visible = chapter.id <= Math.max(1, state.chapter);
    return `<div class="story-card ${active}" style="opacity:${visible ? 1 : 0.55}">
      <h3>Chapter ${chapter.id}</h3>
      <p>${chapter.title}</p>
    </div>`;
  }).join("");
}

function chapterSummary(state) {
  return CHAPTERS.find((chapter) => chapter.id === state.chapter)?.summary ?? CHAPTERS[0].summary;
}

function updateHUD(refs, state, scene, musicLabel) {
  refs.chapter.textContent = String(state.chapter);
  refs.location.textContent = scene.name;
  refs.time.textContent = state.timeLabel;
  refs.music.textContent = musicLabel;
  refs.hint.textContent = state.mode === "combat"
    ? "Combat: move to dodge, press Space to strike."
    : state.mode === "dialogue"
      ? "Choose a reply. Your earlier decisions will come back later. Annoying, but on brand."
      : state.mode === "ending"
        ? "The first chapter is complete. New Game + is unlocked for this save."
        : "Explore Alderwood, talk to everyone, and keep an eye out for the fox's sarcasm.";
}

function showPanel(panel, visible = true) {
  if (!panel) return;
  panel.classList.toggle("hidden", !visible);
}

function removePanel(panel) {
  if (panel) panel.remove();
}

function buildPanelList(title, bodyHTML) {
  const panel = document.createElement("section");
  panel.className = "panel panel--floating";
  panel.innerHTML = `
    <div class="panel__header">
      <h2>${title}</h2>
      <button type="button" class="btn btn--ghost" data-close>Close</button>
    </div>
    <div class="panel__body">${bodyHTML}</div>
  `;
  return panel;
}

function saveSummaryCard(save, slot = null) {
  if (!save) {
    return `
      <div class="save-slot">
        <h4>${slot ? `Slot ${slot}` : "Empty"}</h4>
        <p>No save data here.</p>
      </div>
    `;
  }
  const date = new Date(save.savedAt).toLocaleString();
  return `
    <div class="save-slot">
      <h4>${save.name} · Chapter ${save.chapter}</h4>
      <p>${save.location} · ${date}</p>
      <p>HP ${save.health} · Energy ${save.energy} · ${save.inventory?.length ?? 0} items</p>
    </div>
  `;
}

function createJournalHTML(state) {
  return `<div class="journal-grid">${getJournalEntries(state)
    .map((quest) => {
      const progress = state.quests[quest.id];
      const steps = quest.steps.length;
      const current = progress.status === "completed" ? steps : Math.min(progress.progress + 1, steps);
      const percent = Math.round((current / steps) * 100);
      return `
        <article class="quest-card">
          <h4>${quest.title}</h4>
          <p>${quest.description}</p>
          <div class="progress-line">
            <span>${questStepLabel(quest, state)}</span>
            <span>${progress.status === "completed" ? "Done" : `${current}/${steps}`}</span>
          </div>
          <div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div>
        </article>
      `;
    })
    .join("")}</div>`;
}

function createInventoryHTML(state) {
  const items = state.player.inventory.length ? state.player.inventory : ["Nothing yet. Go exploring."];
  return `
    <div class="inventory-grid">
      ${items
        .map(
          (item) => `
          <article class="inventory-card">
            <h4>${item}</h4>
            <p>${item === "moon thread" ? "A hidden clue from beneath the house stairs." : "Collected on the road through Alderwood."}</p>
          </article>
        `,
        )
        .join("")}
    </div>
  `;
}

function createMapHTML(state) {
  const chapterCards = CHAPTERS.map((chapter) => {
    const unlocked = chapter.id <= state.chapter || state.endingProgress.storyComplete;
    return `
      <article class="story-card" style="opacity:${unlocked ? 1 : 0.55}">
        <h3>${chapter.title}</h3>
        <p>${chapter.summary}</p>
      </article>
    `;
  }).join("");

  const discovered = [...new Set(state.discoveredLocations)].map((location) => `<li>${location}</li>`).join("");
  return `
    <div class="story-grid">${chapterCards}</div>
    <div class="story-card" style="margin-top:0.75rem">
      <h3>Discovered Locations</h3>
      <p>${discovered || "None yet."}</p>
    </div>
  `;
}

function createSavePanelHTML(state) {
  const slots = listSaveSlots()
    .map(
      ({ slot, save, label }) => `
        <article class="save-slot">
          <h4>Slot ${slot}</h4>
          <p>${label}</p>
          <div class="slot-actions">
            <button class="btn btn--ghost" type="button" data-load-slot="${slot}">Load</button>
            <button class="btn btn--ghost" type="button" data-save-slot="${slot}">Save</button>
            <button class="btn btn--ghost" type="button" data-delete-slot="${slot}">Delete</button>
          </div>
        </article>
      `,
    )
    .join("");

  return `
    <div class="story-card">
      <h3>Autosave</h3>
      <p>${SAVE_HINT}</p>
    </div>
    <div class="save-slot-list">${slots}</div>
    <div class="story-card" style="margin-top:0.75rem">
      <h3>Transfer</h3>
      <p>Export or import save data as JSON. Yes, this is how we do things when we need it to survive a browser refresh.</p>
      <div class="save-actions" style="margin-top:0.65rem">
        <button class="btn btn--ghost" type="button" data-export-save>Export</button>
        <button class="btn btn--ghost" type="button" data-import-save>Import</button>
      </div>
      <textarea class="field save-input" data-save-data placeholder="Paste save JSON here..."></textarea>
    </div>
  `;
}

function createStartScreenHTML(state) {
  return `
    <section class="panel title-card">
      <div class="title-hero">
        <div>
          <h1>Echoes of Alderwood</h1>
          <p>
            Wake in a lantern village gone quiet, follow a fox with too much confidence, and discover what your missing memories have to do with the darkness.
          </p>
        </div>
        <div class="title-actions">
          <button type="button" class="btn btn--accent" data-new-game>New Game</button>
          <button type="button" class="btn btn--ghost" data-continue ${hasAnySave() ? "" : "disabled"}>Continue</button>
          <button type="button" class="btn btn--ghost" data-saves>Manual Saves</button>
        </div>
        <div class="story-grid">${renderChapterStrip(state)}</div>
        <div class="story-card">
          <h3>Chapter One</h3>
          <p>${chapterSummary(state)}</p>
        </div>
      </div>
    </section>
  `;
}

function createEndingHTML(state) {
  const ending = state.endingProgress.lastEnding ?? "restore";
  const content = {
    restore: {
      title: "Ending: Lanterns Restored",
      text:
        "The first lantern burns again. Alderwood breathes easier, and the fox keeps watch while the village begins to remember what hope feels like.",
    },
    memory: {
      title: "Ending: Memory Sacrifice",
      text:
        "You give up the memories feeding the corruption. The darkness thins, but your name leaves with it. Alderwood survives because you chose to forget.",
    },
    guardian: {
      title: "Ending: New Guardian",
      text:
        "You take the corruption into yourself and stand between it and the village. The light bends around your shadow. Someone has to hold the line.",
    },
  }[ending];

  return `
    <section class="panel title-card">
      <div class="title-hero">
        <h1>${content.title}</h1>
        <p>${content.text}</p>
        <div class="title-actions">
          <button type="button" class="btn btn--accent" data-new-game-plus>New Game +</button>
          <button type="button" class="btn btn--ghost" data-return-title>Return to Title</button>
        </div>
      </div>
    </section>
  `;
}

function currentHintText(state, scene, nearby) {
  if (state.mode === "dialogue") return "Dialogue: select a response or press Enter to confirm.";
  if (state.mode === "combat") return "A wisp is here. Strike it with Space or the action button.";
  if (nearby?.type === "door") return `Press E to enter ${nearby.label}.`;
  if (nearby?.type === "wardrobe") return "Press E to open the mirror and wardrobe.";
  if (nearby?.type === "lantern") return "Press E to inspect the broken lantern.";
  if (nearby?.type === "puzzle") return "Press E to examine the rune stones.";
  if (nearby?.type === "combat") return "Press E to challenge the corrupted wisp.";
  if (nearby?.type === "item") return "Press E to collect the item.";
  if (nearby?.type === "secret-item") return "Press E to search the hidden space.";
  if (nearby?.type === "merchant") return "Press E to talk to the merchant.";
  return scene.id === "home" ? "Look around your home. There is more here than dust." : "Explore, talk, and remember to leave the village eventually.";
}

function pathForQuestItem(state, item) {
  if (!state.player.inventory.includes(item)) {
    state.player.inventory.push(item);
  }
}

function updateQuestStateForScene(state) {
  if (state.scene === "village") {
    activateQuest(state, "brokenLantern");
    if (state.worldState.hiddenItemFound) {
      updateQuestProgress(state, "puzzleOfRings", 3);
    }
  }
  if (state.worldState.lanternRestored) {
    completeQuest(state, "brokenLantern");
  }
}

function openDialogue(state, npcId) {
  const dialogue = getDialogue(npcId, state);
  state.mode = "dialogue";
  state.ui.dialogueOpen = true;
  state.dialogue = dialogue;
  state.dialogueNode = dialogue.startNode;
  state.dialogueSpeaker = dialogue.speaker;
  state.activeNpc = npcId;
}

function applyDialogueEffect(state, effect) {
  if (!effect) return;
  switch (effect.type) {
    case "flag":
      state.flags[effect.key] = effect.value;
      break;
    case "quest":
      if (effect.value === "active") activateQuest(state, effect.key);
      if (effect.value === "completed") completeQuest(state, effect.key);
      break;
    case "item":
      pathForQuestItem(state, effect.value);
      break;
    case "ending":
      state.mode = "ending";
      state.ui.dialogueOpen = false;
      state.endingProgress.lastEnding = effect.value;
      state.endingProgress.storyComplete = true;
      state.flags.newGamePlusUnlocked = true;
      break;
    default:
      break;
  }
}

function openWardrobeEditor(state, refs, onComplete) {
  state.mode = "editor";
  state.ui.editorOpen = true;
  const unlocked = {
    bodyType: BODY_TYPES.map((item) => item.id),
    skinTone: SKIN_TONES.map((item) => item.id),
    hairstyle: state.unlockedOutfits.hairstyles ?? [state.player.appearance.hairstyle],
    hairColor: HAIR_COLORS.map((item) => item.id),
    eyeColor: EYE_COLORS.map((item) => item.id),
    shirt: state.unlockedOutfits.shirt ?? [state.player.appearance.shirt],
    jacket: state.unlockedOutfits.jacket ?? ["none"],
    trousers: state.unlockedOutfits.trousers ?? [state.player.appearance.trousers],
    shoes: SHOES.map((item) => item.id),
    accessory: state.unlockedOutfits.accessories ?? ["none"],
  };

  const editor = openAvatarEditor({
    mount: refs.overlayLayer,
    appearance: state.player.appearance,
    unlocked,
    title: state.scene === "home" ? "Mirror Wardrobe" : "Create Your Memory",
    subtitle:
      state.scene === "home"
        ? "Adjust your appearance at the mirror. No, the fox will still judge you."
        : "The lantern remembers what the mirror forgets.",
    onCancel: () => {
      state.mode = "playing";
      state.ui.editorOpen = false;
      editor.close();
      onComplete?.();
    },
    onSave: (appearance) => {
      state.player.appearance = mergeAppearance(state.player.appearance, appearance);
      state.player.name = appearance.name ?? state.player.name;
      state.player.appearance.name = state.player.name;
      state.ui.editorOpen = false;
      state.mode = state.endingProgress.storyComplete ? "ending" : "playing";
      editor.close();
      onComplete?.();
      saveAutosave(state);
    },
  });
}

function startNewGame(state, refs, toast, audio, afterCreation) {
  const newState = createState();
  Object.assign(state, newState);
  audio.start();
  audio.setScene(state.scene);
  toast.show("New game created. The village is waiting.");
  openWardrobeEditor(state, refs, () => {
    state.flags.introSeen = true;
    state.ui.titleOpen = false;
    afterCreation?.();
  });
}

function triggerCutscene(state, refs, toast, text, cb) {
  const panel = buildPanelList("Opening Cutscene", `
    <div class="story-card">
      <p>${text}</p>
    </div>
    <div class="save-actions" style="margin-top:0.75rem">
      <button class="btn btn--accent" type="button" data-cutscene-next>Continue</button>
    </div>
  `);
  refs.overlayLayer.appendChild(panel);
  panel.querySelector("[data-cutscene-next]").addEventListener("click", () => {
    panel.remove();
    cb?.();
    toast.show("You remember just enough to start moving.");
  });
}

function completeLantern(state, refs, toast) {
  state.flags.lanternRestored = true;
  state.worldState.lanternRestored = true;
  completeQuest(state, "brokenLantern");
  state.discoveredLocations.push("Village Lantern");
  state.player.inventory = state.player.inventory.filter((item) => item !== "lantern shard");
  state.player.inventory.push("memory shard");
  state.endingProgress.restore = true;
  toast.show("The lantern rekindles. Something in the village exhales.");
  spawnSparkles(state, state.player.x * TILE_SIZE, state.player.y * TILE_SIZE, "#fff0a4", 14);
  state.mode = "dialogue";
  openDialogue(state, "lanternChoice");
}

function updateDialoguePanel(refs, state, canvas, callback) {
  const dialogue = state.dialogue;
  if (!dialogue) return;
  const node = getDialogueNode(dialogue, state.dialogueNode);
  const portraitCanvas = refs.overlayLayer.querySelector("[data-portrait]");
  if (!portraitCanvas) {
    state.mode = "dialogue";
    const panel = buildPanelList("Dialogue", `
      <div class="dialogue-panel">
        <div class="dialogue-top">
          <div class="portrait-frame"><canvas width="128" height="128" data-portrait></canvas></div>
          <div class="dialogue-copy">
            <div class="dialogue-name">${dialogue.speaker}</div>
            <div class="dialogue-text" data-dialogue-text></div>
          </div>
        </div>
        <div class="dialogue-choices" data-dialogue-choices></div>
      </div>
    `);
    panel.className = "panel dialogue-panel";
    panel.querySelector(".panel__header").remove();
    refs.overlayLayer.appendChild(panel);
    callback?.(panel);
  }

  const panel = refs.overlayLayer.querySelector(".dialogue-panel");
  if (!panel) return;
  const text = panel.querySelector("[data-dialogue-text]");
  const choices = panel.querySelector("[data-dialogue-choices]");
  const portrait = panel.querySelector("[data-portrait]");
  const pctx = portrait?.getContext("2d");
  if (pctx) {
    pctx.imageSmoothingEnabled = false;
    pctx.clearRect(0, 0, portrait.width, portrait.height);
    if (dialogue.portrait === "fox") {
      drawFoxPortrait(pctx, portrait.width / 2, portrait.height / 2 + 4, 80, dialogue.mood);
    } else {
      drawAvatar(
        pctx,
        {
          name: dialogue.speaker,
          bodyType: "steadfast",
          skinTone: dialogue.portrait === "elder" ? "porcelain" : dialogue.portrait === "merchant" ? "olive" : "honey",
          hairstyle: dialogue.portrait === "elder" ? "cloak" : dialogue.portrait === "baker" ? "braid" : dialogue.portrait === "merchant" ? "messy" : "short",
          hairColor: dialogue.portrait === "elder" ? "moon" : dialogue.portrait === "baker" ? "copper" : dialogue.portrait === "merchant" ? "midnight" : "chestnut",
          eyeColor: dialogue.portrait === "merchant" ? "violet" : "moss",
          shirt: dialogue.portrait === "elder" ? "linen" : dialogue.portrait === "smith" ? "cinder" : "spruce",
          jacket: dialogue.portrait === "smith" ? "armour" : "none",
          trousers: "coal",
          shoes: "boots",
          accessory: dialogue.portrait === "merchant" ? "satchel" : "none",
        },
        portrait.width / 2,
        portrait.height / 2 + 6,
        8,
        { view: "portrait" },
      );
    }
  }
  if (text) text.textContent = node.text;
  if (choices) {
    choices.innerHTML = "";
    for (const choice of node.choices) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "dialogue-choice";
      button.innerHTML = `${choice.label}${choice.hint ? `<small>${choice.hint}</small>` : ""}`;
      button.addEventListener("click", () => {
        applyDialogueEffect(state, choice.effect);
        state.dialogueChoices.push({
          npc: dialogue.speaker,
          node: node.id,
          choice: choice.label,
        });
        if (choice.next) {
          state.dialogueNode = choice.next;
          updateDialoguePanel(refs, state, canvas, callback);
        } else {
          state.dialogue = null;
          state.dialogueNode = null;
          state.dialogueSpeaker = null;
          state.ui.dialogueOpen = false;
          state.mode = state.endingProgress.storyComplete ? "ending" : "playing";
          const panel = refs.overlayLayer.querySelector(".dialogue-panel");
          panel?.remove();
          callback?.();
        }
        saveAutosave(state);
      });
      choices.appendChild(button);
    }
  }
}

function questReward(state, rewardId, toast) {
  if (rewardId === "warm shawl") {
    state.unlockedOutfits.jacket = [...new Set([...(state.unlockedOutfits.jacket ?? []), "traveler"])];
    state.player.inventory.push("warm shawl");
    toast.show("Reward unlocked: Traveler jacket");
  } else if (rewardId === "smith bracer") {
    state.unlockedOutfits.accessories = [...new Set([...(state.unlockedOutfits.accessories ?? []), "lantern"])];
    state.player.inventory.push("smith bracer");
    toast.show("Reward unlocked: Lantern charm");
  } else if (rewardId === "forest charm") {
    state.unlockedOutfits.hairstyles = [...new Set([...(state.unlockedOutfits.hairstyles ?? []), "fox-tuft"])];
    state.unlockedOutfits.accessories = [...new Set([...(state.unlockedOutfits.accessories ?? []), "moonpin"])];
    state.player.inventory.push("forest charm");
    toast.show("Reward unlocked: Fox tuft hairstyle");
  }
}

function handleItemPickup(state, item, questId, toast) {
  if (!state.player.inventory.includes(item)) {
    state.player.inventory.push(item);
    toast.show(`Collected ${item}.`);
  }
  if (questId === "broken-lantern" && item === "lantern shard") {
    updateQuestProgress(state, "brokenLantern", 3);
    spawnSparkles(state, state.player.x * TILE_SIZE, state.player.y * TILE_SIZE, "#bde9ff", 8);
  }
  if (questId === "breadline") {
    updateQuestProgress(state, "breadline", Math.min(QUESTS.breadline.steps.length, (state.quests.breadline.progress ?? 0) + 1));
    if (state.quests.breadline.progress >= QUESTS.breadline.steps.length - 1) {
      completeQuest(state, "breadline");
      questReward(state, "warm shawl", toast);
    }
  }
  if (questId === "smith-hammer") {
    activateQuest(state, "smithHammer");
    updateQuestProgress(state, "smithHammer", 2);
    completeQuest(state, "smithHammer");
    questReward(state, "smith bracer", toast);
  }
  if (questId === "forest-friends") {
    activateQuest(state, "forestFriends");
    updateQuestProgress(state, "forestFriends", 2);
  }
  saveAutosave(state);
}

function setScene(state, sceneId, spawn = null, reason = "") {
  state.scene = sceneId;
  const scene = getScene(sceneId);
  state.location = scene.name;
  state.discoveredLocations.push(scene.name);
  if (spawn) {
    state.player.x = spawn.x;
    state.player.y = spawn.y;
  } else {
    state.player.x = Math.floor(scene.width / 2);
    state.player.y = Math.floor(scene.height / 2);
  }
  state.camera.x = state.player.x * TILE_SIZE - VIEW_WIDTH / 2;
  state.camera.y = state.player.y * TILE_SIZE - VIEW_HEIGHT / 2;
  state.transition = { alpha: 1, reason };
  state.weather = scene.id === "forest" ? "fog" : scene.id === "home" ? "clear" : "leaves";
  state.timeLabel = state.weather === "fog" ? "Evening" : state.scene === "home" ? "Dawn" : "Afternoon";
  saveAutosave(state);
}

function sceneInteractables(scene) {
  return [...(scene.interactables ?? []), ...(scene.exits ?? [])];
}

function activeNearbyInteractable(state, scene) {
  const px = state.player.x;
  const py = state.player.y;
  const playerBox = { x: px - 0.4, y: py - 0.4, w: 0.8, h: 0.8 };
  return sceneInteractables(scene).find((item) =>
    intersects(playerBox.x, playerBox.y, playerBox.w, playerBox.h, item.x, item.y, item.w, item.h),
  );
}

function useCurrentInteraction(state, refs, toast, audio) {
  const scene = getScene(state.scene);
  const nearby = activeNearbyInteractable(state, scene);
  if (state.mode === "dialogue" || state.mode === "editor" || state.mode === "ending") return;

  if (nearby?.type === "door") {
    setScene(state, nearby.target, nearby.spawn, nearby.label);
    audio.setScene(state.scene);
    if (state.scene === "forest") {
      spawnLeaves(state, state.player.x * TILE_SIZE, state.player.y * TILE_SIZE, 12);
    }
    toast.show(`Entered ${nearby.label}.`);
    return;
  }

  if (nearby?.type === "wardrobe") {
    openWardrobeEditor(state, refs, () => {});
    return;
  }

  if (nearby?.type === "lantern") {
    if (state.player.inventory.includes("lantern shard") && state.player.inventory.includes("oil") && state.player.inventory.includes("wick")) {
      completeLantern(state, refs, toast);
    } else {
      toast.show("The lantern still needs a shard, oil, and a wick.");
    }
    return;
  }

  if (nearby?.type === "puzzle" && nearby.puzzle === "forest-runes") {
    const puzzleKey = nearby.index;
    const expected = [0, 1, 2];
    const sequence = state.worldState.forestPuzzle;
    if (sequence[sequence.length - 1] === puzzleKey) {
      toast.show("That stone has already been pressed.");
      return;
    }
    sequence.push(puzzleKey);
    if (sequence.length === 1 && puzzleKey === 0) toast.show("Fox. Good.");
    if (sequence.length === 2 && puzzleKey === 1) toast.show("Lantern. Warmer.");
    if (sequence.length >= 3) {
      if (sequence.join(",") === expected.join(",")) {
        state.worldState.hiddenItemFound = true;
        completeQuest(state, "puzzleOfRings");
        questReward(state, "forest charm", toast);
        state.player.inventory.push("oil");
        state.player.inventory.push("wick");
        toast.show("The grove opens and reveals supplies hidden in the moss.");
        spawnSparkles(state, state.player.x * TILE_SIZE, state.player.y * TILE_SIZE, "#dcefff", 14);
      } else {
        state.worldState.forestPuzzle = [];
        toast.show("The stones darken. Ember shakes his head. Try fox, lantern, water.");
      }
    }
    saveAutosave(state);
    return;
  }

  if (nearby?.type === "combat") {
    state.mode = "combat";
    state.combat = {
      enemy: { id: "wisp", x: nearby.x + 1, y: nearby.y + 1, health: 24, maxHealth: 24, vx: 0, vy: 0 },
      reward: "lantern shard",
      origin: nearby.id,
    };
    toast.show("A corrupted wisp rises from the cave.");
    audio.trigger("forest");
    return;
  }

  if (nearby?.type === "secret") {
    toast.show("The hatch is sealed, but the wood remembers your hands.");
    return;
  }

  if (nearby?.type === "secret-item") {
    if (!state.worldState.hiddenItemFound) {
      state.worldState.hiddenItemFound = true;
      state.player.inventory.push("moon thread");
      toast.show("Hidden item found: moon thread.");
      questReward(state, "forest charm", toast);
      saveAutosave(state);
    }
    return;
  }

  if (nearby?.type === "item") {
    handleItemPickup(state, nearby.item, nearby.quest, toast);
    if (nearby.item === "smith hammer") {
      completeQuest(state, "smithHammer");
      questReward(state, "smith bracer", toast);
    }
    if (nearby.item === "lantern shard") {
      updateQuestProgress(state, "brokenLantern", 4);
      state.player.inventory.push("lantern shard");
      toast.show("Collected the lantern shard.");
    }
    return;
  }

  if (nearby?.type === "merchant") {
    openDialogue(state, "merchant");
    return;
  }

  const npc = scene.npcs.find((actor) => {
    const dx = Math.abs(actor.x - state.player.x);
    const dy = Math.abs(actor.y - state.player.y);
    return dx <= 1.25 && dy <= 1.25;
  });
  if (npc) {
    if (npc.id === "fox") openDialogue(state, "foxIntro");
    else openDialogue(state, npc.id);
    return;
  }

  toast.show("Nothing to interact with here.");
}

function updateCombat(state, dt, toast) {
  const combat = state.combat;
  if (!combat?.enemy) return;
  const enemy = combat.enemy;
  const px = state.player.x;
  const py = state.player.y;
  const dx = px - enemy.x;
  const dy = py - enemy.y;
  const distance = Math.hypot(dx, dy);
  enemy.vx = distance > 0.1 ? (dx / distance) * 1.8 : 0;
  enemy.vy = distance > 0.1 ? (dy / distance) * 1.8 : 0;
  enemy.x += enemy.vx * dt * 2;
  enemy.y += enemy.vy * dt * 2;
  if (distance < 1.2) {
    state.player.health = Math.max(0, state.player.health - 18 * dt);
    if (state.player.health <= 0) {
      state.player.health = state.player.maxHealth;
      state.player.energy = state.player.maxEnergy;
      state.player.x = 9;
      state.player.y = 8;
      state.scene = "home";
      state.location = "Foxglove House";
      state.mode = "playing";
      state.combat = null;
      toast.show("You wake at home, less healthy but still not dead.");
      saveAutosave(state);
    }
  }
}

function playerMove(state, scene, input, dt) {
  const speed = input.run && state.player.energy > 8 ? 3.2 : 2.2;
  let dx = 0;
  let dy = 0;
  if (input.left) dx -= 1;
  if (input.right) dx += 1;
  if (input.up) dy -= 1;
  if (input.down) dy += 1;
  const norm = Math.hypot(dx, dy) || 1;
  dx /= norm;
  dy /= norm;
  const moveX = dx * speed * dt;
  const moveY = dy * speed * dt;
  state.player.moving = Boolean(dx || dy);
  if (dx < 0) state.player.direction = "left";
  if (dx > 0) state.player.direction = "right";
  if (dy < 0) state.player.direction = "up";
  if (dy > 0) state.player.direction = "down";

  const nextX = clamp(state.player.x + moveX, 1, scene.width - 2);
  const nextY = clamp(state.player.y + moveY, 1, scene.height - 2);
  const solidTile = tileAt(scene, Math.round(nextX), Math.round(state.player.y));
  const solidTileY = tileAt(scene, Math.round(state.player.x), Math.round(nextY));
  if (!isSolidTile(solidTile)) state.player.x = nextX;
  if (!isSolidTile(solidTileY)) state.player.y = nextY;

  if (input.run && state.player.energy > 0 && state.player.moving) {
    state.player.energy = Math.max(0, state.player.energy - dt * 20);
  } else {
    state.player.energy = Math.min(state.player.maxEnergy, state.player.energy + dt * 10);
  }
}

function updateCamera(state, dt) {
  const targetX = state.player.x * TILE_SIZE - VIEW_WIDTH / 2 + TILE_SIZE / 2;
  const targetY = state.player.y * TILE_SIZE - VIEW_HEIGHT / 2 + TILE_SIZE / 2;
  state.camera.x = lerp(state.camera.x, targetX, 0.08 + dt * 0.04);
  state.camera.y = lerp(state.camera.y, targetY, 0.08 + dt * 0.04);
  state.camera.x = clamp(state.camera.x, 0, getScene(state.scene).width * TILE_SIZE - VIEW_WIDTH);
  state.camera.y = clamp(state.camera.y, 0, getScene(state.scene).height * TILE_SIZE - VIEW_HEIGHT);
}

function maybeAdvanceTime(state, dt) {
  state.minutes += dt * 0.5;
  if (state.minutes >= 24 * 60) {
    state.minutes -= 24 * 60;
    state.day += 1;
  }
  if (state.minutes < 6 * 60) state.timeLabel = "Night";
  else if (state.minutes < 10 * 60) state.timeLabel = "Dawn";
  else if (state.minutes < 15 * 60) state.timeLabel = "Afternoon";
  else if (state.minutes < 19 * 60) state.timeLabel = "Evening";
  else state.timeLabel = "Night";
}

function updateWeather(state) {
  if (state.scene === "forest") state.weather = state.worldState.wispDefeated ? "leaves" : "fog";
  else if (state.scene === "village" && !state.flags.lanternRestored) state.weather = state.timeLabel === "Evening" ? "fog" : "clear";
  else if (state.scene === "home") state.weather = "clear";
}

function renderUIOverlays(refs, state) {
  const existing = {
    title: refs.overlayLayer.querySelector("[data-title-screen]"),
    journal: refs.overlayLayer.querySelector("[data-journal-panel]"),
    map: refs.overlayLayer.querySelector("[data-map-panel]"),
    inventory: refs.overlayLayer.querySelector("[data-inventory-panel]"),
    save: refs.overlayLayer.querySelector("[data-save-panel]"),
    ending: refs.overlayLayer.querySelector("[data-ending-panel]"),
    dialogue: refs.overlayLayer.querySelector(".dialogue-panel"),
    editor: refs.overlayLayer.querySelector(".title-card"),
    pause: refs.overlayLayer.querySelector("[data-pause-panel]"),
  };
  return existing;
}

function startGame(root) {
  const refs = initDOM(root);
  const toast = makeToastStack(refs.overlayLayer);
  const audio = createAudioDirector();
  const input = createInputState();
  let running = true;
  let last = performance.now();
  let blinkClock = 0;
  let introShown = false;
  let savePromptShown = false;
  let titlePanel = null;
  let savePanel = null;
  let pausePanel = null;
  let endingPanel = null;
  let journalPanel = null;
  let mapPanel = null;
  let inventoryPanel = null;
  const canvas = refs.canvas;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  const save = loadLatestSave();
  const state = hydrateStateFromSave(save);
  audio.start();
  audio.setScene(state.scene);

  function clearModalPanels() {
    for (const panel of [titlePanel, savePanel, pausePanel, endingPanel, journalPanel, mapPanel, inventoryPanel]) {
      panel?.remove();
    }
    titlePanel = savePanel = pausePanel = endingPanel = journalPanel = mapPanel = inventoryPanel = null;
  }

  function openTitleScreen() {
    clearModalPanels();
    state.mode = "title";
    refs.fade.classList.remove("is-visible");
    titlePanel = buildPanelList("Alderwood", createStartScreenHTML(state));
    titlePanel.querySelector("[data-close]")?.addEventListener("click", () => {
      titlePanel?.remove();
      state.mode = "playing";
    });
    const newGame = () => {
      titlePanel?.remove();
      startNewGame(state, refs, toast, audio, () => {
        state.mode = "cutscene";
        openIntroCutscene();
      });
    };
    titlePanel.querySelector("[data-new-game]")?.addEventListener("click", newGame);
    titlePanel.querySelector("[data-continue]")?.addEventListener("click", () => {
      if (save) {
        state.mode = "playing";
        state.player.name = save.name ?? state.player.name;
        toast.show("Continuing from autosave.");
        refs.fade.classList.remove("is-visible");
      }
    });
    titlePanel.querySelector("[data-saves]")?.addEventListener("click", openSavePanel);
    refs.overlayLayer.appendChild(titlePanel);
    state.ui.titleOpen = true;
  }

  function openSavePanel() {
    savePanel?.remove();
    savePanel = buildPanelList("Save System", createSavePanelHTML(state));
    savePanel.querySelector("[data-close]").addEventListener("click", () => {
      savePanel?.remove();
      savePanel = null;
    });
    savePanel.querySelectorAll("[data-save-slot]").forEach((button) =>
      button.addEventListener("click", () => {
        const slot = Number(button.getAttribute("data-save-slot"));
        saveSlot(slot, state);
        toast.show(`Saved to slot ${slot}.`);
      }),
    );
    savePanel.querySelectorAll("[data-load-slot]").forEach((button) =>
      button.addEventListener("click", () => {
        const slot = Number(button.getAttribute("data-load-slot"));
        const loaded = loadSlot(slot) ?? loadLatestSave();
        if (loaded) {
          Object.assign(state, hydrateStateFromSave(loaded));
          state.mode = "playing";
          savePanel?.remove();
          toast.show(`Loaded slot ${slot}.`);
        } else {
          toast.show("That slot is empty.");
        }
      }),
    );
    savePanel.querySelectorAll("[data-delete-slot]").forEach((button) =>
      button.addEventListener("click", () => {
        const slot = Number(button.getAttribute("data-delete-slot"));
        if (window.confirm(`Delete slot ${slot}? This cannot be undone.`)) {
          deleteSlot(slot);
          toast.show(`Slot ${slot} deleted.`);
          savePanel?.remove();
          openSavePanel();
        }
      }),
    );
    savePanel.querySelector("[data-export-save]").addEventListener("click", () => {
      const output = exportSaveData();
      const field = savePanel.querySelector("[data-save-data]");
      field.value = output;
      field.focus();
      field.select();
      navigator.clipboard?.writeText(output).catch(() => {});
      toast.show("Save data exported to the text box.");
    });
    savePanel.querySelector("[data-import-save]").addEventListener("click", () => {
      const field = savePanel.querySelector("[data-save-data]");
      try {
        const imported = importSaveData(field.value);
        Object.assign(state, hydrateStateFromSave(imported));
        state.mode = "playing";
        toast.show("Save data imported.");
        savePanel?.remove();
      } catch (error) {
        toast.show(error.message);
      }
    });
    refs.overlayLayer.appendChild(savePanel);
    state.ui.saveOpen = true;
  }

  function openPauseMenu() {
    pausePanel?.remove();
    pausePanel = buildPanelList("Menu", `
      <div class="story-card">
        <h3>Chapter ${state.chapter}</h3>
        <p>${chapterSummary(state)}</p>
      </div>
      <div class="save-actions" style="margin-top:0.75rem">
        <button class="btn btn--accent" type="button" data-resume>Resume</button>
        <button class="btn btn--ghost" type="button" data-open-journal>Journal</button>
        <button class="btn btn--ghost" type="button" data-open-map>Map</button>
        <button class="btn btn--ghost" type="button" data-open-inventory>Inventory</button>
        <button class="btn btn--ghost" type="button" data-open-save>Save</button>
        <button class="btn btn--ghost" type="button" data-return-title>Return to title</button>
      </div>
    `);
    pausePanel.querySelector("[data-close]").addEventListener("click", () => {
      pausePanel?.remove();
      pausePanel = null;
      state.mode = "playing";
    });
    pausePanel.querySelector("[data-resume]").addEventListener("click", () => {
      pausePanel?.remove();
      pausePanel = null;
      state.mode = "playing";
    });
    pausePanel.querySelector("[data-open-journal]").addEventListener("click", () => {
      openJournal();
    });
    pausePanel.querySelector("[data-open-map]").addEventListener("click", () => {
      openMap();
    });
    pausePanel.querySelector("[data-open-inventory]").addEventListener("click", () => {
      openInventory();
    });
    pausePanel.querySelector("[data-open-save]").addEventListener("click", () => {
      openSavePanel();
    });
    pausePanel.querySelector("[data-return-title]").addEventListener("click", () => {
      clearAutosave();
      openTitleScreen();
    });
    refs.overlayLayer.appendChild(pausePanel);
  }

  function openJournal() {
    journalPanel?.remove();
    journalPanel = buildPanelList("Quest Journal", createJournalHTML(state));
    journalPanel.setAttribute("data-journal-panel", "true");
    journalPanel.querySelector("[data-close]").addEventListener("click", () => journalPanel?.remove());
    refs.overlayLayer.appendChild(journalPanel);
  }

  function openMap() {
    mapPanel?.remove();
    mapPanel = buildPanelList("World Map", createMapHTML(state));
    mapPanel.setAttribute("data-map-panel", "true");
    mapPanel.querySelector("[data-close]").addEventListener("click", () => mapPanel?.remove());
    refs.overlayLayer.appendChild(mapPanel);
  }

  function openInventory() {
    inventoryPanel?.remove();
    inventoryPanel = buildPanelList("Inventory", createInventoryHTML(state));
    inventoryPanel.setAttribute("data-inventory-panel", "true");
    inventoryPanel.querySelector("[data-close]").addEventListener("click", () => inventoryPanel?.remove());
    refs.overlayLayer.appendChild(inventoryPanel);
  }

  function openEndingPanel() {
    endingPanel?.remove();
    endingPanel = document.createElement("section");
    endingPanel.setAttribute("data-ending-panel", "true");
    endingPanel.innerHTML = createEndingHTML(state);
    endingPanel.className = "panel title-card";
    endingPanel.querySelector("[data-new-game-plus]").addEventListener("click", () => {
      const reset = createState();
      reset.flags.newGamePlusUnlocked = true;
      reset.unlockedOutfits = {
        ...reset.unlockedOutfits,
        ...state.unlockedOutfits,
        hairstyles: [...new Set([...(state.unlockedOutfits.hairstyles ?? []), "fox-tuft"])],
      };
      reset.player.appearance = mergeAppearance(reset.player.appearance, state.player.appearance);
      Object.assign(state, reset);
      state.mode = "playing";
      startNewGame(state, refs, toast, audio, () => {
        state.mode = "cutscene";
        openIntroCutscene();
      });
    });
    endingPanel.querySelector("[data-return-title]").addEventListener("click", () => {
      openTitleScreen();
    });
    refs.overlayLayer.appendChild(endingPanel);
  }

  function openIntroCutscene() {
    if (introShown) return;
    introShown = true;
    state.mode = "cutscene";
    triggerCutscene(
      state,
      refs,
      toast,
      "Dawn settles on Alderwood. A fox is arguing with the wind near your bed, and the lantern in the village square has gone dark. Ember says you used to know why.",
      () => {
        state.mode = "playing";
        state.scene = "home";
        state.location = "Foxglove House";
        state.player.x = 9;
        state.player.y = 8;
        state.player.health = 100;
        state.player.energy = 100;
        audio.setScene("home");
        saveAutosave(state);
      },
    );
  }

  function handleCombatAction() {
    if (state.mode !== "combat" || !state.combat?.enemy) return;
    if (state.player.attackCooldown > 0) return;
    const enemy = state.combat.enemy;
    const dist = Math.hypot(state.player.x - enemy.x, state.player.y - enemy.y);
    if (dist < 2) {
      enemy.health -= 8;
      state.player.attackCooldown = 0.3;
      spawnSparkles(state, enemy.x * TILE_SIZE, enemy.y * TILE_SIZE, "#ffc6ed", 6);
      if (enemy.health <= 0) {
        state.combat = null;
        state.mode = "playing";
        state.worldState.wispDefeated = true;
        state.player.inventory.push("lantern shard");
        updateQuestProgress(state, "brokenLantern", 3);
        toast.show("The wisp dissolves, leaving a lantern shard behind.");
        completeQuest(state, "smithHammer");
        audio.setScene(state.scene);
        saveAutosave(state);
      }
    } else {
      toast.show("Too far away to hit.");
    }
  }

  function finalizeDialogIfReady() {
    if (state.mode === "dialogue" && !state.dialogue) {
      state.mode = "playing";
      state.ui.dialogueOpen = false;
    }
  }

  function updateLoop(now) {
    if (!running) return;
    const dt = Math.min(0.032, (now - last) / 1000);
    last = now;
    blinkClock += dt;

    if (state.mode === "playing" || state.mode === "combat") {
      const scene = getScene(state.scene);
      if (state.mode === "playing") {
        playerMove(state, scene, input, dt);
      }
      updateCamera(state, dt);
      maybeAdvanceTime(state, dt);
      updateWeather(state);
      updateParticles(state, dt);
      if (state.player.attackCooldown > 0) state.player.attackCooldown = Math.max(0, state.player.attackCooldown - dt);
      if (state.mode === "combat") updateCombat(state, dt, toast);
      if (input.interact || input.action) {
        input.interact = input.action = false;
        useCurrentInteraction(state, refs, toast, audio);
      }
      if (input.attack) {
        input.attack = false;
        handleCombatAction();
      }
      const nearby = activeNearbyInteractable(state, scene);
      updateHUD(refs, state, scene, sceneMusic(state.scene));
      refs.hint.textContent = currentHintText(state, scene, nearby);
    }

    if (state.mode === "dialogue") {
      updateDialoguePanel(refs, state, canvas, () => {});
      updateHUD(refs, state, getScene(state.scene), sceneMusic(state.scene));
    } else {
      const panel = refs.overlayLayer.querySelector(".dialogue-panel");
      if (panel) panel.remove();
    }

    if (state.mode === "ending") {
      if (!endingPanel) openEndingPanel();
      updateHUD(refs, state, getScene(state.scene), sceneMusic(state.scene));
    } else if (endingPanel) {
      endingPanel.remove();
      endingPanel = null;
    }

    if (state.transition) {
      state.transition.alpha = Math.max(0, state.transition.alpha - dt * 2.5);
      refs.fade.classList.toggle("is-visible", state.transition.alpha > 0.05);
      if (state.transition.alpha <= 0.05) {
        state.transition = null;
        refs.fade.classList.remove("is-visible");
      }
    }

    const scene = getScene(state.scene);
    ctx.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    drawScene(ctx, scene, state.camera, now / 1000, state.weather, state);
    drawPropsAndActors(ctx, scene, state, now / 1000, Math.floor(blinkClock * 4) % 2 === 0);

    // Player sprite.
    drawAvatar(
      ctx,
      state.player.appearance,
      state.player.x * TILE_SIZE - state.camera.x + TILE_SIZE / 2,
      state.player.y * TILE_SIZE - state.camera.y + TILE_SIZE / 2 + 2,
      18,
      { view: "topdown", blink: Math.floor(blinkClock * 5) % 2 === 0, facing: state.player.direction },
    );

    // Simple status bars.
    ctx.fillStyle = "rgba(6,8,12,0.85)";
    ctx.fillRect(12, 12, 156, 34);
    ctx.fillStyle = "#fff2bf";
    ctx.fillRect(16, 16, clamp(state.player.health, 0, state.player.maxHealth) * 1.4, 8);
    ctx.fillStyle = "#83d8af";
    ctx.fillRect(16, 28, clamp(state.player.energy, 0, state.player.maxEnergy) * 1.4, 6);
    ctx.fillStyle = "#f1e4c9";
    ctx.fillText?.("HP", 0, 0);

    saveAutosave(state);

    requestAnimationFrame(updateLoop);
  }

  function handleKeyboardDown(event) {
    if (event.repeat) return;
    switch (event.key.toLowerCase()) {
      case "w":
      case "arrowup":
        input.up = true;
        break;
      case "s":
      case "arrowdown":
        input.down = true;
        break;
      case "a":
      case "arrowleft":
        input.left = true;
        break;
      case "d":
      case "arrowright":
        input.right = true;
        break;
      case "shift":
        input.run = true;
        break;
      case "e":
      case " ":
        input.interact = true;
        break;
      case "enter":
        input.confirm = true;
        break;
      case "escape":
        if (state.mode === "dialogue") {
          state.dialogue = null;
          state.mode = "playing";
          refs.overlayLayer.querySelector(".dialogue-panel")?.remove();
        } else if (state.mode === "playing" || state.mode === "combat") {
          state.mode = "paused";
          openPauseMenu();
        } else if (state.mode === "paused") {
          pausePanel?.remove();
          pausePanel = null;
          state.mode = "playing";
        }
        break;
      case "i":
        openJournal();
        break;
      case "m":
        openMap();
        break;
      case "q":
        openInventory();
        break;
      case "f":
        input.attack = true;
        break;
      default:
        break;
    }
  }

  function handleKeyboardUp(event) {
    switch (event.key.toLowerCase()) {
      case "w":
      case "arrowup":
        input.up = false;
        break;
      case "s":
      case "arrowdown":
        input.down = false;
        break;
      case "a":
      case "arrowleft":
        input.left = false;
        break;
      case "d":
      case "arrowright":
        input.right = false;
        break;
      case "shift":
        input.run = false;
        break;
      default:
        break;
    }
  }

  function attachMobileControls() {
    refs.mobileControls.querySelectorAll("[data-key]").forEach((button) => {
      const key = button.getAttribute("data-key");
      const set = (value) => {
        if (key === "up") input.up = value;
        if (key === "down") input.down = value;
        if (key === "left") input.left = value;
        if (key === "right") input.right = value;
        if (key === "run") input.run = value;
        if (key === "interact") input.interact = value;
        if (key === "attack") input.attack = value;
      };
      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        set(true);
        audio.start();
      });
      button.addEventListener("pointerup", () => set(false));
      button.addEventListener("pointercancel", () => set(false));
      button.addEventListener("pointerleave", () => set(false));
    });
  }

  function attachHeaderButtons() {
    refs.buttons.journal.addEventListener("click", openJournal);
    refs.buttons.map.addEventListener("click", openMap);
    refs.buttons.inventory.addEventListener("click", openInventory);
    refs.buttons.save.addEventListener("click", openSavePanel);
    refs.buttons.menu.addEventListener("click", openPauseMenu);
  }

  function attachGlobalListeners() {
    window.addEventListener("keydown", handleKeyboardDown);
    window.addEventListener("keyup", handleKeyboardUp);
    window.addEventListener("pointerdown", () => audio.start(), { once: true });
    canvas.addEventListener("pointerdown", () => {
      audio.start();
      input.interact = true;
    });
  }

  function cleanup() {
    running = false;
    window.removeEventListener("keydown", handleKeyboardDown);
    window.removeEventListener("keyup", handleKeyboardUp);
  }

  attachMobileControls();
  attachHeaderButtons();
  attachGlobalListeners();
  if (save && !savePromptShown) {
    savePromptShown = true;
    toast.show("Autosave restored. Continue, because the village definitely did not wait for you.");
  }
  if (!save) {
    openTitleScreen();
  } else {
    state.mode = "playing";
    state.player.name = save.name ?? state.player.name;
    if (!state.flags.introSeen) {
      openIntroCutscene();
      state.flags.introSeen = true;
    }
  }

  requestAnimationFrame(updateLoop);

  // Keep the quest state fresh from ambient discoveries.
  const stateInterval = window.setInterval(() => {
    updateQuestStateForScene(state);
    if (state.endingProgress.storyComplete) {
      state.flags.newGamePlusUnlocked = true;
    }
    const snapshot = createSaveState(state);
    state.savedAt = snapshot.savedAt;
  }, 3000);

  return () => {
    cleanup();
    window.clearInterval(stateInterval);
  };
}

export { startGame };
