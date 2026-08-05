const BASE_LOGICAL_WIDTH = 384;
const BASE_LOGICAL_HEIGHT = 288;
const MAX_BUFFER_SCALE = 2;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function calculateViewport(width, height, devicePixelRatio = 1) {
  const availableWidth = Math.max(1, Math.floor(width));
  const availableHeight = Math.max(1, Math.floor(height));
  const renderScale = Math.max(
    1,
    Math.floor(
      Math.min(
        availableWidth / BASE_LOGICAL_WIDTH,
        availableHeight / BASE_LOGICAL_HEIGHT,
      ),
    ),
  );
  const logicalWidth = Math.max(1, Math.floor(availableWidth / renderScale));
  const logicalHeight = Math.max(1, Math.floor(availableHeight / renderScale));
  const bufferScale = clamp(Math.ceil(devicePixelRatio || 1), 1, MAX_BUFFER_SCALE);

  return {
    availableWidth,
    availableHeight,
    cssWidth: logicalWidth * renderScale,
    cssHeight: logicalHeight * renderScale,
    bufferWidth: logicalWidth * bufferScale,
    bufferHeight: logicalHeight * bufferScale,
    logicalWidth,
    logicalHeight,
    renderScale,
    bufferScale,
    devicePixelRatio: devicePixelRatio || 1,
  };
}

export function createCamera() {
  return {
    x: 0,
    y: 0,
    viewportWidth: BASE_LOGICAL_WIDTH,
    viewportHeight: BASE_LOGICAL_HEIGHT,
    zoom: 1,
    target: "player",
    mapBounds: { width: 0, height: 0 },
  };
}

function cameraAxisTarget(targetCenter, mapSize, viewportSize) {
  if (mapSize <= viewportSize) {
    return -(viewportSize - mapSize) / 2;
  }
  return clamp(targetCenter - viewportSize / 2, 0, mapSize - viewportSize);
}

export function positionCamera(camera, target, mapWidth, mapHeight, options = {}) {
  const immediate = options.immediate ?? false;
  const dt = Math.max(0, options.dt ?? 0);
  const targetCenterX = target.x + (target.width ?? 0) / 2;
  const targetCenterY = target.y + (target.height ?? 0) / 2;
  const nextX = cameraAxisTarget(targetCenterX, mapWidth, camera.viewportWidth);
  const nextY = cameraAxisTarget(targetCenterY, mapHeight, camera.viewportHeight);
  const follow = immediate ? 1 : 1 - Math.pow(0.001, dt);

  camera.x += (nextX - camera.x) * follow;
  camera.y += (nextY - camera.y) * follow;
  camera.mapBounds.width = mapWidth;
  camera.mapBounds.height = mapHeight;
  return camera;
}

export function configureCanvas(canvas, camera, viewport) {
  if (canvas.width !== viewport.bufferWidth) canvas.width = viewport.bufferWidth;
  if (canvas.height !== viewport.bufferHeight) canvas.height = viewport.bufferHeight;
  canvas.style.width = `${viewport.cssWidth}px`;
  canvas.style.height = `${viewport.cssHeight}px`;

  camera.viewportWidth = viewport.logicalWidth;
  camera.viewportHeight = viewport.logicalHeight;
  camera.zoom = viewport.renderScale;
}

export function clearInputState(input) {
  for (const key of Object.keys(input)) {
    if (typeof input[key] === "boolean") input[key] = false;
  }
}

export { BASE_LOGICAL_HEIGHT, BASE_LOGICAL_WIDTH };
