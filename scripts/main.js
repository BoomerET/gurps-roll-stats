const MODULE_ID = "gurps-roll-stats";

// init: register settings before the game finishes loading.
Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "badMissThreshold", {
    name: "Bad miss threshold",
    hint: "Announce failed rolls missed by this much or more. Set to 0 to announce only criticals.",
    scope: "world",   // one value for the whole world, set by the GM
    config: true,     // show it under Configure Settings
    type: Number,
    default: 5
  });
});

Hooks.once("ready", () => {
  console.log(`${MODULE_ID} | ready`);
});

Hooks.on("createChatMessage", async (message) => {
  const log = (...args) => console.log(`${MODULE_ID} |`, ...args);
  log("message created", message.id);

  if (!message.isAuthor) return log("skip: not the author");
  if (message.getFlag(MODULE_ID, "announcement")) return log("skip: our own announcement");
  if (!message.content?.includes("roll-message")) return log("skip: not a GURPS roll message");

  const roll = globalThis.GURPS?.lastTargetedRoll;
  if (!roll) return log("skip: GURPS.lastTargetedRoll is empty");

  const total = message.rolls?.[0]?.total;
  log("lastTargetedRoll:", roll, "message total:", total);
  if (roll.rtotal !== total) return log(`skip: totals differ (${roll.rtotal} vs ${total})`);

  const threshold = game.settings.get(MODULE_ID, "badMissThreshold");
  const who = message.speaker.alias ?? "Someone";
  const what = roll.thing ?? "a roll";

  let text = null;
  if (roll.isCritSuccess) {
    text = `🌟 <b>${who}</b> scored a <b>critical success</b> on ${what}!`;
  } else if (roll.isCritFailure) {
    text = `💥 <b>${who}</b> suffered a <b>critical failure</b> on ${what}!`;
  } else if (threshold > 0 && roll.margin <= -threshold) {
    text = `😬 <b>${who}</b> missed ${what} by <b>${-roll.margin}</b>.`;
  }
  if (!text) return log("skip: roll didn't qualify");

  log("posting announcement");
  await ChatMessage.create({
    content: `<div class="n5ba-announcement">${text}</div>`,
    speaker: message.speaker,
    flags: { [MODULE_ID]: { announcement: true } }
  });
});

