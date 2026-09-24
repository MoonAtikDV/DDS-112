(function () {
  "use strict";

  function bind() {
    if (typeof Login === "undefined") {
      console.error("Login module missing");
      return;
    }
    Login.init();

    function on(id, ev, fn) {
      var el = document.getElementById(id);
      if (el) el.addEventListener(ev, fn);
    }

    on("btn-new-card", "click", function () {
      Card.startNew();
    });
    on("btn-save", "click", function () {
      Card.collect();
      if (window.DB) DB.saveCard();
      toast("Карточка сохранена");
    });
    on("btn-eval", "click", function () {
      Evaluation.run();
    });
    on("btn-eval-teacher", "click", function () {
      Evaluation.run();
    });
    on("btn-add-service", "click", function () {
      ServicesUI.openModal();
    });

    var callActions = document.getElementById("incoming-call-actions");
    if (callActions) {
      callActions.addEventListener("click", function (e) {
        var btn = e.target.closest("button");
        if (!btn) return;
        if (btn.id === "btn-redial" || btn.classList.contains("redial")) {
          Calls.redial();
        } else if (btn.id === "btn-skip-call") {
          Calls.skipDropped();
        } else if (
          btn.id === "btn-accept-incoming" ||
          btn.classList.contains("accept-only")
        ) {
          Calls.accept();
        }
      });
    }

    on("cw-close", "click", function () {
      Calls.closeWindow();
    });
    on("cw-close-btn", "click", function () {
      Calls.closeWindow();
    });
    on("cw-end-call", "click", function () {
      Calls.endCall();
    });
    on("cw-apply", "click", function () {
      Calls.applyToCard();
    });
    on("cw-msg", "click", function () {
      Calls.openMessage();
    });
    on("msg-send", "click", function () {
      Calls.sendMessage();
    });
    on("btn-export-report", "click", function () {
      Evaluation.exportReport();
    });

    on("nav-card", "click", function () {
      Modes.show("card");
    });
    on("nav-dds", "click", function () {
      Modes.show("dds");
    });
    on("nav-search", "click", function () {
      Modes.show("search");
    });

    var tip = document.getElementById("side-tooltip");
    function showTip(el) {
      var text = el.getAttribute("data-tip");
      if (!tip || !text) return;
      tip.textContent = text;
      tip.classList.add("visible");
      var r = el.getBoundingClientRect();
      var left = r.right + 10;
      var top = r.top + r.height / 2 - tip.offsetHeight / 2;
      if (left + tip.offsetWidth > window.innerWidth - 8) {
        left = r.left - tip.offsetWidth - 10;
      }
      if (left < 8) left = 8;
      if (top < 8) top = 8;
      if (top + tip.offsetHeight > window.innerHeight - 8) {
        top = window.innerHeight - tip.offsetHeight - 8;
      }
      tip.style.left = left + "px";
      tip.style.top = top + "px";
    }
    function hideTip() {
      if (tip) tip.classList.remove("visible");
    }
    document.querySelectorAll("[data-tip]").forEach(function (el) {
      el.addEventListener("mouseenter", function () {
        showTip(el);
      });
      el.addEventListener("mouseleave", hideTip);
    });

    document
      .querySelectorAll(
        ".tag, .action-btn, .btn-chip, .icon-btn, .side-nav button, .svc-chip, .list-item, .accept-only, .fab, .inc-card, .msg-row"
      )
      .forEach(function (el) {
        el.classList.add("noise-hover");
      });

    on("search-input", "input", function (e) {
      Search.render(e.target.value);
    });
    on("search-reset", "click", function () {
      var si = $("#search-input");
      if (si) si.value = "";
      Search.render("");
    });

    on("btn-call-demo", "click", function () {
      Calls.trigger();
    });

    document.querySelectorAll(".modal-close").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var o = btn.closest(".modal-overlay");
        if (o) o.classList.remove("visible");
      });
    });

    on("btn-addr-moscow", "click", function () {
      if ($("#addr-subject")) $("#addr-subject").value = "Москва";
      if ($("#addr-city")) $("#addr-city").value = "Москва";
      if ($("#addr-country")) $("#addr-country").value = "Россия";
    });

    on("timer-limit", "change", function (e) {
      AppState.timerLimit = parseInt(e.target.value, 10) || 30;
      toast("Норматив: " + AppState.timerLimit + " сек");
    });

    on("btn-logout", "click", function () {
      Timer.stop();
      if (AppState.randomCallTimer) clearTimeout(AppState.randomCallTimer);
      location.reload();
    });

    setInterval(function () {
      Search.updateClock();
    }, 1000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
})();
