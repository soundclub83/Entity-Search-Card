customElements.whenDefined("card-tools").then(() => {
  var ct = customElements.get("card-tools");

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
    for (var i = 0; i < matches.length; i++) {
      text = text.replace("{" + i + "}", matches[i]);
    }
    return text;
  };

  class SearchCard extends ct.LitElement {
    static get properties() {
      return {
        config: { type: Object },
        hass: { type: Object },
        _results: { type: Array },
        _activeActions: { type: Array },
        _searchValue: { type: String },
        _lastHass: { type: Object },
      };
    }

    constructor() {
      super();
      this._results = [];
      this._activeActions = [];
      this._searchValue = "";
      this._lastHass = null;
      this._debouncedSearch = this._debounce((searchText) => {
        this._performSearch(searchText);
      }, 100);
    }

    shouldUpdate(changedProps) {
      return (
        changedProps.has("config") ||
        changedProps.has("_results") ||
        changedProps.has("_activeActions") ||
        changedProps.has("_searchValue")
      );
    }

    setConfig(config) {
      this.config = config;
      this.max_results = this.config.max_results || 10;
      this.search_text = this.config.search_text || "Type to search...";
      this.actions = BUILTIN_ACTIONS.concat(this.config.actions || []);
      this.included_domains = this.config.included_domains;
      this.excluded_domains = this.config.excluded_domains || [];
    }

    getCardSize() {
      return 3;
    }

    render() {
      const results = this._results.slice(0, this.max_results).sort();
      const rows = results.map((entity_id) => this._createResultRow(entity_id));
      const actions = this._activeActions.map((x) =>
        this._createActionRow(x[0], x[1])
      );

      return ct.LitHtml`
        <ha-card class="${rows.length > 0 || actions.length > 0 ? "expanded" : "collapsed"}">
          <div id="searchContainer">
            <div id="searchTextFieldContainer">
              <ha-icon icon="mdi:magnify" id="searchIcon"></ha-icon>

              <input
                id="searchText"
                .value="${this._searchValue}"
                @input="${this._valueChanged}"
                type="text"
                autocomplete="off"
                placeholder="${this.search_text}"
              >

              <ha-icon-button
                id="clearButton"
                @click="${this._clearInput}"
                alt="Clear"
                title="Clear"
              >
                <ha-icon icon="mdi:close"></ha-icon>
              </ha-icon-button>
            </div>

            ${
              results.length > 0
                ? ct.LitHtml`
                    <div id="count">
                      Showing ${results.length} of ${this._results.length} results
                    </div>
                  `
                : ""
            }
          </div>

          ${
            rows.length > 0 || actions.length > 0
              ? ct.LitHtml`
                  <div id="results">
                    ${actions}
                    ${rows}
                  </div>
                `
              : ""
          }
        </ha-card>
      `;
    }

    _createResultRow(entity_id) {
      var row = ct.createEntityRow({ entity: entity_id });
      row.addEventListener("click", () => ct.moreInfo(entity_id));
      row.hass = this.hass;
      return row;
    }

    _createActionRow(action, matches) {
      var service_data = action.service_data;

      for (var key in service_data) {
        service_data[key] = matchAndReplace(service_data[key], matches);
      }

      const elem = cardTools.createThing("service-row", {
        type: "call",
        name: matchAndReplace(action.name, matches),
        icon: action.icon || "mdi:lamp",
        service: action.service,
        service_data: service_data,
      });

      elem.hass = this.hass;
      return elem;
    }

    _valueChanged(ev) {
      this._searchValue = ev.target.value;
      this._debouncedSearch(this._searchValue);
    }

    _clearInput() {
      this._searchValue = "";
      this._results = [];
      this._activeActions = [];
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

    _performSearch(searchText) {
      if (!this.config || !this.hass || searchText === "") {
        this._results = [];
        this._activeActions = [];
        return;
      }

      try {
        const searchRegex = new RegExp(searchText, "i");
        const newResults = [];

        for (const entity_id in this.hass.states) {
          if (
            (entity_id.search(searchRegex) >= 0 ||
              this.hass.states[entity_id].attributes.friendly_name?.search(
                searchRegex
              ) >= 0) &&
            (this.included_domains
              ? this.included_domains.includes(entity_id.split(".")[0])
              : !this.excluded_domains.includes(entity_id.split(".")[0]))
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
    }

    _getActivatedActions(searchText) {
      var active = [];

      for (const action of this.actions) {
        if (this._serviceExists(action.service)) {
          var matches = searchText.match(action.matches);

          if (matches != null) {
            active.push([action, matches]);
          }
        }
      }

      return active;
    }

    _serviceExists(serviceCall) {
      var [domain, service] = serviceCall.split(".");
      var servicesForDomain = this.hass.services[domain];

      return servicesForDomain && service in servicesForDomain;
    }

    static get styles() {
      return ct.LitCSS`
        ha-card {
          background: rgba(28, 39, 49, 0.92);
          border-radius: 16px;
          box-shadow: none;
          border: none;
          overflow: hidden;
          padding: 0;
        }

        #searchContainer {
          width: 100%;
          display: block;
          padding: 0;
          margin: 0;
        }

        #searchTextFieldContainer {
          display: grid;
          grid-template-columns: 24px 1fr 32px;
          align-items: center;
          box-sizing: border-box;
          width: 100%;
          min-height: 44px;
          height: 44px;
          padding: 0 8px 0 12px;
          border-radius: 16px;
          background: rgba(28, 39, 49, 0.92);
          border: 1px solid rgba(255,255,255,0.06);
        }

        ha-card.expanded #searchTextFieldContainer {
          border-bottom-left-radius: 0;
          border-bottom-right-radius: 0;
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }

        #searchIcon {
          color: var(--secondary-text-color);
          opacity: 0.85;
          --mdc-icon-size: 20px;
        }

        #searchText {
          width: 100%;
          height: 42px;
          border: none;
          outline: none;
          background: transparent;
          color: var(--primary-text-color);
          font-size: 15px;
          font-family: inherit;
          box-sizing: border-box;
          padding-left: 6px;
        }

        #searchText::placeholder {
          color: var(--secondary-text-color);
          opacity: 0.8;
        }

        #clearButton {
          color: var(--secondary-text-color);
          --mdc-icon-button-size: 32px;
          --mdc-icon-size: 20px;
        }

        #count {
          text-align: right;
          font-style: italic;
          font-size: 11px;
          color: var(--secondary-text-color);
          opacity: 0.75;
          padding: 6px 10px 2px 10px;
        }

        #results {
          width: 100%;
          display: block;
          margin: 0;
          padding: 0 6px 6px 6px;
          background: rgba(28, 39, 49, 0.92);
          box-sizing: border-box;
        }

        #results > * {
          min-height: 42px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          box-sizing: border-box;
        }

        #results hui-generic-entity-row,
        #results state-card-content,
        #results div.entity {
          padding-left: 4px !important;
          padding-right: 4px !important;
          box-sizing: border-box;
        }

        #results > *:last-child {
          border-bottom: none;
        }
      `;
    }
  }

  customElements.define("entity-search-card", SearchCard);
});

setTimeout(() => {
  if (customElements.get("card-tools")) return;

  customElements.define(
    "entity-search-card",
    class extends HTMLElement {
      setConfig() {
        throw new Error(
          "Can't find card-tools. See https://github.com/thomasloven/lovelace-card-tools"
        );
      }
    }
  );
}, 2000);

window.customCards = window.customCards || [];

window.customCards.push({
  type: "entity-search-card",
  name: "Entity Search Card",
  preview: true,
  description: "Card to search entities",
});
