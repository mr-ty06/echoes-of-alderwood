# Echoes of Alderwood

**Echoes of Alderwood** is a top-down pixel-art adventure game built for the browser with HTML, CSS, JavaScript, and the HTML5 Canvas API.

You awaken in the abandoned village of Alderwood with no memory of who you are. Five magical lanterns once protected the surrounding lands, but their light has failed and corruption is spreading through forests, ruins, and forgotten roads. Guided by a silent fox named Ember, you must restore the lanterns and uncover your connection to the disaster.

## Playable Release

The current release contains a complete playable opening chapter, **The Silent Village**, with an explorable village, home, and forest. Later chapters are represented in the story, journal, and world map and are intended for future expansion.

## Features

- Top-down pixel-art exploration rendered with Canvas
- Character creator with persistent wardrobe customisation
- Walking, running, interaction, and simple combat
- Five important villagers with time-dependent routines and dialogue
- Silent fox companion that follows the player and reacts to danger and secrets
- Branching conversations and decisions with persistent consequences
- Four-faction reputation system
- Main quest, narrative side quests, puzzles, collectibles, and hidden items
- Memory Fragments that unlock lore, abilities, locations, and ending context
- Dynamic day/night cycle, rain, fog, thunderstorms, leaves, and snow
- Area-specific procedural music and ambient sound
- Quest journal and completion tracker
- Interactive world map with discovered and locked locations
- Autosave, three manual save slots, import/export, and save compatibility
- Multiple endings and New Game Plus progression
- Responsive desktop and mobile interface

## Controls

| Action | Keyboard |
| --- | --- |
| Move | `WASD` or arrow keys |
| Run | Hold `Shift` |
| Interact / confirm | `E` or `Space` |
| Attack | `F` |
| Journal | `I` |
| World map | `M` |
| Inventory | `Q` |
| Pause / close modal | `Escape` |

Touch controls appear automatically on supported mobile layouts.

## Screenshots

Screenshots can be added here as the game evolves.

Suggested files:

- `docs/screenshots/village.png`
- `docs/screenshots/wardrobe.png`
- `docs/screenshots/world-map.png`

## Installation

Clone the repository and install the development dependencies:

```bash
git clone https://github.com/mr-ty06/echoes-of-alderwood.git
cd echoes-of-alderwood
npm install
```

The game state is stored locally in the browser using `localStorage`. Refreshing the page does not reset progress.

## Local Development

Run the bundled development server:

```bash
npm run dev
```

Open the local URL printed in the terminal.

For the standalone static game, any local HTTP server also works:

```bash
python3 -m http.server 8080
```

Then visit `http://localhost:8080`. A local server is recommended because the game uses JavaScript modules and absolute asset paths.

Run the release checks with:

```bash
npm test
```

## Deploying With Vercel

This repository includes `vercel.json` configured to serve the standalone game directly from the repository root without running a framework build.

1. Import `mr-ty06/echoes-of-alderwood` in Vercel.
2. Keep the project root set to the repository root.
3. The included configuration selects the `Other` framework mode, skips the build command, and serves the root directory.
4. Deploy.

Vercel will redeploy automatically when new commits are pushed to the connected production branch. See the [Vercel build configuration documentation](https://vercel.com/docs/builds/configure-a-build) for additional settings.

## Project Structure

```text
index.html          Standalone game entry point
styles.css          Game and interface styling
game.js             Main game loop and UI orchestration
player.js           Player model and pixel avatar renderer
world.js            Scenes, tiles, NPCs, and interactables
quests.js           Quest definitions and progress helpers
dialogue.js         Branching dialogue content
save-system.js      localStorage save management
avatar-editor.js    Character creator and wardrobe
assets/             Game asset notes and future external assets
```

## Credits

- Game concept and direction: `mr-ty06`
- Development assistance: OpenAI Codex
- Pixel artwork: generated at runtime with Canvas shapes
- Audio: procedural Web Audio API synthesis

No external artwork or commercial game assets are included in this release.
