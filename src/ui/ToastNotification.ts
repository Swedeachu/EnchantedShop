import type { Player } from "@minecraft/server";

const TOAST_SOUND_ID = "random.orb";

export function showToast(player: Player, message: string): void {
  player.onScreenDisplay.setActionBar(message);
  player.playSound(TOAST_SOUND_ID);
}
