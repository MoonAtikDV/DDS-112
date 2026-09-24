window.ServicesUI = {
  render: function () {
    var bar = document.getElementById("services-list");
    if (!bar) return;
    bar.innerHTML = "";
    var now = new Date();
    var timeStr =
      String(now.getHours()).padStart(2, "0") +
      ":" +
      String(now.getMinutes()).padStart(2, "0");
    AppState.services.forEach(function (s, i) {
      if (!AppState.serviceCards[s]) {
        AppState.serviceCards[s] = {
          status: "направлено",
          priority: "обычный",
          note: "",
          time: timeStr
        };
      }
      var card = AppState.serviceCards[s];
      var chip = document.createElement("div");
      chip.className = "svc-chip";
      chip.innerHTML =
        '<span class="svc-name">' +
        s +
        '</span><span class="svc-meta">' +
        (card.time || timeStr) +
        " · " +
        (card.status || "направлено") +
        '</span><button type="button" class="svc-edit" data-s="' +
        s +
        '" title="Карточка службы">✎</button><button type="button" class="svc-x" data-i="' +
        i +
        '">×</button>';
      chip.querySelector(".svc-edit").onclick = function (e) {
        e.stopPropagation();
        ServicesUI.openServiceCard(s);
      };
      chip.querySelector(".svc-x").onclick = function (e) {
        e.stopPropagation();
        AppState.services.splice(i, 1);
        delete AppState.serviceCards[s];
        ServicesUI.render();
      };
      chip.onclick = function () {
        ServicesUI.openServiceCard(s);
      };
      bar.appendChild(chip);
    });
  },

  openModal: function () {
    var overlay = document.getElementById("service-modal");
    var body = document.getElementById("service-modal-body");
    if (!overlay || !body) return;
    body.innerHTML = "";
    body.className = "modal-body services-grid";
    (CLASSIFIER.allServices || []).forEach(function (s) {
      var selected = AppState.services.indexOf(s) >= 0;
      var div = document.createElement("button");
      div.type = "button";
      div.className = "list-item service-item" + (selected ? " selected" : "");
      div.textContent = s;
      div.onclick = function () {
        if (selected) {
          AppState.services = AppState.services.filter(function (x) {
            return x !== s;
          });
          delete AppState.serviceCards[s];
        } else {
          AppState.services.push(s);
          AppState.serviceCards[s] = {
            status: "направлено",
            priority: "обычный",
            note: "",
            time: new Date().toLocaleTimeString("ru-RU", {
              hour: "2-digit",
              minute: "2-digit"
            })
          };
        }
        ServicesUI.render();
        ServicesUI.openModal();
      };
      body.appendChild(div);
    });
    overlay.classList.add("visible");
  },

  openServiceCard: function (serviceName) {
    if (!AppState.serviceCards[serviceName]) {
      AppState.serviceCards[serviceName] = {
        status: "направлено",
        priority: "обычный",
        note: "",
        time: new Date().toLocaleTimeString("ru-RU", {
          hour: "2-digit",
          minute: "2-digit"
        })
      };
    }
    var c = AppState.serviceCards[serviceName];
    var overlay = document.getElementById("svc-card-modal");
    var body = document.getElementById("svc-card-modal-body");
    var title = document.getElementById("svc-card-modal-title");
    if (!overlay || !body) return;
    if (title) title.textContent = "Карточка службы · " + serviceName;
    body.innerHTML =
      '<div class="field"><label>Статус передачи</label>' +
      '<select id="svc-status">' +
      ["направлено", "принято", "в пути", "на месте", "отказ", "завершено"]
        .map(function (st) {
          return (
            '<option value="' +
            st +
            '"' +
            (c.status === st ? " selected" : "") +
            ">" +
            st +
            "</option>"
          );
        })
        .join("") +
      "</select></div>" +
      '<div class="field"><label>Приоритет</label>' +
      '<select id="svc-priority">' +
      ["обычный", "повышенный", "экстренный"]
        .map(function (p) {
          return (
            '<option value="' +
            p +
            '"' +
            (c.priority === p ? " selected" : "") +
            ">" +
            p +
            "</option>"
          );
        })
        .join("") +
      "</select></div>" +
      '<div class="field"><label>Время передачи</label>' +
      '<input type="text" id="svc-time" value="' +
      (c.time || "") +
      '" /></div>' +
      '<div class="field"><label>Комментарий для службы</label>' +
      '<textarea id="svc-note" rows="3" placeholder="Что передать службе…">' +
      (c.note || "") +
      "</textarea></div>" +
      '<div class="field"><label>Адрес для службы</label>' +
      '<input type="text" id="svc-addr" value="' +
      (c.addr ||
        (document.getElementById("addr-desc") || {}).value ||
        "") +
      '" /></div>' +
      '<button type="button" class="btn-primary" id="svc-card-save" style="width:100%;margin-top:8px;">Сохранить</button>';
    overlay.classList.add("visible");
    var saveBtn = document.getElementById("svc-card-save");
    if (saveBtn) {
      saveBtn.onclick = function () {
        AppState.serviceCards[serviceName] = {
          status: (document.getElementById("svc-status") || {}).value || "направлено",
          priority: (document.getElementById("svc-priority") || {}).value || "обычный",
          time: (document.getElementById("svc-time") || {}).value || "",
          note: (document.getElementById("svc-note") || {}).value || "",
          addr: (document.getElementById("svc-addr") || {}).value || ""
        };
        overlay.classList.remove("visible");
        ServicesUI.render();
        toast("Карточка службы сохранена");
      };
    }
  }
};
