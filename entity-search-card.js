const BUILTIN_ACTIONS = [
  {
    matches: "^((magnet:.*)|(.*.torrent.*))$",
    name: "Add to Transmission",
    icon: "mdi:progress-download",
    service: "transmission.add_torrent",
    service_data: {
      torrent: "{1}",
    },
  },
];

const matchAndReplace = (text, matches) => {
  let result = text;

  for (let i = 0; i < matches.length; i++) {
    result = result.replace("{" + i + "}", matches[i]);
  }

  return result;
};

class EntitySearchCard extends HTMLElement {
  constructor() {
    super();

    this.attachShadow({ mode: "open" });

    this._hass = null;
    this._results = [];
    this._activeActions = [];
    this._searchValue = "";

    this._debouncedSearch = this._debounce((searchText) => {
      this._performSearch(searchText);
    }, 100);
  }

  setConfig(config) {
    this.config = config || {};

    this.max_results = this.config.max_results || 10;
    this.search_text = this.config.search_text || null;
    this.actions = BUILTIN_ACTIONS.concat(this.config.actions || []);
    this.included_domains = this.config.included_domains;
    this.excluded_domains = this.config.excluded_domains || [];

    this._render();
  }

  set hass(hass) {
    this._hass = hass;

    if (this.input) {
      this.input.placeholder =
        this.search_text || this._text("Entität suchen...", "Type to search...");
    }

    this._renderResults();
  }

  get hass() {
    return this._hass;
  }

  getCardSize() {
    return 1;
  }

  _render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          background: transparent !important;
          box-shadow: none !important;
          padding: 0 !important;
          margin: 0 !important;
        }

        .search-wrapper {
          position: relative;
          background: transparent !important;
          padding: 0 !important;
          margin: 0 !important;
        }

        input {
          width: 100%;
          box-sizing: border-box;
          display: block;
          padding: 12px 14px;
          border-radius: 12px;
          border: 1px solid var(--divider-color);
          background: rgba(28, 39, 49, 0.92);
          color: var(--primary-text-color);
          font-size: 16px;
          outline: none;
        }

        #results {
          display: none;
          margin-top: 8px;
          border-radius: 12px;
          overflow: hidden;
          background: rgba(28, 39, 49, 0.96);
        }

        .result-row,
        .action-row {
          padding: 10px 14px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          cursor: pointer;
        }

        .result-row:last-child,
        .action-row:last-child {
          border-bottom: none;
        }

        .result-name,
        .action-name {
          font-weight: 600;
          color: var(--primary-text-color);
          margin-bottom: 2px;
        }

        .result-meta,
        .action-meta {
          font-size: 12px;
          color: var(--secondary-text-color);
          overflow-wrap: anywhere;
        }

        .separator {
          color: var(--disabled-text-color);
          margin: 0 4px;
        }

        .state {
          color: var(--state-active-color);
          font-weight: 500;
        }

        .action-row {
          display: grid;
          grid-template-columns: 24px 1fr;
          column-gap: 10px;
          align-items: center;
        }

        ha-icon {
          color: var(--state-active-color);
        }
      </style>

      <div class="search-wrapper">
        <input id="searchInput" type="text">
        <div id="results"></div>
      </div>
    `;

    this.input = this.shadowRoot.querySelector("#searchInput");
    this.results = this.shadowRoot.querySelector("#results");

    this.input.placeholder =
      this.search_text || this._text("Entität suchen...", "Type to search...");

    this.input.addEventListener("input", (event) => {
      this._valueChanged(event);
    });
  }

  _isGerman() {
    return this._hass?.language === "de";
  }

  _text(de, en) {
    return this._isGerman() ? de : en;
  }

  _valueChanged(event) {
    this._searchValue = event.target.value;
    this._debouncedSearch(this._searchValue);
  }

  _clearInput() {
    this._searchValue = "";
    this._results = [];
    this._activeActions = [];

    if (this.input) {
      this.input.value = "";
    }

    this._renderResults();
  }

  _performSearch(searchText) {
    if (!this.config || !this.hass || searchText === "") {
      this._results = [];
      this._activeActions = [];
      this._renderResults();
      return;
    }

    try {
      const searchRegex = new RegExp(searchText, "i");
      const newResults = [];

      for (const entity_id in this.hass.states) {
        const stateObj = this.hass.states[entity_id];
        const friendlyName = stateObj.attributes.friendly_name || "";
        const domain = entity_id.split(".")[0];

        if (
          (entity_id.search(searchRegex) >= 0 ||
            friendlyName.search(searchRegex) >= 0) &&
          (this.included_domains
            ? this.included_domains.includes(domain)
            : !this.excluded_domains.includes(domain))
        ) {
          newResults.push(entity_id);
        }
      }

      this._results = newResults;
      this._activeActions = this._getActivatedActions(searchText);
    } catch (err) {
      console.warn(err);
      this._results = [];
      this._activeActions = [];
    }

    this._renderResults();
  }

  _renderResults() {
    if (!this.results || !this.hass) return;

    this.results.innerHTML = "";

    const results = this._results.slice(0, this.max_results).sort();
    const actions = this._activeActions;

    if (results.length === 0 && actions.length === 0) {
      this.results.style.display = "none";
      return;
    }

    this.results.style.display = "block";

    for (const [action, matches] of actions) {
      this.results.appendChild(this._createActionRow(action, matches));
    }

    for (const entity_id of results) {
      this.results.appendChild(this._createResultRow(entity_id));
    }
  }

  _createResultRow(entity_id) {
    const stateObj = this.hass.states[entity_id];
    const name = stateObj.attributes.friendly_name || entity_id;
    const state = stateObj.state;

    const row = document.createElement("div");
    row.className = "result-row";

    row.innerHTML = `
      <div class="result-name">${this._escapeHtml(name)}</div>
      <div class="result-meta">
        ${this._escapeHtml(entity_id)}
        <span class="separator">-</span>
        <span class="state">${this._escapeHtml(state)}</span>
      </div>
    `;

    row.addEventListener("click", () => {
      this.dispatchEvent(
        new CustomEvent("hass-more-info", {
          bubbles: true,
          composed: true,
          detail: { entityId: entity_id },
        })
      );
    });

    return row;
  }

  _createActionRow(action, matches) {
    const row = document.createElement("div");
    row.className = "action-row";

    const name = matchAndReplace(action.name, matches);
    const icon = action.icon || "mdi:lamp";

    row.innerHTML = `
      <ha-icon icon="${this._escapeHtml(icon)}"></ha-icon>
      <div>
        <div class="action-name">${this._escapeHtml(name)}</div>
        <div class="action-meta">${this._escapeHtml(action.service)}</div>
      </div>
    `;

    row.addEventListener("click", () => {
      const serviceData = {};

      for (const key in action.service_data || {}) {
        serviceData[key] = matchAndReplace(action.service_data[key], matches);
      }

      const [domain, service] = action.service.split(".");

      this.hass.callService(domain, service, serviceData);
      this._clearInput();
    });

    return row;
  }

  _getActivatedActions(searchText) {
    const active = [];

    for (const action of this.actions) {
      if (this._serviceExists(action.service)) {
        const matches = searchText.match(action.matches);

        if (matches !== null) {
          active.push([action, matches]);
        }
      }
    }

    return active;
  }

  _serviceExists(serviceCall) {
    const [domain, service] = serviceCall.split(".");
    const servicesForDomain = this.hass.services[domain];

    return servicesForDomain && service in servicesForDomain;
  }

  _debounce(func, wait) {
    let timeout;

    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };

      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  _escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
}

customElements.define("entity-search-card", EntitySearchCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "entity-search-card",
  name: "Entity Search Card",
  preview: true,
  description: "Card to search Home Assistant entities",
});
