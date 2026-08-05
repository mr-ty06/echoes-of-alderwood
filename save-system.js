const STORAGE_PREFIX = "echoes_of_alderwood";
const SAVE_VERSION = 1;

function storage() {
  try {
    if (typeof localStorage !== "undefined") {
      return localStorage;
    }
  } catch {
    // File:// or privacy modes can throw. We fall back to nothing.
  }
  return null;
}

function safeJsonParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveKey(slot) {
  return `${STORAGE_PREFIX}:slot:${slot}`;
}

function autosaveKey() {
  return `${STORAGE_PREFIX}:autosave`;
}

export function createSaveState(state) {
  return {
    version: SAVE_VERSION,
    savedAt: Date.now(),
    name: state.player.name,
    appearance: state.player.appearance,
    chapter: state.chapter,
    location: state.location,
    scene: state.scene,
    position: { x: state.player.x, y: state.player.y },
    completedQuests: Object.fromEntries(
      Object.entries(state.quests)
        .filter(([, quest]) => quest.status === "completed")
        .map(([id, quest]) => [id, { ...quest }]),
    ),
    activeQuests: Object.fromEntries(
      Object.entries(state.quests)
        .filter(([, quest]) => quest.status !== "completed")
        .map(([id, quest]) => [id, { ...quest }]),
    ),
    inventory: [...state.player.inventory],
    health: state.player.health,
    energy: state.player.energy,
    abilities: [...state.player.abilities],
    dialogueChoices: [...state.dialogueChoices],
    unlockedOutfits: { ...state.unlockedOutfits },
    discoveredLocations: [...state.discoveredLocations],
    gameTime: {
      day: state.day,
      minutes: state.minutes,
      weather: state.weather,
    },
    endingProgress: { ...state.endingProgress },
    flags: { ...state.flags },
    worldState: { ...state.worldState },
    journalOpen: state.ui.journalOpen,
    mapOpen: state.ui.mapOpen,
    newGamePlusUnlocked: state.flags.newGamePlusUnlocked,
  };
}

export function normalizeSave(raw) {
  if (!raw || typeof raw !== "object") return null;
  const version = raw.version ?? 0;
  if (version !== SAVE_VERSION) return null;

  return {
    ...raw,
    appearance: raw.appearance ?? {},
    position: raw.position ?? { x: 0, y: 0 },
    inventory: raw.inventory ?? [],
    abilities: raw.abilities ?? [],
    dialogueChoices: raw.dialogueChoices ?? [],
    unlockedOutfits: raw.unlockedOutfits ?? {},
    discoveredLocations: raw.discoveredLocations ?? [],
    gameTime: raw.gameTime ?? { day: 1, minutes: 7 * 60, weather: "clear" },
    endingProgress: raw.endingProgress ?? {},
    flags: raw.flags ?? {},
    worldState: raw.worldState ?? {},
  };
}

export function saveAutosave(state) {
  const store = storage();
  if (!store) return null;
  const payload = createSaveState(state);
  store.setItem(autosaveKey(), JSON.stringify(payload));
  return payload;
}

export function saveSlot(slot, state) {
  const store = storage();
  if (!store) return null;
  const payload = createSaveState(state);
  store.setItem(saveKey(slot), JSON.stringify(payload));
  return payload;
}

export function loadAutosave() {
  const store = storage();
  if (!store) return null;
  return normalizeSave(safeJsonParse(store.getItem(autosaveKey())));
}

export function loadSlot(slot) {
  const store = storage();
  if (!store) return null;
  return normalizeSave(safeJsonParse(store.getItem(saveKey(slot))));
}

export function loadLatestSave() {
  const autosave = loadAutosave();
  if (autosave) return autosave;
  for (const slot of [3, 2, 1]) {
    const saved = loadSlot(slot);
    if (saved) return saved;
  }
  return null;
}

export function deleteSlot(slot) {
  const store = storage();
  if (!store) return;
  store.removeItem(saveKey(slot));
}

export function hasAnySave() {
  return Boolean(loadLatestSave());
}

export function exportSaveData() {
  const latest = loadLatestSave();
  if (!latest) return "";
  return JSON.stringify(latest, null, 2);
}

export function importSaveData(jsonText) {
  const parsed = safeJsonParse(jsonText);
  const normalized = normalizeSave(parsed);
  if (!normalized) {
    throw new Error("Invalid save data.");
  }
  const store = storage();
  if (!store) {
    throw new Error("Storage unavailable.");
  }
  store.setItem(autosaveKey(), JSON.stringify(normalized));
  return normalized;
}

export function listSaveSlots() {
  return [1, 2, 3].map((slot) => {
    const save = loadSlot(slot);
    return {
      slot,
      save,
      label: save
        ? `${save.name} · Chapter ${save.chapter} · ${save.location}`
        : "Empty slot",
      savedAt: save?.savedAt ?? null,
    };
  });
}

export function clearAutosave() {
  const store = storage();
  if (!store) return;
  store.removeItem(autosaveKey());
}

