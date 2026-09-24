window.Card = {
  startNew: function () {
    Timer.stop();
    AppState.cardId = "3681" + String(Math.floor(Math.random() * 9000 + 1000));
    AppState.currentScenario = null;
    AppState.selectedScenarios = [];
    AppState.selectedTags = {};
    AppState.scenarioTags = {};
    AppState.services = [];
    AppState.serviceCards = {};
    AppState.description = "";
    AppState.evaluation = null;
    AppState.address = {
      country: "Россия",
      subject: "Москва",
      city: "Москва",
      street: "",
      house: "",
      building: "",
      apartment: "",
      entrance: "",
      floor: "",
      code: "",
      descriptive: ""
    };

    var title = "Происшествие " + AppState.cardId;
    var ct = document.getElementById("card-title");
    var tt = document.getElementById("tab-title");
    if (ct) ct.textContent = title;
    if (tt) tt.textContent = title;

    var area = document.getElementById("scenario-area");
    if (area) area.innerHTML = "";
    this.renderScenarioArea();
    ServicesUI.render();
    this.fillAddressFields();
    var desc = document.getElementById("desc-text");
    if (desc) desc.value = "";
    var nameIn = document.getElementById("caller-name-input");
    if (nameIn) nameIn.value = "";
  },

  fillAddressFields: function () {
    var a = AppState.address;
    var map = {
      "addr-country": a.country,
      "addr-subject": a.subject,
      "addr-city": a.city,
      "addr-street": a.street,
      "addr-house": a.house,
      "addr-building": a.building,
      "addr-apt": a.apartment,
      "addr-entrance": a.entrance,
      "addr-floor": a.floor,
      "addr-code": a.code,
      "addr-desc": a.descriptive
    };
    Object.keys(map).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.value = map[id] || "";
    });
  },

  collect: function () {
    AppState.address = {
      country: (document.getElementById("addr-country") || {}).value || "",
      subject: (document.getElementById("addr-subject") || {}).value || "",
      city: (document.getElementById("addr-city") || {}).value || "",
      street: (document.getElementById("addr-street") || {}).value || "",
      house: (document.getElementById("addr-house") || {}).value || "",
      building: (document.getElementById("addr-building") || {}).value || "",
      apartment: (document.getElementById("addr-apt") || {}).value || "",
      entrance: (document.getElementById("addr-entrance") || {}).value || "",
      floor: (document.getElementById("addr-floor") || {}).value || "",
      code: (document.getElementById("addr-code") || {}).value || "",
      descriptive: (document.getElementById("addr-desc") || {}).value || ""
    };
    AppState.description = (document.getElementById("desc-text") || {}).value || "";
  },

  renderScenarioArea: function () {
    var area = document.getElementById("scenario-area");
    if (!area) return;
    area.innerHTML = "";
    var self = this;
    AppState.selectedScenarios.forEach(function (groupId) {
      var sc = CLASSIFIER.scenarios[groupId];
      if (sc) self.renderScenarioCard(groupId, sc, area);
    });
    this.renderAddTypeButton(area);
  },

  renderAddTypeButton: function (area) {
    area = area || document.getElementById("scenario-area");
    if (!area) return;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "add-type-btn";
    btn.innerHTML = '<span class="ms">add</span> добавить тип происшествия';
    btn.onclick = function () {
      Card.openGroupModal();
    };
    area.appendChild(btn);
  },

  openGroupModal: function () {
    var overlay = document.getElementById("group-modal");
    var body = document.getElementById("group-modal-body");
    if (!overlay || !body) return;
    body.innerHTML = "";
    var self = this;
    CLASSIFIER.groups.forEach(function (g) {
      var already = AppState.selectedScenarios.indexOf(g.id) >= 0;
      var div = document.createElement("button");
      div.type = "button";
      div.className = "list-item" + (already ? " disabled" : "");
      div.disabled = already;
      div.innerHTML =
        '<span class="list-icon">' +
        g.icon +
        "</span><span>" +
        g.name +
        (already ? " · уже добавлен" : "") +
        "</span>";
      if (!already) {
        div.onclick = function () {
          overlay.classList.remove("visible");
          self.addScenario(g.id);
        };
      }
      body.appendChild(div);
    });
    overlay.classList.add("visible");
  },

  addScenario: function (groupId) {
    if (AppState.selectedScenarios.indexOf(groupId) >= 0) {
      toast("Тип уже добавлен");
      return;
    }
    var sc = CLASSIFIER.scenarios[groupId];
    if (!sc) return;
    AppState.selectedScenarios.push(groupId);
    AppState.currentScenario = groupId;
    if (!AppState.scenarioTags[groupId]) AppState.scenarioTags[groupId] = {};
    (sc.services || []).forEach(function (s) {
      if (AppState.services.indexOf(s) < 0) {
        AppState.services.push(s);
        if (!AppState.serviceCards[s]) {
          AppState.serviceCards[s] = {
            status: "направлено",
            priority: "обычный",
            note: "",
            time: new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
          };
        }
      }
    });
    this.renderScenarioArea();
    ServicesUI.render();
  },

  selectScenario: function (groupId) {
    this.addScenario(groupId);
  },

  removeScenario: function (groupId) {
    AppState.selectedScenarios = AppState.selectedScenarios.filter(function (id) {
      return id !== groupId;
    });
    delete AppState.scenarioTags[groupId];
    if (AppState.currentScenario === groupId) {
      AppState.currentScenario =
        AppState.selectedScenarios[AppState.selectedScenarios.length - 1] || null;
    }
    this.rebuildSelectedTags();
    this.renderScenarioArea();
  },

  rebuildSelectedTags: function () {
    AppState.selectedTags = {};
    AppState.selectedScenarios.forEach(function (id) {
      var tags = AppState.scenarioTags[id] || {};
      Object.keys(tags).forEach(function (g) {
        if (!AppState.selectedTags[g]) AppState.selectedTags[g] = [];
        tags[g].forEach(function (v) {
          if (AppState.selectedTags[g].indexOf(v) < 0) AppState.selectedTags[g].push(v);
        });
      });
    });
  },

  renderScenarioCard: function (groupId, sc, area) {
    area = area || document.getElementById("scenario-area");
    if (!area) return;
    var card = document.createElement("div");
    card.className = "scenario-card";
    card.dataset.groupId = groupId;

    var g = CLASSIFIER.groups.find(function (x) {
      return x.id === groupId;
    });
    var header = document.createElement("div");
    header.className = "scenario-header";
    header.innerHTML =
      "<span>" +
      (g ? g.name : sc.title) +
      '</span><button type="button" class="icon-btn remove" aria-label="Удалить"><span class="ms">close</span></button>';
    header.querySelector(".remove").onclick = function () {
      Card.removeScenario(groupId);
    };
    card.appendChild(header);

    if (!AppState.scenarioTags[groupId]) AppState.scenarioTags[groupId] = {};

    (sc.tags || []).forEach(function (tg) {
      var groupEl = document.createElement("div");
      groupEl.className = "tag-group";
      groupEl.innerHTML = '<div class="tag-group-title">' + tg.group + "</div>";
      var opts = document.createElement("div");
      opts.className = "tag-options";
      tg.options.forEach(function (opt) {
        var tag = document.createElement("button");
        tag.type = "button";
        tag.className = "tag";
        tag.textContent = opt;
        tag.dataset.group = tg.group;
        tag.dataset.value = opt;
        var selected = (AppState.scenarioTags[groupId][tg.group] || []).indexOf(opt) >= 0;
        if (selected) tag.classList.add("active");
        tag.onclick = function () {
          Card.toggleTag(tag, tg, groupId);
        };
        opts.appendChild(tag);
      });
      groupEl.appendChild(opts);
      card.appendChild(groupEl);
    });

    area.appendChild(card);
  },

  toggleTag: function (el, tgDef, groupId) {
    var group = tgDef.group;
    var value = el.dataset.value;
    if (!AppState.scenarioTags[groupId]) AppState.scenarioTags[groupId] = {};
    if (!AppState.scenarioTags[groupId][group]) AppState.scenarioTags[groupId][group] = [];
    var arr = AppState.scenarioTags[groupId][group];
    if (tgDef.multi) {
      var idx = arr.indexOf(value);
      if (idx >= 0) {
        arr.splice(idx, 1);
        el.classList.remove("active");
      } else {
        arr.push(value);
        el.classList.add("active");
      }
    } else {
      var card = el.closest(".scenario-card");
      if (card) {
        card.querySelectorAll('.tag[data-group="' + group + '"]').forEach(function (t) {
          t.classList.remove("active");
        });
      }
      AppState.scenarioTags[groupId][group] = [value];
      el.classList.add("active");
    }
    this.rebuildSelectedTags();
  },

  applyScene: function (scene) {
  }
};
