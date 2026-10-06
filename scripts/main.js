const MODULE_ID = "gurps-roll-stats";

function log(...args) {
  if (game.settings.get(MODULE_ID, "debug")) console.log(`${MODULE_ID} |`, ...args);
}

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "badMissThreshold", {
    name: "Bad miss threshold",
    hint: "Announce failed rolls missed by this much or more. Set to 0 to announce only criticals.",
    scope: "world", config: true, type: Number, default: 5
  });
  game.settings.register(MODULE_ID, "debug", {
    name: "Debug logging",
    hint: "Write details to the browser console.",
    scope: "client", config: true, type: Boolean, default: false
  });

  // A module "API": functions other code (and you, in the console) can call.
  game.modules.get(MODULE_ID).api = { getStats };
});

// STEP 1: Before a GURPS roll message is saved, attach the roll's results as a flag.
Hooks.on("preCreateChatMessage", (message) => {
  if (!message.content?.includes("roll-message")) return;

  const roll = globalThis.GURPS?.lastTargetedRoll;
  const total = message.rolls?.[0]?.total;
  if (!roll || roll.rtotal !== total) return log("not a targeted roll, not recording");

  const record = {
    thing: roll.thing ?? "a roll",
    total,
    target: roll.finaltarget,
    margin: roll.margin,
    failure: !!roll.failure,
    critSuccess: !!roll.isCritSuccess,
    critFailure: !!roll.isCritFailure
  };
  message.updateSource({ flags: { [MODULE_ID]: { roll: record } } });
  log("recorded", record);
});

// The announcements, now reading our own flag instead of GURPS internals.
Hooks.on("createChatMessage", async (message) => {
  if (!message.isAuthor) return;
  const r = message.getFlag(MODULE_ID, "roll");
  if (!r) return;

  const threshold = game.settings.get(MODULE_ID, "badMissThreshold");
  const who = message.speaker.alias ?? "Someone";

  let text = null;
  if (r.critSuccess) text = `🌟 <b>${who}</b> scored a <b>critical success</b> on ${r.thing}!`;
  else if (r.critFailure) text = `💥 <b>${who}</b> suffered a <b>critical failure</b> on ${r.thing}!`;
  else if (threshold > 0 && r.margin <= -threshold) text = `😬 <b>${who}</b> missed ${r.thing} by <b>${-r.margin}</b>.`;
  if (!text) return;

  await ChatMessage.create({
    content: `<div class="n5ba-announcement">${text}</div>`,
    speaker: message.speaker,
    flags: { [MODULE_ID]: { announcement: true } }
  });
});

// STEP 2: Scan the chat log and add up the recorded rolls for each character.
function getStats({ since = 0 } = {}) {
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

  return Object.values(byActor).map(s => ({
    ...s,
    averageRoll: Number((s.diceTotal / s.rolls).toFixed(1)),
    successRate: `${Math.round((100 * s.successes) / s.rolls)}%`
  }));
}
