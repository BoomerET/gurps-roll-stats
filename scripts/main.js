import { MODULE_ID, log, getStats } from "./stats.js";
import { RollStatsApp } from "./stats-app.js";

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

  // The module's API, for macros and the console.
  game.modules.get(MODULE_ID).api = {
    getStats,
    open: () => RollStatsApp.open()
  };
});

// Add a "Roll Statistics" button to the Token tools on the left of the screen.
Hooks.on("getSceneControlButtons", (controls) => {
  const tokens = controls.tokens;
  if (!tokens) return;
  tokens.tools.gurpsRollStats = {
    name: "gurpsRollStats",
    title: "Roll Statistics",
    icon: "fa-solid fa-chart-simple",
    button: true,
    order: Object.keys(tokens.tools).length,
    onChange: () => RollStatsApp.open()
  };
});

// Before a GURPS roll message is saved, attach the roll's results as a flag.
// Runs only on the roller's computer.
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

// Runs on every connected computer when a message arrives.
Hooks.on("createChatMessage", async (message) => {
  const r = message.getFlag(MODULE_ID, "roll");
  if (!r) return;

  // Everyone's statistics window should update, so this runs on every computer.
  RollStatsApp.refreshIfOpen();

  // ...but only the roller posts the announcement.
  if (!message.isAuthor) return;

  const threshold = game.settings.get(MODULE_ID, "badMissThreshold");
  const who = message.speaker.alias ?? "Someone";

  let text = null;
  if (r.critSuccess) text = `🌟 <b>${who}</b> scored a <b>critical success</b> on ${r.thing}!`;
  else if (r.critFailure) text = `💥 <b>${who}</b> suffered a <b>critical failure</b> on ${r.thing}!`;
  else if (threshold > 0 && r.margin <= -threshold) text = `😬 <b>${who}</b> missed ${r.thing} by <b>${-r.margin}</b>.`;
  if (!text) return;

  await ChatMessage.create({
    content: `<div class="grs-announcement">${text}</div>`,
    speaker: message.speaker,
    flags: { [MODULE_ID]: { announcement: true } }
  });
});

// Deleting roll messages changes the statistics too.
Hooks.on("deleteChatMessage", () => RollStatsApp.refreshIfOpen());
