export const QUESTS = {
  brokenLantern: {
    id: "brokenLantern",
    chapter: 1,
    title: "The Broken Lantern",
    description:
      "Restore Alderwood's first lantern before the corruption spills into the village square.",
    steps: [
      "Wake in your home and meet Ember.",
      "Speak with Elder Rowan.",
      "Find the lantern shard in the Whispering Forest.",
      "Bring oil, wick, and the shard back to the square.",
      "Decide what the restored lantern should do with your memory.",
    ],
    rewards: ["chapter progress", "memory shard"],
  },
  breadline: {
    id: "breadline",
    chapter: 1,
    title: "Tilda's Breadline",
    description: "Help the baker gather lost flour sacks so the village can eat tonight.",
    steps: ["Find the flour sacks around the village.", "Return them to Tilda."],
    rewards: ["warm shawl", "traveler outfit"],
  },
  smithHammer: {
    id: "smithHammer",
    chapter: 1,
    title: "Brann's Missing Hammer",
    description: "Track down the blacksmith's hammer in the forest before the forge goes cold.",
    steps: ["Accept Brann's request.", "Recover the hammer near the corrupted cave.", "Bring it back to the forge."],
    rewards: ["smith bracer", "armour dye"],
  },
  forestFriends: {
    id: "forestFriends",
    chapter: 1,
    title: "Forest Friends",
    description: "Help the forest spirits heal a spring and calm the deer that guard it.",
    steps: ["Listen to Sprig Deer.", "Clear the corruption from the spring.", "Return the moon-thread clue to Ember."],
    rewards: ["fox-tuft hairstyle", "forest charm"],
  },
  puzzleOfRings: {
    id: "puzzleOfRings",
    chapter: 1,
    title: "The Puzzle of Rings",
    description: "Align the rune stones in the proper order to open the hidden grove.",
    steps: ["Read the clue.", "Press the rune stones in sequence.", "Claim the hidden item."],
    rewards: ["moon pin", "hidden room"],
  },
};

export function createQuestState() {
  return Object.fromEntries(
    Object.keys(QUESTS).map((id) => [
      id,
      { id, status: "locked", progress: 0, completedAt: null, visible: false },
    ]),
  );
}

export function setQuestStatus(state, questId, status, progress = null) {
  const quest = state.quests[questId];
  if (!quest) return;
  quest.status = status;
  if (progress !== null) {
    quest.progress = progress;
  }
  quest.visible = true;
  if (status === "completed") {
    quest.completedAt = Date.now();
  }
}

export function updateQuestProgress(state, questId, progress) {
  const quest = state.quests[questId];
  if (!quest) return;
  quest.progress = Math.max(quest.progress, progress);
  quest.visible = true;
  if (quest.progress >= QUESTS[questId].steps.length) {
    quest.status = "completed";
    quest.completedAt = Date.now();
  } else if (quest.status === "locked") {
    quest.status = "active";
  }
}

export function activateQuest(state, questId) {
  const quest = state.quests[questId];
  if (!quest) return;
  quest.status = quest.status === "completed" ? "completed" : "active";
  quest.visible = true;
}

export function completeQuest(state, questId) {
  setQuestStatus(state, questId, "completed", QUESTS[questId]?.steps?.length ?? 0);
}

export function getJournalEntries(state) {
  return Object.values(QUESTS)
    .filter((quest) => quest.chapter <= (state.chapter ?? 1))
    .map((quest) => ({
      ...quest,
      progress: state.quests[quest.id] ?? { status: "locked", progress: 0 },
    }))
    .filter((entry) => entry.progress.visible || entry.progress.status !== "locked");
}

export function questStepLabel(quest, state) {
  const progress = state.quests[quest.id];
  if (!progress) return "Unknown";
  if (progress.status === "completed") return "Completed";
  if (progress.status === "active" || progress.status === "locked") {
    const current = Math.min(progress.progress, quest.steps.length - 1);
    return quest.steps[current] ?? quest.steps[0];
  }
  return quest.steps[0];
}

