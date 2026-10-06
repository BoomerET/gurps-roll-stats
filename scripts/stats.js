// Shared pieces used by the other script files.
export const MODULE_ID = "gurps-roll-stats";

export function log(...args) {
  if (game.settings.get(MODULE_ID, "debug")) console.log(`${MODULE_ID} |`, ...args);
}

// Scan the chat log and add up the recorded rolls for each character.
export function getStats({ since = 0 } = {}) {
  const byActor = {};
  for (const message of game.messages) {
    const r = message.getFlag(MODULE_ID, "roll");
    if (!r || message.timestamp < since) continue;

    const key = message.speaker.actor ?? message.speaker.alias;
    const s = (byActor[key] ??= {
      name: message.speaker.alias ?? "Unknown",
      rolls: 0, successes: 0, critSuccesses: 0, critFailures: 0,
      diceTotal: 0, bestMargin: null, worstMargin: null
    });

    s.rolls++;
    s.diceTotal += r.total;
    if (!r.failure) s.successes++;
    if (r.critSuccess) s.critSuccesses++;
    if (r.critFailure) s.critFailures++;
    if (s.bestMargin === null || r.margin > s.bestMargin) s.bestMargin = r.margin;
    if (s.worstMargin === null || r.margin < s.worstMargin) s.worstMargin = r.margin;
  }

  return Object.values(byActor)
    .map(s => ({
      ...s,
      averageRoll: Number((s.diceTotal / s.rolls).toFixed(1)),
      successRate: `${Math.round((100 * s.successes) / s.rolls)}%`
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
