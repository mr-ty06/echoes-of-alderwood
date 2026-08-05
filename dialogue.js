const DIALOGUES = {
  foxIntro: {
    speaker: "Ember",
    portrait: "fox",
    mood: "calm",
    nodes: [
      {
        id: "start",
        text: "You're awake. Good. Alderwood has been waiting for you to stop pretending sleep was going to solve anything.",
        choices: [
          { label: "Who are you?", next: "fox-who" },
          { label: "Where am I?", next: "fox-where" },
          { label: "Did I lose my mind?", next: "fox-mind" },
        ],
      },
      {
        id: "fox-who",
        text: "Ember, if you like names. Fox, if you prefer honesty. I was with you before the silence. I am still annoyed about it.",
        choices: [
          { label: "Help me find my memories.", effect: { type: "flag", key: "foxBond", value: true }, next: "fox-help" },
        ],
      },
      {
        id: "fox-where",
        text: "Alderwood. Once safe. Now damp, cracked, and haunted by bad decisions with lanterns attached.",
        choices: [{ label: "Then let's fix it.", effect: { type: "quest", key: "brokenLantern", value: "active" }, next: "fox-fix" }],
      },
      {
        id: "fox-mind",
        text: "No. If anything, your mind is being extraordinarily quiet. That is different.",
        choices: [{ label: "Somehow that helps.", effect: { type: "flag", key: "foxBond", value: true }, next: "fox-help" }],
      },
      {
        id: "fox-help",
        text: "Good. Walk to the village square, speak with Rowan, and do not let the darkness convince you you are already lost.",
        choices: [{ label: "I won't.", effect: { type: "quest", key: "brokenLantern", value: "active" }, next: null }],
      },
      {
        id: "fox-fix",
        text: "First lesson: when a lantern dies, people start lying. Second lesson: you will need oil, a wick, and a stubborn streak.",
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
          { label: "Tell me about the lanterns.", next: "rowan-lanterns" },
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
          { label: "I will help restore it.", effect: { type: "quest", key: "brokenLantern", value: "active" }, next: "rowan-quest" },
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
          { label: "Not yet.", effect: { type: "flag", key: "merchantTrusted", value: false }, next: "merchant-wary" },
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
          { label: "I'll cleanse it.", effect: { type: "quest", key: "forestFriends", value: "active" }, next: "spirit-help" },
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

export function getDialogue(npcId, state) {
  const entry = DIALOGUES[npcId] ?? DIALOGUES.foxIntro;
  const nodes = cloneNodes(entry.nodes);
  let startNode = nodes[0];

  if (npcId === "foxIntro" && state.flags?.foxBond) {
    startNode = nodes[4];
  }
  if (npcId === "elderRowan" && state.flags?.lanternRestored) {
    startNode = nodes[2];
  }
  if (npcId === "merchant" && state.flags?.merchantTrusted) {
    startNode = nodes[1];
  }

  return {
    speaker: entry.speaker,
    portrait: entry.portrait,
    mood: entry.mood,
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

