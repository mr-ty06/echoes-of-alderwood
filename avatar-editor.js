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

function syncCanvasSize(canvas) {
  const parent = canvas.parentElement;
  if (!parent) return { width: canvas.width, height: canvas.height, dpr: 1 };
  const rect = parent.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(320, Math.floor(rect.width * dpr));
  const height = Math.max(320, Math.floor(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  return { width, height, dpr };
}

export function openAvatarEditor({
  mount,
  title = "Create your traveller",
  subtitle = "Shape the person waking under Alderwood's broken lantern.",
  appearance,
  unlocked = {},
  onSave,
  onCancel,
  actionLabel = "Apply Changes",
}) {
  const root = document.createElement("div");
  root.className = "modal-backdrop";
  root.innerHTML = `
    <section class="panel modal-window modal-window--editor">
      <div class="modal-header">
        <div class="modal-title">
          <h2>${title}</h2>
          <p>${subtitle}</p>
        </div>
        <button class="btn btn--ghost modal-close" type="button" data-cancel>Close</button>
      </div>
      <div class="modal-body">
        <div class="editor-grid">
          <div class="editor-preview">
            <canvas data-preview aria-label="Character preview"></canvas>
          </div>
          <div class="editor-scroll">
            <form class="editor-form" data-form></form>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn--accent" type="button" data-save>${actionLabel}</button>
        <button class="btn btn--ghost" type="button" data-cancel>Cancel</button>
        <button class="btn btn--ghost" type="button" data-randomize>Randomise</button>
      </div>
    </section>
  `;

  mount.querySelector(".modal-backdrop")?.remove();
  document.body.appendChild(root);
  document.body.classList.add("modal-open");

  const form = root.querySelector("[data-form]");
  const preview = root.querySelector("[data-preview]");
  const modalWindow = root.querySelector(".modal-window--editor");
  const cancelButtons = root.querySelectorAll("[data-cancel]");
  const randomizeButton = root.querySelector("[data-randomize]");
  const saveButton = root.querySelector("[data-save]");
  const ctx = preview.getContext("2d");
  const current = mergeAppearance(appearance);
  const controlState = { ...current };
  let raf = 0;

  function syncEditorLayout() {
    const bounds = root.getBoundingClientRect();
    modalWindow.style.width = `${Math.max(320, bounds.width - 16)}px`;
    modalWindow.style.height = `${Math.max(360, bounds.height - 16)}px`;
    schedulePreview();
  }

  function renderPreview() {
    const { width, height } = syncCanvasSize(preview);
    const cssWidth = width / (window.devicePixelRatio || 1);
    const cssHeight = height / (window.devicePixelRatio || 1);
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "rgba(233,201,115,0.08)";
    ctx.fillRect(16, 16, width - 32, height - 32);
    const size = Math.floor(Math.min(cssWidth, cssHeight) * 0.95 * (window.devicePixelRatio || 1));
    drawAvatar(ctx, controlState, width / 2, height / 2 + Math.floor(height * 0.08), size, {
      view: "portrait",
    });
  }

  function schedulePreview() {
    window.cancelAnimationFrame(raf);
    raf = window.requestAnimationFrame(renderPreview);
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
          schedulePreview();
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
          schedulePreview();
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
    schedulePreview();
  }

  function teardown() {
    document.body.classList.remove("modal-open");
    window.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("resize", handleResize);
    root.remove();
  }

  function save() {
    teardown();
    onSave?.(mergeAppearance(appearance, controlState));
  }

  function close() {
    teardown();
    onCancel?.();
  }

  function handleKeyDown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  }

  function handleResize() {
    syncEditorLayout();
  }

  root.addEventListener("click", (event) => {
    if (event.target === root) {
      close();
    }
  });
  cancelButtons.forEach((button) => button.addEventListener("click", close));
  randomizeButton.addEventListener("click", randomize);
  saveButton.addEventListener("click", save);
  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("resize", handleResize);

  renderForm();
  syncEditorLayout();

  return {
    update(next) {
      Object.assign(controlState, mergeAppearance(controlState, next));
      renderForm();
      schedulePreview();
    },
    close,
    element: root,
  };
}
