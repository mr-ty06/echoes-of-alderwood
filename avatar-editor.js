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
  drawAvatar,
  getCustomizationOptions,
  mergeAppearance,
} from "./player.js";

const GROUPS = [
  ["name", "Character Name", "text"],
  ["bodyType", "Body Type", BODY_TYPES],
  ["skinTone", "Skin Tone", SKIN_TONES],
  ["hairstyle", "Hairstyle", HAIRSTYLES],
  ["hairColor", "Hair Colour", HAIR_COLORS],
  ["eyeColor", "Eye Colour", EYE_COLORS],
  ["shirt", "Shirt", SHIRTS],
  ["jacket", "Jacket / Armour", JACKETS],
  ["trousers", "Trousers", TROUSERS],
  ["shoes", "Shoes", SHOES],
  ["accessory", "Accessory", ACCESSORIES],
];

function optionListFor(group, unlocked) {
  if (group === "text") return [];
  const list = getCustomizationOptions()[group] ?? [];
  const unlocks = unlocked?.[group] ?? null;
  if (!unlocks) return list;
  return list.filter((option) => option.id === list[0].id || unlocks.includes(option.id));
}

function selectValue(form, key) {
  const field = form.elements.namedItem(key);
  if (!field) return null;
  if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement) {
    return field.value;
  }
  return null;
}

export function openAvatarEditor({
  mount,
  title = "Create your traveller",
  subtitle = "Shape the person waking under Alderwood's broken lantern.",
  appearance,
  unlocked = {},
  onSave,
  onCancel,
}) {
  const root = document.createElement("section");
  root.className = "panel title-card";
  root.innerHTML = `
    <div class="title-hero">
      <div>
        <h1>${title}</h1>
        <p>${subtitle}</p>
      </div>
      <div class="editor-grid">
        <div class="editor-preview">
          <canvas width="256" height="256" data-preview></canvas>
        </div>
        <form class="editor-form" data-form>
        </form>
      </div>
      <div class="editor-actions">
        <button class="btn btn--ghost" type="button" data-cancel>Cancel</button>
        <button class="btn btn--accent" type="button" data-randomize>Randomize</button>
        <button class="btn btn--accent" type="button" data-save>Start the game</button>
      </div>
    </div>
  `;

  mount.innerHTML = "";
  mount.appendChild(root);

  const form = root.querySelector("[data-form]");
  const preview = root.querySelector("[data-preview]");
  const cancelButton = root.querySelector("[data-cancel]");
  const randomizeButton = root.querySelector("[data-randomize]");
  const saveButton = root.querySelector("[data-save]");
  const ctx = preview.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  const current = mergeAppearance(appearance);
  const controlState = { ...current };

  function renderPreview() {
    ctx.clearRect(0, 0, preview.width, preview.height);
    ctx.fillStyle = "rgba(0,0,0,0.14)";
    ctx.fillRect(0, 0, preview.width, preview.height);
    drawAvatar(ctx, controlState, preview.width / 2, preview.height / 2 + 18, 4, {
      view: "portrait",
    });
  }

  function renderForm() {
    form.innerHTML = "";
    for (const [key, label, source] of GROUPS) {
      const field = document.createElement("label");
      field.className = "field";
      const caption = document.createElement("span");
      caption.textContent = label;
      field.appendChild(caption);

      if (source === "text") {
        const input = document.createElement("input");
        input.name = "name";
        input.value = controlState.name ?? "";
        input.maxLength = 18;
        input.placeholder = "Name";
        input.addEventListener("input", () => {
          controlState.name = input.value || "Alder";
          renderPreview();
        });
        field.appendChild(input);
      } else {
        const select = document.createElement("select");
        select.name = key;
        for (const option of optionListFor(key, unlocked)) {
          const opt = document.createElement("option");
          opt.value = option.id;
          opt.textContent = option.label;
          select.appendChild(opt);
        }
        select.value = controlState[key] ?? select.value;
        select.addEventListener("change", () => {
          controlState[key] = select.value;
          renderPreview();
        });
        field.appendChild(select);
      }
      form.appendChild(field);
    }
  }

  function randomize() {
    const keys = [
      "bodyType",
      "skinTone",
      "hairstyle",
      "hairColor",
      "eyeColor",
      "shirt",
      "jacket",
      "trousers",
      "shoes",
      "accessory",
    ];
    for (const key of keys) {
      const options = optionListFor(key, unlocked);
      controlState[key] = options[Math.floor(Math.random() * options.length)]?.id ?? controlState[key];
    }
    controlState.name = ["Alder", "Mira", "Rowan", "Ember", "Lyra"][Math.floor(Math.random() * 5)];
    renderForm();
    renderPreview();
  }

  cancelButton.addEventListener("click", () => onCancel?.());
  randomizeButton.addEventListener("click", randomize);
  saveButton.addEventListener("click", () => {
    onSave?.(mergeAppearance(appearance, controlState));
  });

  renderForm();
  renderPreview();

  return {
    update(next) {
      Object.assign(controlState, mergeAppearance(controlState, next));
      renderForm();
      renderPreview();
    },
    close() {
      root.remove();
    },
    element: root,
  };
}

