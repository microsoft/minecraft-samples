import { world } from "@minecraft/server";

export default class Utilities {
  static getPlayerById(playerId: string) {
    const players = world.getPlayers();

    for (const player of players) {
      if (player.id === playerId) {
        return player;
      }
    }

    return undefined;
  }
}
