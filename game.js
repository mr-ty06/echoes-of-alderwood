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
const FACTIONS = {
  villagers: "Alderwood Villagers",
  merchants: "Merchants Guild",
  spirits: "Forest Spirits",
  guardians: "Ancient Guardians",
};
const MEMORY_FRAGMENTS = [
  {
    id: "house-stairs",
    name: "Beneath the Stairs",
    scene: "home",
    location: "Foxglove House",
    summary: "A pulse of lantern light, a child's laugh, and hands painting a ward beneath the floorboards.",
    flashback: "You remember kneeling beneath the house stairs, helping someone hide a ribbon of moon-thread before the world went cold.",
    ability: "memory-sense",
    unlocksLocation: "Hidden Stair Cache",
  },
  {
    id: "square-lantern",
    name: "Square Lantern",
    scene: "village",
    location: "Alderwood Village",
    summary: "A memory of oil, soot, and five lanterns glowing like a promise over the village square.",
    flashback: "The square was once bright enough to make every doorstep look safe. You were there when the lanterns were tended, and you knew the oath by heart.",
    ability: "lantern-sense",
    unlocksLocation: "Lantern Walk",
  },
  {
    id: "forest-spring",
    name: "Forest Spring",
    scene: "forest",
    location: "Whispering Forest",
    summary: "Sprig deer, wet moss, and the taste of rain on your tongue as the forest swore itself to the light.",
    flashback: "You can almost hear the forest answering your name. The spirits remember a hand placed in the spring and a promise to come back.",
    ability: "sniff",
    unlocksLocation: "Root Hollow",
  },
  {
    id: "merchant-road",
    name: "Merchant Road",
    scene: "village",
    location: "Travelling Stall",
    summary: "A bargain that went badly, a map marked in charcoal, and a warning about the kingdoms beyond the hills.",
    flashback: "A merchant handed you a sealed map and told you the world would not forgive hesitation. That felt like advice and a threat.",
    ability: "barter",
    unlocksLocation: "Hidden Trade Route",
  },
  {
    id: "guardian-echo",
    name: "Guardian Echo",
    scene: "forest",
    location: "Corrupted Grove",
    summary: "Armor under ash. A guardian’s voice asking whether the light is worth the price.",
    flashback: "You remember standing before a guardian who was already being swallowed by the corruption. Someone made a choice that the village never spoke aloud.",
    ability: "ward-light",
    unlocksLocation: "Ashen Gate",
  },
];
const MEMORY_COUNT = MEMORY_FRAGMENTS.length;

function defaultReputation() {
  return { villagers: 0, merchants: 0, spirits: 0, guardians: 0 };
}

function defaultJournal() {
  return { achievements: [], charactersMet: [], endingsUnlocked: [] };
}

function defaultFoxState() {
  return {
    mood: "curious",
    alert: false,
    nearSecret: false,
    sleeping: false,
    celebrates: 0,
    hiddenHint: null,
  };
}

function knownMemoryById(memoryId) {
  return MEMORY_FRAGMENTS.find((entry) => entry.id === memoryId) ?? null;
}

function phaseLabelForMinutes(minutes) {
  if (minutes < 6 * 60) return "Night";
  if (minutes < 10 * 60) return "Dawn";
  if (minutes < 13 * 60) return "Morning";
  if (minutes < 17 * 60) return "Afternoon";
  if (minutes < 20 * 60) return "Evening";
  return "Night";
}

function weatherForState(state) {
  const phase = phaseLabelForMinutes(state.minutes);
  const wintery = state.day % 4 === 0 || state.chapter >= 4;
  if (state.scene === "home") return phase === "Night" ? "rain" : "clear";
  if (state.scene === "forest") {
    if (wintery && phase === "Evening") return "snow";
    if (state.worldState.wispDefeated) return phase === "Evening" ? "leaves" : "fog";
    if (phase === "Night") return "thunder";
    if (phase === "Morning") return "fog";
    return "rain";
  }
  if (wintery && phase === "Night") return "snow";
  if (phase === "Night") return "fog";
  if (phase === "Evening") return "leaves";
  return phase === "Morning" ? "clear" : "rain";
}

function factionLabel(faction) {
  return FACTIONS[faction] ?? faction;
}

function clampReputation(value) {
  return clamp(value, -4, 4);
}

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
  let transitionTimer = null;

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
    ambience = { source, washGain, filter };
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
      if (transitionTimer) window.clearTimeout(transitionTimer);
      if (context && gain) {
        const now = context.currentTime;
        gain.gain.cancelScheduledValues(now);
        gain.gain.setTargetAtTime(0.012, now, 0.05);
        transitionTimer = window.setTimeout(() => {
          currentScene = sceneId;
          timer = 0;
          step = 0;
          const later = context.currentTime;
          gain.gain.cancelScheduledValues(later);
          gain.gain.setTargetAtTime(0.04, later, 0.09);
        }, 180);
        return;
      }
      currentScene = sceneId;
      timer = 0;
      step = 0;
    },
    tick(dt, state) {
      if (!context || !gain) return;
      if (ambience) {
        const weather = state?.weather ?? "clear";
        const weatherProfiles = {
          clear: { volume: currentScene === "village" ? 0.12 : 0.18, frequency: currentScene === "forest" ? 620 : 420 },
          rain: { volume: 0.48, frequency: 1200 },
          fog: { volume: 0.2, frequency: 280 },
          thunder: { volume: 0.58, frequency: 210 },
          leaves: { volume: 0.32, frequency: 760 },
          snow: { volume: 0.1, frequency: 170 },
        };
        const profile = weatherProfiles[weather] ?? weatherProfiles.clear;
        ambience.washGain.gain.setTargetAtTime(profile.volume, context.currentTime, 0.25);
        ambience.filter.frequency.setTargetAtTime(profile.frequency, context.currentTime, 0.3);
      }
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
        if (currentScene === "village" && state?.weather === "clear" && step % 8 === 3) {
          note(config.root * 2.5, 0.08, "sine", 0.08);
        }
        if (currentScene === "forest" && state?.weather === "thunder" && step % 8 === 0) {
          note(52, beat * 2.2, "sawtooth", 0.08);
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
    reputation: defaultReputation(),
    memoryFragments: [],
    memoryFlashbacks: [],
    discoveredCharacters: [],
    unlockedEndings: [],
    journal: defaultJournal(),
    foxState: defaultFoxState(),
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
    weatherCycle: 0,
    screenShake: 0,
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
      modalOpen: false,
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
      forestPuzzleSolved: false,
      hiddenItemFound: false,
      wispDefeated: false,
      lanternRestored: false,
      chapterChoiceMade: false,
      discoveredSecrets: [],
      hiddenLocations: [],
      ambientStory: [],
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
  state.reputation = { ...defaultReputation(), ...(save.reputation ?? save.factions ?? {}) };
  state.memoryFragments = [...new Set(save.memoryFragments ?? [])];
  state.memoryFlashbacks = save.memoryFlashbacks ?? [];
  state.discoveredCharacters = save.discoveredCharacters ?? [];
  state.unlockedEndings = save.unlockedEndings ?? [];
  state.journal = { ...defaultJournal(), ...(save.journal ?? {}) };
  state.foxState = { ...defaultFoxState(), ...(save.foxState ?? {}) };
  state.minutes = save.gameTime?.minutes ?? state.minutes;
  state.day = save.gameTime?.day ?? state.day;
  state.weather = save.gameTime?.weather ?? state.weather;
  state.weatherCycle = save.gameTime?.weatherCycle ?? state.weatherCycle;
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
  } else if (weather === "thunder") {
    ctx.fillStyle = "rgba(195, 220, 255, 0.08)";
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    ctx.fillStyle = "rgba(244, 247, 255, 0.18)";
    ctx.fillRect((Math.sin(t * 5) + 1) * VIEW_WIDTH * 0.3, 0, VIEW_WIDTH * 0.4, VIEW_HEIGHT);
  } else if (weather === "snow") {
    ctx.fillStyle = "rgba(237, 242, 255, 0.85)";
    for (let i = 0; i < 36; i += 1) {
      const x = (i * 91 + t * 32) % VIEW_WIDTH;
      const y = (i * 43 + t * 60) % VIEW_HEIGHT;
      ctx.fillRect(x, y, 2, 2);
    }
  }

  // Ambient darkness deepens as the story begins to fray.
  const dusk = state.flags.lanternRestored ? 0.02 : scene.id === "forest" ? 0.18 : 0.1;
  ctx.fillStyle = `rgba(6, 8, 12, ${dusk + Math.max(0, Math.sin(t * 0.05) * 0.02)})`;
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

  const isNight = state.timeLabel === "Night";
  if (isNight || weather === "thunder") {
    const glow = ctx.createRadialGradient(
      VIEW_WIDTH * 0.52,
      VIEW_HEIGHT * 0.58,
      24,
      VIEW_WIDTH * 0.52,
      VIEW_HEIGHT * 0.58,
      240,
    );
    glow.addColorStop(0, "rgba(255, 230, 150, 0.18)");
    glow.addColorStop(0.5, "rgba(255, 230, 150, 0.06)");
    glow.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    ctx.fillStyle = "rgba(0,0,0,0.16)";
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  }
}

function drawPropsAndActors(ctx, scene, state, t, blinkOn) {
  const camera = state.camera;
  const drawEntity = (entity, colorSet = {}) => {
    const sx = entity.x * TILE_SIZE - camera.x;
    const sy = entity.y * TILE_SIZE - camera.y;
    if (sx < -40 || sy < -40 || sx > VIEW_WIDTH + 40 || sy > VIEW_HEIGHT + 40) return;

    if (entity.kind === "fox") {
      const mood = state.foxState?.mood ?? "curious";
      ctx.save();
      ctx.translate(Math.round(sx + TILE_SIZE / 2), Math.round(sy + TILE_SIZE / 2 + 2));
      const base = mood === "nervous" ? "#ba6a35" : mood === "sleepy" ? "#b87343" : "#d67c43";
      const shadow = mood === "nervous" ? "#7a3f1f" : "#8d4d28";
      ctx.fillStyle = base;
      ctx.fillRect(-6, -5, 12, 8);
      ctx.fillStyle = shadow;
      ctx.fillRect(-5, -2, 10, 4);
      ctx.fillStyle = "#fff0c8";
      ctx.fillRect(-2, -1, 1, 1);
      ctx.fillRect(1, -1, 1, 1);
      ctx.fillRect(-1, 2, 2, 1);
      if (mood === "excited") {
        ctx.fillStyle = "#f3d48a";
        ctx.fillRect(5, -7, 2, 5);
        ctx.fillRect(-7, -7, 2, 5);
      }
      if (mood === "sleepy") {
        ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
        ctx.fillRect(-4, -7, 8, 2);
      }
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
    if (npc.hidden) continue;
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
      <div class="hud-chip">Standing <strong data-standing>Neutral</strong></div>
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
    standing: header.querySelector("[data-standing]"),
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
  const villagers = state.reputation?.villagers ?? 0;
  const merchants = state.reputation?.merchants ?? 0;
  const spirits = state.reputation?.spirits ?? 0;
  const guardians = state.reputation?.guardians ?? 0;
  refs.standing.textContent = `${villagers >= 0 ? "+" : ""}${villagers}/${merchants >= 0 ? "+" : ""}${merchants}/${spirits >= 0 ? "+" : ""}${spirits}/${guardians >= 0 ? "+" : ""}${guardians}`;
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

function buildPanelList(title, bodyHTML, options = {}) {
  const panel = document.createElement("section");
  panel.className = `panel panel--floating ${options.className ?? ""}`.trim();
  panel.innerHTML = `
    <div class="modal-header">
      <div class="modal-title">
        <h2>${title}</h2>
        ${options.subtitle ? `<p>${options.subtitle}</p>` : ""}
      </div>
      <button type="button" class="btn btn--ghost modal-close" data-close>Close</button>
    </div>
    <div class="modal-body">${bodyHTML}</div>
    ${options.footerHTML ? `<div class="modal-footer">${options.footerHTML}</div>` : ""}
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

function trackerCard(label, value, known = true, extra = "") {
  return `
    <article class="tracker-card ${known ? "" : "tracker-card--unknown"}">
      <h4>${known ? label : "???"}</h4>
      <p>${known ? value : "???".repeat(1)}</p>
      ${extra ? `<span class="tracker-card__meta">${extra}</span>` : ""}
    </article>
  `;
}

function createJournalHTML(state) {
  const story = CHAPTERS.map((chapter) => {
    const active = chapter.id <= state.chapter || state.endingProgress.storyComplete;
    return trackerCard(
      `Chapter ${chapter.id}`,
      active ? chapter.title : "???",
      active,
      active ? chapter.summary : "Unknown chapter",
    );
  }).join("");

  const sideQuests = getJournalEntries(state)
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
            <span>${progress.status === "completed" ? "Completed" : questStepLabel(quest, state)}</span>
            <span>${progress.status === "completed" ? "Done" : `${current}/${steps}`}</span>
          </div>
          <div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div>
        </article>
      `;
    })
    .join("");

  const memoryCards = MEMORY_FRAGMENTS.map((fragment) => {
    const discovered = state.memoryFragments.includes(fragment.id);
    return `
      <article class="tracker-card ${discovered ? "" : "tracker-card--unknown"}">
        <h4>${discovered ? fragment.name : "???"}</h4>
        <p>${discovered ? fragment.summary : "A memory fragment has not yet been recovered."}</p>
        <span class="tracker-card__meta">${discovered ? fragment.location : "Hidden"}</span>
      </article>
    `;
  }).join("");

  const characters = [
    "Ember",
    "Elder Rowan",
    "Tilda",
    "Brann",
    "Nia",
    "Moss Vale",
    "Sprig Deer",
    "Pip",
  ].map((name) => {
    const known = state.discoveredCharacters.includes(name);
    return trackerCard(name, known ? "Met" : "???", known, known ? "Remembered" : "Unknown");
  }).join("");

  const endings = ["restore", "memory", "guardian"].map((ending) => {
    const known = state.unlockedEndings.includes(ending) || state.endingProgress.lastEnding === ending;
    const label = ending === "restore" ? "Lanterns Restored" : ending === "memory" ? "Memory Sacrifice" : "New Guardian";
    return trackerCard(label, known ? "Unlocked" : "???", known, known ? "Ending recorded" : "Locked");
  }).join("");

  const collectibles = [
    state.player.inventory.includes("moon thread"),
    state.player.inventory.includes("lantern shard"),
    state.player.inventory.includes("memory shard"),
    state.player.inventory.includes("forest charm"),
    state.player.inventory.includes("warm shawl"),
    state.player.inventory.includes("smith bracer"),
  ]
    .map((known, index) => {
      const names = ["Moon Thread", "Lantern Shard", "Memory Shard", "Forest Charm", "Warm Shawl", "Smith Bracer"];
      return trackerCard(names[index], known ? "Collected" : "???", known, known ? "Added to inventory" : "Hidden");
    })
    .join("");

  const outfitEntries = Object.entries(state.unlockedOutfits ?? {}).map(([group, list]) =>
    trackerCard(group, list?.length ? list.join(", ") : "???", Boolean(list?.length), "Unlocked cosmetics"),
  ).join("");

  const reputationCards = Object.entries(FACTIONS).map(([key, label]) => {
    const score = state.reputation?.[key] ?? 0;
    const known = state.journal?.charactersMet?.length > 0 || score !== 0;
    return trackerCard(label, known ? `Standing ${score > 0 ? "+" : ""}${score}` : "???", known, score >= 2 ? "Favoured" : score <= -2 ? "Wary" : "Neutral");
  }).join("");

  return `
    <div class="journal-sections">
      <section class="journal-section">
        <h3>Story Progress</h3>
        <div class="tracker-grid">${story}</div>
      </section>
      <section class="journal-section">
        <h3>Side Quests</h3>
        <div class="journal-grid">${sideQuests}</div>
      </section>
      <section class="journal-section">
        <h3>Characters Met</h3>
        <div class="tracker-grid">${characters}</div>
      </section>
      <section class="journal-section">
        <h3>Locations</h3>
        <div class="tracker-grid">${[...new Set(state.discoveredLocations)]
          .map((location) => trackerCard(location, location, true, "Discovered"))
          .join("") || trackerCard("???", "???", false, "Unknown")}
        </div>
      </section>
      <section class="journal-section">
        <h3>Memory Fragments</h3>
        <div class="tracker-grid">${memoryCards}</div>
      </section>
      <section class="journal-section">
        <h3>Collectibles</h3>
        <div class="tracker-grid">${collectibles}</div>
      </section>
      <section class="journal-section">
        <h3>Outfits</h3>
        <div class="tracker-grid">${outfitEntries}</div>
      </section>
      <section class="journal-section">
        <h3>Reputation</h3>
        <div class="tracker-grid">${reputationCards}</div>
      </section>
      <section class="journal-section">
        <h3>Endings</h3>
        <div class="tracker-grid">${endings}</div>
      </section>
    </div>
  `;
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
        <h3>Chapter ${chapter.id}</h3>
        <p>${chapter.title}</p>
      </article>
    `;
  }).join("");

  const discoveredTags = [...new Set([...(state.discoveredLocations ?? []), ...(state.worldState.hiddenLocations ?? [])])]
    .map((location) => `<span class="tag">${location}</span>`)
    .join("");

  const locations = getMapLocations(state)
    .map(
      (location) => `
        <button
          class="map-marker ${location.current ? "is-current" : ""} ${location.locked ? "is-locked" : ""}"
          type="button"
          data-location-id="${location.id}"
          style="left:${location.x}%; top:${location.y}%"
          ${location.locked ? "aria-disabled='true'" : ""}
        >${location.short}</button>
      `,
    )
    .join("");

  return `
    <div class="world-map" data-world-map>
      <div class="world-map__canvas">
        <div class="world-map__terrain"></div>
        ${locations}
      </div>
      <aside class="map-detail" data-map-detail>
        <div class="story-card">
          <div class="map-detail__name" data-map-name></div>
          <p data-map-description></p>
          <div class="map-detail__meta" data-map-meta></div>
        </div>
        <div class="story-card">
          <h3>Discovered Locations</h3>
          <div class="map-legend" data-map-tags>${discoveredTags || "<span class='tag tag--locked'>None yet</span>"}</div>
        </div>
      </aside>
    </div>
    <div class="story-grid" style="margin-top:0.9rem">${chapterCards}</div>
  `;
}

function getMapLocations(state) {
  const chapter = state.chapter ?? 1;
  const discoveredSet = new Set(state.discoveredLocations);
  return [
    {
      id: "home",
      name: "Foxglove House",
      short: "Home",
      description: "Your cottage at the edge of Alderwood, where the mirror remembers you before you do.",
      chapter: 1,
      x: 20,
      y: 78,
      type: "home",
      quest: "Mirror Wardrobe",
      discovered: true,
      current: state.scene === "home",
      locked: false,
    },
    {
      id: "village",
      name: "Alderwood Village",
      short: "Village",
      description: "The lantern square, bakery, forge, and all the people who will absolutely ask for favors.",
      chapter: 1,
      x: 35,
      y: 60,
      type: "village",
      quest: "The Broken Lantern",
      discovered: true,
      current: state.scene === "village",
      locked: false,
    },
    {
      id: "forest",
      name: "Whispering Forest",
      short: "Forest",
      description: "A living wood where the trees remember the old pact, and the moss is not entirely trustworthy.",
      chapter: 2,
      x: 52,
      y: 34,
      type: "forest",
      quest: "Forest Friends",
      discovered: chapter >= 2 || discoveredSet.has("The Whispering Forest"),
      current: state.scene === "forest",
      locked: chapter < 2 && !discoveredSet.has("The Whispering Forest"),
    },
    {
      id: "ruins",
      name: "Sunken Ruins",
      short: "Ruins",
      description: "Collapsed chambers below the hills, where the lanterns' history gets much less flattering.",
      chapter: 3,
      x: 68,
      y: 52,
      type: "ruins",
      quest: "The Sunken Ruins",
      discovered: chapter >= 3 || discoveredSet.has("The Sunken Ruins"),
      current: false,
      locked: chapter < 3,
    },
    {
      id: "river",
      name: "River Bend",
      short: "River",
      description: "The river that feeds the woods, the wells, and every bad idea involving stepping stones.",
      chapter: 2,
      x: 26,
      y: 40,
      type: "river",
      quest: "Forest Friends",
      discovered: chapter >= 2,
      current: false,
      locked: chapter < 2,
    },
    {
      id: "mountains",
      name: "Ashen Range",
      short: "Mountains",
      description: "Jagged peaks that frame the ruined kingdom and keep the storm clouds in place.",
      chapter: 4,
      x: 78,
      y: 18,
      type: "mountains",
      quest: "The Ashen Kingdom",
      discovered: chapter >= 4,
      current: false,
      locked: chapter < 4,
    },
    {
      id: "temple",
      name: "Forgotten Temple",
      short: "Temple",
      description: "A sealed sanctum where the final lantern was once tended by hands long gone.",
      chapter: 5,
      x: 84,
      y: 74,
      type: "temple",
    quest: "The Final Light",
      discovered: chapter >= 5,
      current: false,
      locked: chapter < 5,
    },
  ];
}

function populateMapDetails(container, location) {
  container.querySelector("[data-map-name]").textContent = location.name;
  container.querySelector("[data-map-description]").textContent = location.description;
  const meta = container.querySelector("[data-map-meta]");
  meta.innerHTML = `
    <span class="tag">Chapter ${location.chapter}</span>
    <span class="tag ${location.discovered ? "" : "tag--locked"}">${location.discovered ? "Discovered" : "Locked"}</span>
    <span class="tag ${location.current ? "tag--current" : ""}">${location.current ? "Current location" : "Current quest: " + location.quest}</span>
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
  const memories = new Set(state.memoryFragments ?? []);
  const villagers = state.reputation?.villagers ?? 0;
  const merchants = state.reputation?.merchants ?? 0;
  const spirits = state.reputation?.spirits ?? 0;
  const guardians = state.reputation?.guardians ?? 0;
  const content = {
    restore: {
      title: "Ending: Lanterns Restored",
      text:
        memories.has("square-lantern") && memories.has("forest-spring")
          ? "The lanterns burn again. Alderwood breathes easier, the fox keeps watch, and the village remembers the light because you remembered it first."
          : "The first lantern burns again. Alderwood breathes easier, and the fox keeps watch while the village begins to remember what hope feels like.",
    },
    memory: {
      title: "Ending: Memory Sacrifice",
      text:
        memories.has("house-stairs") && spirits > 0
          ? "You give up the memories feeding the corruption, but enough of your truth remains to leave a scar that Alderwood can heal around. The darkness thins, and the village survives because you chose the harder mercy."
          : "You give up the memories feeding the corruption. The darkness thins, but your name leaves with it. Alderwood survives because you chose to forget.",
    },
    guardian: {
      title: "Ending: New Guardian",
      text:
        guardians >= 2 || merchants >= 2
          ? "You take the corruption into yourself and stand between it and the village. The light bends around your shadow, and the old wards accept you because you learned which voices to trust."
          : "You take the corruption into yourself and stand between it and the village. The light bends around your shadow. Someone has to hold the line.",
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
  if (nearby?.type === "memory") return "Press E to recover a memory fragment.";
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
    if (state.worldState.forestPuzzleSolved) {
      updateQuestProgress(state, "puzzleOfRings", 3);
    }
  }
  if (state.worldState.lanternRestored) {
    completeQuest(state, "brokenLantern");
    registerAchievement(state, "Lantern Restored");
  }
  if (state.memoryFragments.length > 0) {
    registerAchievement(state, "Memory Restored");
  }
  if ((state.reputation.villagers ?? 0) >= 2) {
    registerAchievement(state, "Trusted by Alderwood");
  }
  if ((state.reputation.merchants ?? 0) >= 2) {
    registerAchievement(state, "Trusted by the Merchants Guild");
  }
  if ((state.reputation.spirits ?? 0) >= 2) {
    registerAchievement(state, "Favoured by the Forest Spirits");
  }
  if ((state.reputation.guardians ?? 0) >= 2) {
    registerAchievement(state, "Known to the Guardians");
  }
  if (state.foxState.nearSecret) {
    registerAchievement(state, "Fox Found a Secret");
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
  registerCharacter(state, dialogue.speaker);
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
    case "reputation": {
      const amount = typeof effect.value === "number" ? effect.value : 0;
      state.reputation[effect.key] = clampReputation((state.reputation[effect.key] ?? 0) + amount);
      break;
    }
    case "memory":
      collectMemoryFragment(state, effect.value, null);
      break;
    case "character":
      registerCharacter(state, effect.value);
      break;
    case "achievement":
      registerAchievement(state, effect.value);
      break;
    case "ability":
      if (effect.value && !state.player.abilities.includes(effect.value)) {
        state.player.abilities.push(effect.value);
      }
      break;
    case "ending":
      resolveEndingChoice(state, effect.value);
      break;
    default:
      break;
  }
}

function registerCharacter(state, characterName) {
  if (!characterName) return;
  if (!state.discoveredCharacters.includes(characterName)) {
    state.discoveredCharacters.push(characterName);
  }
  if (!state.journal.charactersMet.includes(characterName)) {
    state.journal.charactersMet.push(characterName);
  }
}

function registerAchievement(state, achievement) {
  if (!achievement) return;
  if (!state.journal.achievements.includes(achievement)) {
    state.journal.achievements.push(achievement);
  }
}

function adjustReputation(state, faction, amount) {
  if (!faction) return;
  state.reputation[faction] = clampReputation((state.reputation[faction] ?? 0) + amount);
}

function resolveEndingChoice(state, requested) {
  const keyFragments = new Set(state.memoryFragments);
  let ending = requested;
  if (requested === "restore" && (!keyFragments.has("square-lantern") || !keyFragments.has("forest-spring"))) {
    ending = "memory";
  }
  if (requested === "guardian" && (state.reputation.guardians ?? 0) < 1 && !keyFragments.has("guardian-echo")) {
    ending = "restore";
  }
  if (requested === "memory" && !keyFragments.has("house-stairs")) {
    ending = "guardian";
  }
  state.mode = "ending";
  state.ui.dialogueOpen = false;
  state.endingProgress.lastEnding = ending;
  state.endingProgress.storyComplete = true;
  state.flags.newGamePlusUnlocked = true;
  state.unlockedEndings = [...new Set([...(state.unlockedEndings ?? []), ending])];
  if (!state.journal.endingsUnlocked.includes(ending)) {
    state.journal.endingsUnlocked.push(ending);
  }
}

function collectMemoryFragment(state, fragmentId, toast = null) {
  const fragment = knownMemoryById(fragmentId);
  if (!fragment || state.memoryFragments.includes(fragment.id)) return false;
  state.memoryFragments.push(fragment.id);
  state.memoryFlashbacks.push({
    id: fragment.id,
    name: fragment.name,
    summary: fragment.summary,
    flashback: fragment.flashback,
    collectedAt: Date.now(),
  });
  registerAchievement(state, `Memory Fragment: ${fragment.name}`);
  if (fragment.ability && !state.player.abilities.includes(fragment.ability)) {
    state.player.abilities.push(fragment.ability);
  }
  if (fragment.unlocksLocation && !state.worldState.hiddenLocations.includes(fragment.unlocksLocation)) {
    state.worldState.hiddenLocations.push(fragment.unlocksLocation);
  }
  if (toast) {
    toast.show(`Memory fragment found: ${fragment.name}`);
  }
  return true;
}

function npcScheduleForTime(npc, phase) {
  const schedule = npc.schedule ?? null;
  if (!schedule) return null;
  return schedule[phase] ?? schedule.default ?? null;
}

function updateNpcSchedules(state, scene) {
  const phase = state.timeLabel ?? phaseLabelForMinutes(state.minutes);
  const severeWeather = ["rain", "thunder", "snow"].includes(state.weather);
  for (const npc of scene.npcs ?? []) {
    const target = npcScheduleForTime(npc, phase);
    if (!target) continue;
    npc.x = target.x;
    npc.y = target.y;
    npc.facing = target.facing ?? npc.facing ?? "down";
    npc.hidden = npc.kind !== "fox" && (
      (phase === "Night" && ["baker", "herbalist", "child"].includes(npc.kind)) ||
      (severeWeather && npc.kind === "child")
    );
  }
}

function updateFoxCompanion(state, scene, dt) {
  const fox = scene.npcs?.find((npc) => npc.kind === "fox");
  if (!fox) return;
  const player = state.player;
  const phase = state.timeLabel ?? phaseLabelForMinutes(state.minutes);
  const secretNearby = scene.interactables?.some((item) => {
    if (!["secret", "secret-item", "memory"].includes(item.type)) return false;
    if (item.type === "memory" && state.memoryFragments.includes(item.fragment)) return false;
    if (item.type === "secret-item" && state.worldState.discoveredSecrets.includes(item.id)) return false;
    return Math.abs(item.x - player.x) <= 2 && Math.abs(item.y - player.y) <= 2;
  });
  const corruptionNearby = scene.tiles?.some((row, y) =>
    row?.some?.((tile, x) => tile === "corruption" && Math.abs(x - player.x) <= 3 && Math.abs(y - player.y) <= 3),
  );
  let campfire = null;
  scene.tiles?.some((row, y) => row?.some?.((tile, x) => {
    if (tile !== "fire") return false;
    campfire = { x, y };
    return true;
  }));
  state.foxState.nearSecret = Boolean(secretNearby);
  state.foxState.alert = Boolean(corruptionNearby || state.mode === "combat");
  state.foxState.sleeping = phase === "Night";
  state.foxState.mood = state.foxState.sleeping
    ? "sleepy"
    : state.foxState.alert
      ? "nervous"
      : secretNearby
        ? "excited"
        : state.flags.lanternRestored
          ? "calm"
          : "curious";

  if (state.foxState.sleeping) {
    const sleepTarget = campfire ?? { x: player.x - 1, y: player.y + 1 };
    fox.x = lerp(fox.x, sleepTarget.x, dt * 2);
    fox.y = lerp(fox.y, sleepTarget.y + 1, dt * 2);
    fox.facing = "down";
    return;
  }

  const offsetX = secretNearby ? 0.35 : state.flags.lanternRestored ? -0.75 : -0.95;
  const offsetY = secretNearby ? -0.25 : 0.6;
  fox.x = lerp(fox.x, clamp(player.x + offsetX, 1, scene.width - 2), dt * 2.2);
  fox.y = lerp(fox.y, clamp(player.y + offsetY, 1, scene.height - 2), dt * 2.2);
  fox.facing = player.direction === "left" ? "right" : player.direction === "right" ? "left" : "down";
}

function applyWeatherEffects(state, scene, t) {
  state.weather = weatherForState(state);
  state.weatherCycle = (state.weatherCycle + 1) % 9999;
  if (state.weather === "fog") {
    scene.ambience = "fog through the pines, quiet footsteps, and a distant owl";
  } else if (state.weather === "rain") {
    scene.ambience = "rain on leaves, soft puddles, and shuttered windows";
  } else if (state.weather === "thunder") {
    scene.ambience = "thunder over the hills and a restless wind";
  } else if (state.weather === "snow") {
    scene.ambience = "snowfall, muffled roads, and a crackling hearth";
  } else if (state.weather === "leaves") {
    scene.ambience = "falling leaves, dry paths, and the hush of dusk";
  }
  if (state.timeLabel === "Night") {
    state.foxState.hiddenHint = state.foxState.nearSecret ? "The fox is on to something." : "The fox curls up beside the warm light.";
  }
  if (state.mode !== "combat") {
    state.foxState.celebrates = Math.max(0, state.foxState.celebrates - t * 0.5);
  }
}

function createFlashbackPanel(fragment, onClose) {
  const panel = buildPanelList(fragment.name, `
    <div class="story-card">
      <h3>Recovered Memory</h3>
      <p>${fragment.flashback}</p>
    </div>
    <div class="story-card" style="margin-top:0.75rem">
      <h3>What it unlocks</h3>
      <p>${fragment.ability ? `Ability: ${fragment.ability}` : "A hidden truth."}</p>
    </div>
  `, {
    className: "modal-window--narrow",
    subtitle: fragment.summary,
    footerHTML: `<button class="btn btn--accent" type="button" data-close-flashback>Continue</button>`,
  });
  panel.querySelector("[data-close-flashback]")?.addEventListener("click", () => {
    panel.remove();
    onClose?.();
  });
  return panel;
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
    actionLabel: state.scene === "home" ? "Apply Changes" : "Start the game",
    onCancel: () => {
      state.mode = "playing";
      state.ui.editorOpen = false;
      onComplete?.();
    },
    onSave: (appearance) => {
      state.player.appearance = mergeAppearance(state.player.appearance, appearance);
      state.player.name = appearance.name ?? state.player.name;
      state.player.appearance.name = state.player.name;
      state.ui.editorOpen = false;
      state.mode = state.endingProgress.storyComplete ? "ending" : "playing";
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

function updateDialoguePanel(refs, state, canvas, toast, callback) {
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
        const effects = choice.effects ?? [choice.effect, choice.effect2].filter(Boolean);
        effects.forEach((effect) => applyDialogueEffect(state, effect));
        if (choice.reward) {
          questReward(state, choice.reward, toast);
        }
        state.dialogueChoices.push({
          npc: dialogue.speaker,
          node: node.id,
          choice: choice.label,
        });
        if (choice.next) {
          state.dialogueNode = choice.next;
          updateDialoguePanel(refs, state, canvas, toast, callback);
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
  const alreadyOwned = state.player.inventory.includes(rewardId);
  if (rewardId === "warm shawl") {
    state.unlockedOutfits.jacket = [...new Set([...(state.unlockedOutfits.jacket ?? []), "traveler"])];
    pathForQuestItem(state, "warm shawl");
    if (!alreadyOwned) adjustReputation(state, "villagers", 1);
    toast.show("Reward unlocked: Traveler jacket");
  } else if (rewardId === "smith bracer") {
    state.unlockedOutfits.accessories = [...new Set([...(state.unlockedOutfits.accessories ?? []), "lantern"])];
    pathForQuestItem(state, "smith bracer");
    if (!alreadyOwned) adjustReputation(state, "villagers", 1);
    toast.show("Reward unlocked: Lantern charm");
  } else if (rewardId === "forest charm") {
    state.unlockedOutfits.hairstyles = [...new Set([...(state.unlockedOutfits.hairstyles ?? []), "fox-tuft"])];
    state.unlockedOutfits.accessories = [...new Set([...(state.unlockedOutfits.accessories ?? []), "moonpin"])];
    pathForQuestItem(state, "forest charm");
    if (!alreadyOwned) adjustReputation(state, "spirits", 1);
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
    if (state.quests.breadline.progress >= 2) {
      toast.show("Both sacks recovered. Tilda is waiting at the bakery.");
    }
  }
  if (questId === "smith-hammer") {
    activateQuest(state, "smithHammer");
    updateQuestProgress(state, "smithHammer", 2);
    toast.show("Brann's hammer is intact. Return it to the forge.");
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
  state.timeLabel = phaseLabelForMinutes(state.minutes);
  state.weather = weatherForState(state);
  saveAutosave(state);
}

function sceneInteractables(scene) {
  return [...(scene.interactables ?? []), ...(scene.exits ?? [])];
}

function activeNearbyInteractable(state, scene) {
  const px = state.player.x;
  const py = state.player.y;
  const playerBox = { x: px - 0.7, y: py - 0.7, w: 1.4, h: 1.4 };
  return sceneInteractables(scene).find((item) => {
    if (item.type === "memory" && state.memoryFragments.includes(item.fragment)) return false;
    if (item.type === "item" && state.player.inventory.includes(item.item)) return false;
    if (item.type === "secret-item" && state.worldState.discoveredSecrets.includes(item.id)) return false;
    if (item.type === "combat" && state.worldState.wispDefeated) return false;
    return intersects(playerBox.x, playerBox.y, playerBox.w, playerBox.h, item.x, item.y, item.w, item.h);
  });
}

function useCurrentInteraction(state, refs, toast, audio, setModalState) {
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

  if (nearby?.type === "memory") {
    if (nearby.fragment === "merchant-road" && (state.reputation.merchants ?? 0) < 1 && !state.flags.merchantTrusted) {
      toast.show("Moss has locked the old ledger until you earn a little trust.");
      adjustReputation(state, "merchants", -1);
      return;
    }
    if (collectMemoryFragment(state, nearby.fragment, toast)) {
      const fragment = knownMemoryById(nearby.fragment);
      if (fragment) {
        let flashback = null;
        const closeFlashback = () => {
          flashback?.remove();
          state.mode = state.endingProgress.storyComplete ? "ending" : "playing";
          setModalState(false);
          saveAutosave(state);
        };
        flashback = createFlashbackPanel(fragment, closeFlashback);
        refs.overlayLayer.appendChild(flashback);
        setModalState(true, closeFlashback);
      }
      if (nearby.fragment === "forest-spring") {
        adjustReputation(state, "spirits", 1);
      }
      if (nearby.fragment === "square-lantern") {
        adjustReputation(state, "villagers", 1);
      }
      if (nearby.fragment === "merchant-road") {
        adjustReputation(state, "merchants", 1);
      }
      if (nearby.fragment === "guardian-echo") {
        adjustReputation(state, "guardians", 1);
      }
      saveAutosave(state);
    }
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
        state.worldState.forestPuzzleSolved = true;
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
    if (!state.worldState.discoveredSecrets.includes(nearby.id)) {
      state.worldState.discoveredSecrets.push(nearby.id);
      state.worldState.hiddenItemFound = true;
      pathForQuestItem(state, nearby.item);
      toast.show(`Hidden item found: ${nearby.item}.`);
      state.foxState.celebrates = 1;
      questReward(state, "forest charm", toast);
      saveAutosave(state);
    }
    return;
  }

  if (nearby?.type === "item") {
    handleItemPickup(state, nearby.item, nearby.quest, toast);
    if (nearby.item === "lantern shard") {
      updateQuestProgress(state, "brokenLantern", 4);
      toast.show("Collected the lantern shard.");
    }
    return;
  }

  if (nearby?.type === "merchant") {
    adjustReputation(state, "merchants", 1);
    openDialogue(state, "merchant");
    return;
  }

  const npc = scene.npcs.find((actor) => {
    if (actor.hidden) return false;
    const dx = Math.abs(actor.x - state.player.x);
    const dy = Math.abs(actor.y - state.player.y);
    return dx <= 1.25 && dy <= 1.25;
  });
  if (npc) {
    registerCharacter(state, npc.name);
    if (npc.id === "fox") {
      openDialogue(state, "foxIntro");
    } else {
      const dialogueId = npc.id === "elder" ? "elderRowan" : npc.id === "deer" ? "forestSpirit" : npc.id;
      openDialogue(state, dialogueId);
    }
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
    const wardReduction = state.player.abilities.includes("ward-step") ? 0.65 : 1;
    state.player.health = Math.max(0, state.player.health - 18 * wardReduction * dt);
    state.screenShake = Math.max(state.screenShake, 0.35);
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
  state.timeLabel = phaseLabelForMinutes(state.minutes);
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
  audio.setScene(state.scene);
  let activeModalCloser = null;

  function setModalState(isOpen, closer = null) {
    state.ui.modalOpen = isOpen;
    if (!isOpen) {
      state.ui.journalOpen = false;
      state.ui.mapOpen = false;
      state.ui.inventoryOpen = false;
      state.ui.saveOpen = false;
      state.ui.titleOpen = false;
      state.ui.dialogueOpen = false;
      state.ui.editorOpen = false;
      state.ui.pauseOpen = false;
    }
    refs.overlayLayer.classList.toggle("is-modal-open", isOpen);
    refs.shell.classList.toggle("is-modal-open", isOpen);
    document.body.classList.toggle("modal-open", isOpen);
    activeModalCloser = isOpen ? closer : null;
    if (isOpen) {
      input.up = input.down = input.left = input.right = false;
      input.run = input.action = input.attack = input.interact = false;
      input.confirm = input.cancel = false;
    }
  }

  refs.overlayLayer.addEventListener("click", (event) => {
    if (event.target === refs.overlayLayer && activeModalCloser) {
      activeModalCloser();
    }
  });

  function clearModalPanels() {
    for (const panel of [titlePanel, savePanel, pausePanel, endingPanel, journalPanel, mapPanel, inventoryPanel]) {
      panel?.remove();
    }
    titlePanel = savePanel = pausePanel = endingPanel = journalPanel = mapPanel = inventoryPanel = null;
    setModalState(false);
  }

  function openTitleScreen() {
    clearModalPanels();
    state.mode = "title";
    refs.fade.classList.remove("is-visible");
    titlePanel = buildPanelList("Alderwood", createStartScreenHTML(state));
    setModalState(true, () => {
      titlePanel?.remove();
      titlePanel = null;
      setModalState(false);
    });
    titlePanel.querySelector("[data-close]")?.addEventListener("click", () => {
      titlePanel?.remove();
      setModalState(false);
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
      const latest = loadLatestSave();
      if (latest) {
        Object.assign(state, hydrateStateFromSave(latest));
        state.mode = "playing";
        titlePanel?.remove();
        titlePanel = null;
        setModalState(false);
        audio.setScene(state.scene);
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
    setModalState(true, () => {
      savePanel?.remove();
      savePanel = null;
      setModalState(false);
    });
    savePanel.querySelector("[data-close]").addEventListener("click", () => {
      savePanel?.remove();
      savePanel = null;
      setModalState(false);
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
          setModalState(false);
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
          setModalState(false);
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
        setModalState(false);
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
    setModalState(true, () => {
      pausePanel?.remove();
      pausePanel = null;
      setModalState(false);
    });
    pausePanel.querySelector("[data-close]").addEventListener("click", () => {
      pausePanel?.remove();
      pausePanel = null;
      setModalState(false);
      state.mode = "playing";
    });
    pausePanel.querySelector("[data-resume]").addEventListener("click", () => {
      pausePanel?.remove();
      pausePanel = null;
      setModalState(false);
      state.mode = "playing";
    });
    pausePanel.querySelector("[data-open-journal]").addEventListener("click", () => {
      pausePanel?.remove();
      pausePanel = null;
      setModalState(false);
      openJournal();
    });
    pausePanel.querySelector("[data-open-map]").addEventListener("click", () => {
      pausePanel?.remove();
      pausePanel = null;
      setModalState(false);
      openMap();
    });
    pausePanel.querySelector("[data-open-inventory]").addEventListener("click", () => {
      pausePanel?.remove();
      pausePanel = null;
      setModalState(false);
      openInventory();
    });
    pausePanel.querySelector("[data-open-save]").addEventListener("click", () => {
      pausePanel?.remove();
      pausePanel = null;
      setModalState(false);
      openSavePanel();
    });
    pausePanel.querySelector("[data-return-title]").addEventListener("click", () => {
      saveAutosave(state);
      openTitleScreen();
    });
    refs.overlayLayer.appendChild(pausePanel);
  }

  function openJournal() {
    journalPanel?.remove();
    journalPanel = buildPanelList("Quest Journal", createJournalHTML(state));
    journalPanel.setAttribute("data-journal-panel", "true");
    setModalState(true, () => {
      journalPanel?.remove();
      journalPanel = null;
      setModalState(false);
    });
    journalPanel.querySelector("[data-close]").addEventListener("click", () => {
      journalPanel?.remove();
      journalPanel = null;
      setModalState(false);
    });
    refs.overlayLayer.appendChild(journalPanel);
  }

  function openMap() {
    mapPanel?.remove();
    mapPanel = buildPanelList("World Map", createMapHTML(state), {
      className: "modal-window--wide",
      subtitle: "A living map of Alderwood and the lands that still remember it.",
    });
    mapPanel.setAttribute("data-map-panel", "true");
    setModalState(true, () => {
      mapPanel?.remove();
      mapPanel = null;
      setModalState(false);
    });
    mapPanel.querySelector("[data-close]").addEventListener("click", () => {
      mapPanel?.remove();
      mapPanel = null;
      setModalState(false);
    });
    const locations = getMapLocations(state);
    const selected = locations.find((location) => location.current || location.discovered) ?? locations[0];
    if (selected) {
      populateMapDetails(mapPanel, selected);
    }
    mapPanel.querySelectorAll("[data-location-id]").forEach((button) => {
      const location = locations.find((entry) => entry.id === button.getAttribute("data-location-id"));
      if (!location) return;
      button.addEventListener("click", () => {
        populateMapDetails(mapPanel, location);
      });
    });
    refs.overlayLayer.appendChild(mapPanel);
  }

  function openInventory() {
    inventoryPanel?.remove();
    inventoryPanel = buildPanelList("Inventory", createInventoryHTML(state));
    inventoryPanel.setAttribute("data-inventory-panel", "true");
    setModalState(true, () => {
      inventoryPanel?.remove();
      inventoryPanel = null;
      setModalState(false);
    });
    inventoryPanel.querySelector("[data-close]").addEventListener("click", () => {
      inventoryPanel?.remove();
      inventoryPanel = null;
      setModalState(false);
    });
    refs.overlayLayer.appendChild(inventoryPanel);
  }

  function openEndingPanel() {
    endingPanel?.remove();
    endingPanel = document.createElement("section");
    endingPanel.setAttribute("data-ending-panel", "true");
    endingPanel.innerHTML = createEndingHTML(state);
    endingPanel.className = "panel title-card";
    setModalState(true, () => {
      endingPanel?.remove();
      endingPanel = null;
      setModalState(false);
    });
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
    if (state.flags.introSeen) return;
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
        state.flags.introSeen = true;
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
      enemy.health -= state.player.abilities.includes("heavy-strike") ? 12 : 8;
      state.player.attackCooldown = 0.3;
      state.screenShake = Math.max(state.screenShake, 0.25);
      state.foxState.alert = true;
      spawnSparkles(state, enemy.x * TILE_SIZE, enemy.y * TILE_SIZE, "#ffc6ed", 6);
      if (enemy.health <= 0) {
        state.combat = null;
        state.mode = "playing";
        state.worldState.wispDefeated = true;
        pathForQuestItem(state, "lantern shard");
        updateQuestProgress(state, "brokenLantern", 3);
        if (state.quests.forestFriends.status === "active") {
          updateQuestProgress(state, "forestFriends", 3);
        }
        adjustReputation(state, "spirits", 1);
        state.foxState.celebrates = 1;
        toast.show("The wisp dissolves, leaving a lantern shard behind.");
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
    state.screenShake = Math.max(0, state.screenShake - dt * 1.8);
    audio.tick(dt, state);

    if (state.mode === "playing" || state.mode === "combat") {
      if (state.ui.modalOpen) {
        updateHUD(refs, state, getScene(state.scene), sceneMusic(state.scene));
        ctx.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
        drawScene(ctx, getScene(state.scene), state.camera, now / 1000, state.weather, state);
        drawPropsAndActors(ctx, getScene(state.scene), state, now / 1000, Math.floor(blinkClock * 4) % 2 === 0);
        drawAvatar(
          ctx,
          state.player.appearance,
          state.player.x * TILE_SIZE - state.camera.x + TILE_SIZE / 2,
          state.player.y * TILE_SIZE - state.camera.y + TILE_SIZE / 2 + 2,
          18,
          { view: "topdown", blink: Math.floor(blinkClock * 5) % 2 === 0, facing: state.player.direction },
        );
        requestAnimationFrame(updateLoop);
        return;
      }
      const scene = getScene(state.scene);
      if (state.mode === "playing") {
        playerMove(state, scene, input, dt);
      }
      updateCamera(state, dt);
      maybeAdvanceTime(state, dt);
      updateNpcSchedules(state, scene);
      updateFoxCompanion(state, scene, dt);
      applyWeatherEffects(state, scene, dt);
      updateParticles(state, dt);
      if (state.player.attackCooldown > 0) state.player.attackCooldown = Math.max(0, state.player.attackCooldown - dt);
      if (state.mode === "combat") updateCombat(state, dt, toast);
      if (input.interact || input.action) {
        input.interact = input.action = false;
        useCurrentInteraction(state, refs, toast, audio, setModalState);
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
      updateDialoguePanel(refs, state, canvas, toast, () => {});
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
    const shakeX = state.screenShake ? Math.round((Math.random() - 0.5) * state.screenShake * 10) : 0;
    const shakeY = state.screenShake ? Math.round((Math.random() - 0.5) * state.screenShake * 8) : 0;
    ctx.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    drawScene(ctx, scene, { x: state.camera.x + shakeX, y: state.camera.y + shakeY }, now / 1000, state.weather, state);
    drawPropsAndActors(ctx, scene, { ...state, camera: { x: state.camera.x + shakeX, y: state.camera.y + shakeY } }, now / 1000, Math.floor(blinkClock * 4) % 2 === 0);

    // Player sprite.
    drawAvatar(
      ctx,
      state.player.appearance,
      state.player.x * TILE_SIZE - state.camera.x + shakeX + TILE_SIZE / 2,
      state.player.y * TILE_SIZE - state.camera.y + shakeY + TILE_SIZE / 2 + 2,
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

    state.autosaveTimer += dt;
    if (state.autosaveTimer >= 5) {
      state.autosaveTimer = 0;
      saveAutosave(state);
    }

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
        if (activeModalCloser) {
          activeModalCloser();
        } else if (state.mode === "dialogue") {
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
