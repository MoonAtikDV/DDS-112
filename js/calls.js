window.Calls = {
  schedule: function () {
    if (AppState.randomCallTimer) clearTimeout(AppState.randomCallTimer);
    AppState.callBusy = false;
    AppState.activeCall = null;
    var self = this;
    AppState.randomCallTimer = setTimeout(function () {
      self.forceIncoming();
      self._loop();
    }, 2000);
  },

  _loop: function () {
    var self = this;
    AppState.randomCallTimer = setTimeout(function () {
      if (!AppState.callBusy && !AppState.activeCall) {
        self.forceIncoming();
      }
      self._loop();
    }, 15000 + Math.random() * 20000);
  },

    forceIncoming: function () {
    if (AppState.activeCall) return;
    var self = this;
    Scenes.randomScene().then(function (scene) {
      if (!scene) {
        toast("Нет сцен в папке scenes/");
        return;
      }
      AppState.activeScene = scene;
      AppState.activeCall = scene;
      AppState.callBusy = true;
      AppState.callDropped = false;
      if (Math.random() < 0.06) {
        AppState.callDropped = true;
        self.showDroppedBar(scene);
        return;
      }
      self.showBar(scene);
      self.playRing();
    });
  },

  trigger: function () {
    AppState.callBusy = false;
    AppState.activeCall = null;
    this.forceIncoming();
  },

  playRing: function () {
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      function beep(freq, start, dur) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        gain.gain.value = 0.12;
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + dur);
      }
      beep(880, 0, 0.25);
      beep(988, 0.32, 0.25);
      beep(880, 0.64, 0.25);
      setTimeout(function () {
        try {
          ctx.close();
        } catch (e) {}
      }, 1100);
    } catch (e) {}
  },

  showBar: function (scene) {
    var bar = document.getElementById("incoming-call-bar");
    if (!bar) {
      alert("Входящий вызов: " + (scene.name || "") + " — элемент табло не найден");
      return;
    }
    document.body.appendChild(bar);
    bar.classList.remove("dropped");
    bar.classList.add("visible");
    bar.style.cssText =
      "display:flex !important; visibility:visible !important; opacity:1 !important; position:fixed; inset:0; z-index:30000; align-items:center; justify-content:center; background:rgba(62,39,35,0.45);";
    var phone = scene.phoneHidden || !scene.phone ? "номер скрыт" : scene.phone;
    var nameEl = document.getElementById("incoming-caller-name");
    if (nameEl) nameEl.textContent = scene.name || "Неизвестный";
    var label = document.getElementById("incoming-caller-label");
    if (label) label.textContent = phone;
    var hint = document.getElementById("incoming-type-hint");
    if (hint) hint.textContent = scene.presumedTitle || "";
    var actions = document.getElementById("incoming-call-actions");
    if (actions) {
      actions.innerHTML =
        '<button type="button" class="accept-only" id="btn-accept-incoming">ПРИНЯТЬ</button>';
    }
  },

  showDroppedBar: function (scene) {
    var bar = document.getElementById("incoming-call-bar");
    if (!bar) return;
    document.body.appendChild(bar);
    bar.classList.add("dropped", "visible");
    bar.style.cssText =
      "display:flex !important; visibility:visible !important; opacity:1 !important; position:fixed; inset:0; z-index:30000; align-items:center; justify-content:center; background:rgba(62,39,35,0.45);";
    var nameEl = document.getElementById("incoming-caller-name");
    if (nameEl) nameEl.textContent = scene.name || "Неизвестный";
    var label = document.getElementById("incoming-caller-label");
    if (label) label.textContent = "Звонок был сброшен";
    var hint = document.getElementById("incoming-type-hint");
    if (hint) hint.textContent = scene.presumedTitle || "";
    var actions = document.getElementById("incoming-call-actions");
    if (actions) {
      actions.innerHTML =
        '<button type="button" class="accept-only redial" id="btn-redial">ПЕРЕЗВОНИТЬ</button>' +
        '<button type="button" class="btn-skip" id="btn-skip-call">Пропустить</button>';
    }
  },

  redial: function () {
    AppState.callDropped = false;
    var scene = AppState.activeScene;
    if (!scene) {
      this.skipDropped();
      return;
    }
    AppState.activeCall = scene;
    AppState.callBusy = true;
    this.showBar(scene);
    this.playRing();
    toast("Повторный вызов");
  },

  skipDropped: function () {
    this.hideBar();
    AppState.activeCall = null;
    AppState.callBusy = false;
    AppState.callDropped = false;
    toast("Вызов пропущен");
  },

  hideBar: function () {
    var bar = document.getElementById("incoming-call-bar");
    if (bar) {
      bar.classList.remove("visible", "dropped");
      bar.style.display = "none";
    }
  },

  accept: function () {
    var scene = AppState.activeScene || AppState.activeCall;
    if (!scene) {
      toast("Нет данных вызова");
      return;
    }
    this.hideBar();
    AppState.activeCall = null;
    AppState.callBusy = true;
    Card.startNew();
    Timer.start();
    var locked = document.getElementById("locked-workspace");
    if (locked) locked.style.display = "none";
    var card = document.getElementById("card-workspace");
    if (card) card.style.display = "flex";
    AppState.mode = "card";
    var navs = document.querySelectorAll(".side-nav button");
    for (var i = 0; i < navs.length; i++) navs[i].classList.remove("active");
    var navCard = document.getElementById("nav-card");
    if (navCard) navCard.classList.add("active");
    var self = this;
    self.openWindow(scene);
    setTimeout(function () { self.openWindow(scene); }, 100);
    setTimeout(function () { self.openWindow(scene); }, 400);
    toast("Вызов принят");
  },

  openWindow: function (scene) {
    if (!scene) scene = AppState.activeScene;
    if (!scene) return;
    AppState.activeScene = scene;

    var old = document.getElementById("caller-window");
    if (old) old.remove();

    var phone = scene.phoneHidden || !scene.phone ? "скрыт / не определён" : scene.phone;
    var urg =
      scene.urgency === "high" ? "ВЫСОКАЯ" : scene.urgency === "medium" ? "Средняя" : "Обычная";
    var type =
      (scene.presumedTitle || "—") +
      (scene.presumedType ? " (" + scene.presumedType + ")" : "");

    var win = document.createElement("div");
    win.id = "caller-window";
    win.className = "caller-window visible";
    win.innerHTML =
      '<div class="cw-header"><span>Сведения о вызове</span><span class="cw-close" id="cw-close">×</span></div>' +
      '<div class="cw-body">' +
      '<div class="cw-row"><span class="cw-label">Кто звонит</span><span class="cw-value" id="cw-name">' +
      (scene.name || "Неизвестный") +
      "</span></div>" +
      '<div class="cw-row"><span class="cw-label">Номер</span><span class="cw-value" id="cw-phone">' +
      phone +
      "</span></div>" +
      '<div class="cw-row"><span class="cw-label">Город</span><span class="cw-value" id="cw-city">' +
      (scene.city || "—") +
      "</span></div>" +
      '<div class="cw-row"><span class="cw-label">Адрес</span><span class="cw-value" id="cw-address">' +
      (scene.address || "—") +
      "</span></div>" +
      '<div class="cw-row"><span class="cw-label">Округ</span><span class="cw-value" id="cw-district">' +
      (scene.district || "—") +
      "</span></div>" +
      '<div class="cw-row"><span class="cw-label">Язык</span><span class="cw-value" id="cw-lang">' +
      (scene.language || "русский") +
      "</span></div>" +
      '<div class="cw-row"><span class="cw-label">Тип</span><span class="cw-value" id="cw-type">' +
      type +
      "</span></div>" +
      '<div class="cw-row"><span class="cw-label">Срочность</span><span class="cw-value' +
      (scene.urgency === "high" ? " urgent" : "") +
      '" id="cw-urgency">' +
      urg +
      "</span></div>" +
      '<div class="cw-row"><span class="cw-label">Что случилось</span><span class="cw-value" id="cw-desc">' +
      (scene.description || "—") +
      "</span></div>" +
      "</div>" +
      '<div class="cw-actions">' +
      '<button type="button" class="primary" id="cw-apply">К карточке</button>' +
      '<button type="button" id="cw-msg">Сообщение</button>' +
      '<button type="button" id="cw-end-call">Сбросить вызов</button>' +
      '<button type="button" id="cw-close-btn">Свернуть</button>' +
      "</div>";

    win.setAttribute(
      "style",
      "display:flex !important;visibility:visible !important;opacity:1 !important;" +
        "position:fixed !important;left:80px;top:90px;width:400px;max-height:80vh;" +
        "z-index:50000 !important;background:#fff8f1 !important;" +
        "border:4px solid #e65100 !important;flex-direction:column;"
    );
    document.body.appendChild(win);

    win.querySelector("#cw-close").onclick = function () {
      Calls.closeWindow();
    };
    win.querySelector("#cw-close-btn").onclick = function () {
      Calls.closeWindow();
    };
    win.querySelector("#cw-end-call").onclick = function () {
      Calls.endCall();
    };
    win.querySelector("#cw-apply").onclick = function () {
      Calls.applyToCard();
    };
    win.querySelector("#cw-msg").onclick = function () {
      Calls.openMessage();
    };
    AppState.callWindowOpen = true;
    this.makeDraggable(win, win.querySelector(".cw-header"));
    this.updateInfoStrip(scene);
  },

  closeWindow: function () {
    var win = document.getElementById("caller-window");
    if (win) {
      win.classList.remove("visible");
      win.style.display = "none";
    }
    AppState.callWindowOpen = false;
  },

  endCall: function () {
    Timer.stop();
    this.closeWindow();
    var strip = document.getElementById("call-info-strip");
    if (strip) {
      strip.classList.remove("visible");
      strip.style.display = "none";
      strip.innerHTML = "";
    }
    AppState.callBusy = false;
    AppState.activeCall = null;
    AppState.callDropped = false;
    toast("Вызов завершён");
  },

  applyToCard: function () {
    toast("Заполните поля карточки вручную. Автоподстановка отключена.");
  },

  openMessage: function () {
    var scene = AppState.activeScene;
    var overlay = document.getElementById("msg-modal");
    var to = document.getElementById("msg-to");
    var hist = document.getElementById("msg-history");
    if (!overlay) return;
    var phone = scene && scene.phone && !scene.phoneHidden ? scene.phone : "номер скрыт";
    var name = scene ? scene.name || "Абонент" : "Абонент";
    if (to) to.value = name + " · " + phone;
    if (hist) {
      var list = AppState.callerMessages || [];
      hist.innerHTML = list.length
        ? "<strong>История:</strong><br>" +
          list
            .map(function (m) {
              return m.at + " — " + m.text;
            })
            .join("<br>")
        : "Сообщений ещё не было";
    }
    var ta = document.getElementById("msg-text");
    if (ta) ta.value = "";
    overlay.classList.add("visible");
  },

  sendMessage: function () {
    var ta = document.getElementById("msg-text");
    var text = (ta && ta.value ? ta.value : "").trim();
    if (!text) {
      toast("Введите текст сообщения");
      return;
    }
    if (!AppState.callerMessages) AppState.callerMessages = [];
    var scene = AppState.activeScene || {};
    AppState.callerMessages.unshift({
      text: text,
      to: scene.name || "Абонент",
      phone: scene.phone || "",
      at: new Date().toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      })
    });
    if (window.DB) DB.saveMessage(scene.name || "Абонент", scene.phone || "", text);
    toast("Сообщение отправлено абоненту");
    var overlay = document.getElementById("msg-modal");
    if (overlay) overlay.classList.remove("visible");
    if (ta) ta.value = "";
  },

  makeDraggable: function (el, handle) {
    if (!handle || !el) return;
    var ox = 0,
      oy = 0,
      dragging = false;
    handle.onmousedown = function (e) {
      dragging = true;
      ox = e.clientX - el.offsetLeft;
      oy = e.clientY - el.offsetTop;
      document.onmousemove = function (e2) {
        if (!dragging) return;
        var left = Math.max(0, Math.min(window.innerWidth - el.offsetWidth, e2.clientX - ox));
        var top = Math.max(0, Math.min(window.innerHeight - 40, e2.clientY - oy));
        el.style.left = left + "px";
        el.style.top = top + "px";
      };
      document.onmouseup = function () {
        dragging = false;
        document.onmousemove = null;
        document.onmouseup = null;
      };
      e.preventDefault();
    };
  }
};
