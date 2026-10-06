import { MODULE_ID, getStats } from "./stats.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

// Show a number with its sign: +3, 0, -13.
const signed = n => (n === null ? "—" : n > 0 ? `+${n}` : `${n}`);

/**
 * The Roll Statistics window.
 * ApplicationV2 is Foundry's window class; HandlebarsApplicationMixin adds
 * the ability to draw the window's contents from a Handlebars template.
 */
export class RollStatsApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "gurps-roll-stats-window",
    classes: ["gurps-roll-stats"],
    window: {
      title: "Roll Statistics",
      icon: "fa-solid fa-chart-simple",
      resizable: true
    },
    position: { width: 680, height: "auto" },
    // Buttons in the template with data-action="refresh" call this function.
    actions: {
      refresh: RollStatsApp.#onRefresh
    }
  };

  // The parts of the window, each drawn from a template file.
  static PARTS = {
    main: { template: `modules/${MODULE_ID}/templates/stats-app.hbs` }
  };

  // Keep a single window: opening it twice brings the same one to the front.
  static #instance = null;

  static open() {
    this.#instance ??= new this();
    this.#instance.render({ force: true });
  }

  // Redraw the window if it's open, e.g. after a new roll comes in.
  static refreshIfOpen() {
    if (this.#instance?.rendered) this.#instance.render();
  }

  // Build the data the template uses. Whatever this returns is available
  // in the .hbs file by name: {{#each rows}}, {{hasRows}}, ...
  async _prepareContext(options) {
    const rows = getStats().map(s => ({
      ...s,
      best: signed(s.bestMargin),
      worst: signed(s.worstMargin)
    }));
    return { rows, hasRows: rows.length > 0 };
  }

  // Inside an action handler, "this" is the window.
  static #onRefresh() {
    this.render();
  }
}
