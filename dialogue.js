const DIALOGUES = {
  foxIntro: {
    speaker: "Ember",
    portrait: "fox",
    mood: "calm",
    nodes: [
      {
        id: "start",
        text: "Ember circles your boots, sniffs the air, and tilts his head toward the village square. He is very clearly saying this is not the time to lie down and give up.",
        choices: [
          { label: "What are you trying to tell me?", next: "fox-who" },
          { label: "Where am I?", next: "fox-where" },
          { label: "Am I missing something important?", next: "fox-mind" },
        ],
      },
      {
        id: "fox-who",
        text: "Ember flicks his ears and paws at the floorboards. He was with you before the silence. The look he gives you suggests he considers that your fault, which is rude but fair.",
        choices: [
          { label: "Help me find my memories.", effect: { type: "flag", key: "foxBond", value: true }, next: "fox-help" },
        ],
      },
      {
        id: "fox-where",
        text: "Alderwood. Once safe. Now damp, cracked, and haunted by bad decisions with lanterns attached. Ember points toward the village square and then to your own door, because apparently subtlety is for other foxes.",
        choices: [{ label: "Then let's fix it.", effect: { type: "quest", key: "brokenLantern", value: "active" }, next: "fox-fix" }],
      },
      {
        id: "fox-mind",
        text: "Ember noses your sleeve, then gently but firmly shoves you toward the mirror. No barking, no speech, just a deeply judgmental silence.",
        choices: [{ label: "Somehow that helps.", effect: { type: "flag", key: "foxBond", value: true }, next: "fox-help" }],
      },
      {
        id: "fox-help",
        text: "Ember waits at the door, tail low, ready to follow. He looks toward Rowan, then the lantern, then back at you. The instruction is obvious enough without words.",
        choices: [
          { label: "I won't.", effect: { type: "quest", key: "brokenLantern", value: "active" }, next: null },
        ],
      },
      {
        id: "fox-fix",
        text: "Ember circles the broken lantern, then sits with the grim patience of someone who knows you are about to spend an entire chapter solving other people's problems.",
        choices: [{ label: "Teach me the rest later.", next: null }],
      },
    ],
  },
  elderRowan: {
    speaker: "Elder Rowan",
    portrait: "elder",
    mood: "grave",
    nodes: [
      {
        id: "start",
        text: "You were found at dawn near the old homestead. The village lantern failed three nights ago, and the fog has not forgiven us.",
        choices: [
          { label: "I don't remember anything.", effect: { type: "flag", key: "memoryLost", value: true }, next: "rowan-memory" },
          { label: "Tell me about the lanterns.", effect: { type: "reputation", key: "villagers", value: 1 }, next: "rowan-lanterns" },
        ],
      },
      {
        id: "rowan-memory",
        text: "Then you must lean on what remains. Ember says your memory was once tied to the lanterns. I did not want to believe that.",
        choices: [
          { label: "What do you want me to do?", effect: { type: "quest", key: "brokenLantern", value: "active" }, next: "rowan-quest" },
        ],
      },
      {
        id: "rowan-lanterns",
        text: "Five lanterns guarded Alderwood. Their light kept the corruption asleep. One has broken; the others are beginning to dim.",
        choices: [
          { label: "I will help restore it.", effect: { type: "quest", key: "brokenLantern", value: "active" }, effect2: { type: "reputation", key: "villagers", value: 1 }, next: "rowan-quest" },
        ],
      },
      {
        id: "rowan-quest",
        text: "Go carefully. Tilda may help with oil and flour. Brann knows the old iron. Nia hears the forest better than most hear each other.",
        choices: [{ label: "Understood.", next: null }],
      },
    ],
  },
  baker: {
    speaker: "Tilda",
    portrait: "baker",
    mood: "kind",
    nodes: [
      {
        id: "start",
        text: "If you have a pulse and a pair of hands, you can help. I've lost flour sacks all over the square and the fox keeps judging my kneading.",
        choices: [
          { label: "I'll find them.", effect: { type: "quest", key: "breadline", value: "active" }, next: "baker-quest" },
          { label: "Do you have anything else?", next: "baker-secret" },
        ],
      },
      {
        id: "baker-quest",
        text: "Two sacks are enough. Bring them back before the crust dries out and Alderwood starts eating soup like it's an apology.",
        choices: [{ label: "On it.", next: null }],
      },
      {
        id: "baker-secret",
        text: "If you find moon-thread, keep it. Threads like that remember where they came from. So do I, unfortunately.",
        choices: [{ label: "I'll keep an eye out.", next: null }],
      },
      {
        id: "baker-return",
        text: "Both sacks. Good. My mother kept seed flour from Alderwood's last clean harvest in the lining. We can bake it tonight, or save it so the village has something uncorrupted to plant.",
        choices: [
          {
            label: "Bake it. Nobody goes hungry tonight.",
            hint: "Villagers remember the feast.",
            effects: [
              { type: "quest", key: "breadline", value: "completed" },
              { type: "flag", key: "breadOutcome", value: "shared" },
              { type: "reputation", key: "villagers", value: 2 },
            ],
            reward: "warm shawl",
            next: "baker-shared",
          },
          {
            label: "Save the seed flour. Alderwood needs a future.",
            hint: "The village eats less now, but clean grain survives.",
            effects: [
              { type: "quest", key: "breadline", value: "completed" },
              { type: "flag", key: "breadOutcome", value: "saved" },
              { type: "reputation", key: "villagers", value: 1 },
              { type: "reputation", key: "spirits", value: 1 },
            ],
            reward: "warm shawl",
            next: "baker-saved",
          },
        ],
      },
      {
        id: "baker-shared",
        text: "Then tonight the ovens stay lit. People will remember the smell long after they forget what frightened them.",
        choices: [{ label: "Let them have one good night.", next: null }],
      },
      {
        id: "baker-saved",
        text: "A hard choice, but a living one. I'll stretch the ordinary flour and keep the old grain dry for spring.",
        choices: [{ label: "Plant it when the light returns.", next: null }],
      },
    ],
  },
  smith: {
    speaker: "Brann",
    portrait: "smith",
    mood: "steady",
    nodes: [
      {
        id: "start",
        text: "My hammer wandered off somewhere in the woods. Without it, this forge is just an expensive fire.",
        choices: [
          { label: "I'll retrieve it.", effect: { type: "quest", key: "smithHammer", value: "active" }, next: "smith-quest" },
          { label: "How did it get out there?", next: "smith-why" },
        ],
      },
      {
        id: "smith-quest",
        text: "Near the cave, if the corruption hasn't swallowed it. Also, if you see a wisp, hit first and ask questions later.",
        choices: [{ label: "Useful. Thanks.", next: null }],
      },
      {
        id: "smith-why",
        text: "Because this village is held together by habit and poor maintenance. Try not to repeat that in front of Rowan.",
        choices: [{ label: "No promises.", next: null }],
      },
      {
        id: "smith-return",
        text: "You found it. See the seal beneath the soot? My family forged the first Guardian wards with this hammer. I can mend the lantern frame, or make you something sharp enough to survive what comes next.",
        choices: [
          {
            label: "Reforge the village wards.",
            hint: "Strengthens Alderwood and earns Guardian respect.",
            effects: [
              { type: "quest", key: "smithHammer", value: "completed" },
              { type: "flag", key: "smithOutcome", value: "wards" },
              { type: "reputation", key: "villagers", value: 1 },
              { type: "reputation", key: "guardians", value: 1 },
              { type: "ability", value: "ward-step" },
            ],
            reward: "smith bracer",
            next: "smith-wards",
          },
          {
            label: "Forge a weapon. The corruption is already here.",
            hint: "Unlocks Heavy Strike but leaves the wards fragile.",
            effects: [
              { type: "quest", key: "smithHammer", value: "completed" },
              { type: "flag", key: "smithOutcome", value: "weapon" },
              { type: "reputation", key: "villagers", value: 1 },
              { type: "ability", value: "heavy-strike" },
            ],
            reward: "smith bracer",
            next: "smith-weapon",
          },
        ],
      },
      {
        id: "smith-wards",
        text: "Good. A weapon protects one pair of hands. A ward protects every door behind them.",
        choices: [{ label: "Make the seal hold.", next: null }],
      },
      {
        id: "smith-weapon",
        text: "Practical. Grim, but practical. Hold your attack a heartbeat longer and the bracer will carry the hammer's weight.",
        choices: [{ label: "I'll use it carefully.", next: null }],
      },
    ],
  },
  herbalist: {
    speaker: "Nia",
    portrait: "herbalist",
    mood: "gentle",
    nodes: [
      {
        id: "start",
        text: "The forest is listening. If you want it to open, you will need to answer it in the right order.",
        choices: [
          { label: "What order?", effect: { type: "quest", key: "forestFriends", value: "active" }, next: "nia-clue" },
          { label: "Are you talking about the rune stones?", next: "nia-runes" },
        ],
      },
      {
        id: "nia-clue",
        text: "Fox, lantern, water. The stones remember that sequence. Your companion already knows more than he admits.",
        choices: [{ label: "I'll remember.", next: null }],
      },
      {
        id: "nia-runes",
        text: "Press them in the order fox, lantern, water. It is less a puzzle than a memory trying to wake up.",
        choices: [{ label: "Then I'll wake it.", effect: { type: "quest", key: "puzzleOfRings", value: "active" }, next: null }],
      },
    ],
  },
  merchant: {
    speaker: "Moss Vale",
    portrait: "merchant",
    mood: "wry",
    nodes: [
      {
        id: "start",
        text: "I've travelled through six provinces and two bad omens to get here. Trust me or don't; either way, I still charge for tea.",
        choices: [
          { label: "I trust you.", effect: { type: "flag", key: "merchantTrusted", value: true }, next: "merchant-trust" },
          { label: "Not yet.", effect: { type: "flag", key: "merchantTrusted", value: false }, effect2: { type: "reputation", key: "merchants", value: -1 }, next: "merchant-wary" },
        ],
      },
      {
        id: "merchant-trust",
        text: "Wise. Or reckless. Those are adjacent. I can sell you maps, dyes, and bad news in tidy packaging.",
        choices: [{ label: "I'll remember that.", next: null }],
      },
      {
        id: "merchant-wary",
        text: "Caution is healthier than optimism. Come back when you've learned which one keeps you alive.",
        choices: [{ label: "Fair.", next: null }],
      },
    ],
  },
  child: {
    speaker: "Pip",
    portrait: "child",
    mood: "bright",
    nodes: [
      {
        id: "start",
        text: "There's a secret under the old stairs. I looked. Then the fox looked at me like I had disappointed the moon.",
        choices: [
          { label: "What secret?", effect: { type: "quest", key: "puzzleOfRings", value: "active" }, next: "pip-secret" },
          { label: "Thank you for your service.", next: "pip-joke" },
        ],
      },
      {
        id: "pip-secret",
        text: "A shiny thing. Maybe a moon-thread thing. Maybe something meant for someone who doesn't forget where they came from.",
        choices: [{ label: "I'll check the house.", next: null }],
      },
      {
        id: "pip-joke",
        text: "I'm basically a scholar. Just smaller and with more mud.",
        choices: [{ label: "That checks out.", next: null }],
      },
    ],
  },
  forestSpirit: {
    speaker: "Sprig Deer",
    portrait: "spirit",
    mood: "haunted",
    nodes: [
      {
        id: "start",
        text: "The spring hurts. The forest does not forget pain. Remove the black threads and the trees will breathe again.",
        choices: [
          { label: "I'll cleanse it.", effect: { type: "quest", key: "forestFriends", value: "active" }, effect2: { type: "reputation", key: "spirits", value: 1 }, next: "spirit-help" },
          { label: "What do you know about the lanterns?", next: "spirit-lanterns" },
        ],
      },
      {
        id: "spirit-help",
        text: "Then the grove will remember your footsteps kindly. Bring moon-thread to the hidden room and leave nothing hungry behind.",
        choices: [{ label: "Understood.", next: null }],
      },
      {
        id: "spirit-lanterns",
        text: "Lantern light once stitched the land together. When the stitch frays, everything below it starts to dream of teeth.",
        choices: [{ label: "That's charming.", next: null }],
      },
      {
        id: "spirit-return",
        text: "The wisp is gone, but one black root remains beneath the spring. Tear it out and the water heals. Preserve it, and the old Guardians may learn how the corruption thinks.",
        choices: [
          {
            label: "Destroy the root. Let the spring heal.",
            hint: "The Forest Spirits will remember this mercy.",
            effects: [
              { type: "quest", key: "forestFriends", value: "completed" },
              { type: "flag", key: "forestOutcome", value: "healed" },
              { type: "reputation", key: "spirits", value: 2 },
              { type: "memory", value: "forest-spring" },
            ],
            reward: "forest charm",
            next: "spirit-healed",
          },
          {
            label: "Preserve it. Knowledge may save the other lanterns.",
            hint: "Guardians approve; the forest does not.",
            effects: [
              { type: "quest", key: "forestFriends", value: "completed" },
              { type: "flag", key: "forestOutcome", value: "studied" },
              { type: "reputation", key: "guardians", value: 2 },
              { type: "reputation", key: "spirits", value: -1 },
              { type: "item", value: "corrupted root" },
            ],
            reward: "forest charm",
            next: "spirit-studied",
          },
        ],
      },
      {
        id: "spirit-healed",
        text: "The spring clears. Sprig lowers its antlers, and every leaf around you turns its pale underside toward the light.",
        choices: [{ label: "Breathe again.", next: null }],
      },
      {
        id: "spirit-studied",
        text: "Sprig steps back from the sealed root. The forest accepts your reason, but not your choice. Those are not the same thing.",
        choices: [{ label: "I know.", next: null }],
      },
    ],
  },
  lanternChoice: {
    speaker: "Alderwood",
    portrait: "lantern",
    mood: "glow",
    nodes: [
      {
        id: "start",
        text: "The restored lantern hums in your hands. The light knows you. The corruption remembers your name. Choose what it should carry next.",
        choices: [
          {
            label: "Restore the lantern and protect the village.",
            effect: { type: "ending", value: "restore" },
            next: null,
          },
          {
            label: "Sacrifice the memories that feed the corruption.",
            effect: { type: "ending", value: "memory" },
            next: null,
          },
          {
            label: "Take control of the corruption and become its guardian.",
            effect: { type: "ending", value: "guardian" },
            next: null,
          },
        ],
      },
    ],
  },
};

function cloneNodes(nodes) {
  return nodes.map((node) => ({
    ...node,
    choices: node.choices?.map((choice) => ({ ...choice })) ?? [],
  }));
}

function rewriteNodeText(node, state, speaker) {
  const phase = state.timeLabel ?? "Dawn";
  const reputation = state.reputation ?? {};
  const villagers = reputation.villagers ?? 0;
  const merchants = reputation.merchants ?? 0;
  const spirits = reputation.spirits ?? 0;
  const guardians = reputation.guardians ?? 0;

  const suffixes = [];
  if (phase === "Morning") suffixes.push("The village is already busy with the day.");
  else if (phase === "Afternoon") suffixes.push("The square hums with movement and work.");
  else if (phase === "Evening") suffixes.push("Lantern light softens the edges of every worry.");
  else if (phase === "Night") suffixes.push("Most of Alderwood is asleep, and the quiet feels watchful.");
  else suffixes.push("The dawn air still clings to the stones.");

  if (speaker === "Moss Vale") {
    if (merchants >= 2) suffixes.push("Moss keeps the good goods behind the stall and the bad bargains in front.");
    else if (merchants <= -2) suffixes.push("Moss watches you like a suspicious ledger entry.");
  } else if (speaker === "Elder Rowan") {
    if (villagers >= 2) suffixes.push("Rowan sounds relieved to see the village trust you.");
    else if (villagers <= -2) suffixes.push("Rowan is careful with every word, which is rarely a good sign.");
  } else if (speaker === "Sprig Deer") {
    if (spirits >= 2) suffixes.push("The forest seems to settle around the words, like it recognises them.");
    else if (spirits <= -2) suffixes.push("The woods do not feel patient with you today.");
  } else if (speaker === "Alderwood") {
    if (guardians >= 2) suffixes.push("The old wards stir as if they remember your hands.");
  } else if (speaker === "Tilda") {
    if (state.flags?.breadOutcome === "shared") suffixes.push("The square still smells faintly of the feast you chose.");
    if (state.flags?.breadOutcome === "saved") suffixes.push("A sealed jar of clean seed flour waits above her oven.");
  } else if (speaker === "Brann") {
    if (state.flags?.smithOutcome === "wards") suffixes.push("Fresh Guardian seals gleam over the forge door.");
    if (state.flags?.smithOutcome === "weapon") suffixes.push("He glances at your bracer, listening for the weight inside it.");
  }

  return `${node.text} ${suffixes.join(" ")}`.trim();
}

export function getDialogue(npcId, state) {
  const entry = DIALOGUES[npcId] ?? DIALOGUES.foxIntro;
  const nodes = cloneNodes(entry.nodes);
  for (const node of nodes) {
    node.text = rewriteNodeText(node, state, entry.speaker);
  }
  let startNode = nodes[0];
  const nodeById = (id) => nodes.find((node) => node.id === id) ?? startNode;

  if (npcId === "foxIntro" && state.flags?.foxBond) {
    startNode = nodeById("fox-help");
  }
  if (npcId === "elderRowan" && state.flags?.lanternRestored) {
    startNode = nodeById("rowan-lanterns");
  }
  if (npcId === "merchant" && ((state.reputation?.merchants ?? 0) >= 2 || state.flags?.merchantTrusted)) {
    startNode = nodeById("merchant-trust");
  }
  if (npcId === "baker") {
    if (state.flags?.breadOutcome === "shared") startNode = nodeById("baker-shared");
    else if (state.flags?.breadOutcome === "saved") startNode = nodeById("baker-saved");
    else if ((state.quests?.breadline?.progress ?? 0) >= 2) startNode = nodeById("baker-return");
  }
  if (npcId === "smith") {
    if (state.flags?.smithOutcome === "wards") startNode = nodeById("smith-wards");
    else if (state.flags?.smithOutcome === "weapon") startNode = nodeById("smith-weapon");
    else if (state.player?.inventory?.includes("smith hammer")) startNode = nodeById("smith-return");
  }
  if (npcId === "forestSpirit") {
    if (state.flags?.forestOutcome === "healed") startNode = nodeById("spirit-healed");
    else if (state.flags?.forestOutcome === "studied") startNode = nodeById("spirit-studied");
    else if (state.worldState?.wispDefeated && state.quests?.forestFriends?.status === "active") {
      startNode = nodeById("spirit-return");
    }
  }

  return {
    speaker: entry.speaker,
    portrait: entry.portrait,
    mood: entry.mood,
    timeLabel: state.timeLabel ?? "Dawn",
    startNode: startNode.id,
    nodes,
  };
}

export function getDialogueNode(dialogue, nodeId) {
  return dialogue.nodes.find((node) => node.id === nodeId) ?? dialogue.nodes[0];
}

export function listDialogues() {
  return DIALOGUES;
}
