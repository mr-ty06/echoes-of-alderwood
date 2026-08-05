export const NPC_INTERACTION_RADIUS = 1.8;

function distanceBetween(a, b) {
  return Math.hypot((a?.x ?? 0) - (b?.x ?? 0), (a?.y ?? 0) - (b?.y ?? 0));
}

function distanceToRect(point, rect) {
  const right = rect.x + (rect.w ?? 1);
  const bottom = rect.y + (rect.h ?? 1);
  const dx = Math.max(rect.x - point.x, 0, point.x - right);
  const dy = Math.max(rect.y - point.y, 0, point.y - bottom);
  return Math.hypot(dx, dy);
}

export function findNearbyNpc(player, npcs = [], radius = NPC_INTERACTION_RADIUS) {
  return npcs
    .filter((npc) => !npc.hidden)
    .map((npc) => ({ npc, distance: distanceBetween(player, npc) }))
    .filter(({ distance }) => distance <= radius)
    .sort((a, b) => a.distance - b.distance)[0]?.npc ?? null;
}

export function shouldPreferNpcInteraction(player, npc, interactable) {
  if (!npc) return false;
  if (!interactable) return true;

  // Doors and the wardrobe should remain dependable when an NPC walks nearby.
  if (interactable.type === "door" || interactable.type === "wardrobe") return false;

  const npcDistance = distanceBetween(player, npc);
  const interactableDistance = distanceToRect(player, interactable);
  return npcDistance <= interactableDistance + 0.35;
}

export function dialogueIdForNpc(npc) {
  if (npc?.id === "fox") return "foxIntro";
  if (npc?.id === "elder") return "elderRowan";
  if (npc?.id === "deer") return "forestSpirit";
  return npc?.id ?? null;
}
