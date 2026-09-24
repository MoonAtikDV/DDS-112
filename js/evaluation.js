window.Evaluation = {
  run: function () {
    Card.collect();
    var errors = [];
    var score = 100;
    var scene = AppState.activeScene;

    var types = AppState.selectedScenarios || [];
    if (!types.length && !AppState.currentScenario) {
      errors.push({ msg: "Не выбран тип происшествия", penalty: 25 });
    } else if (scene && scene.presumedType) {
      if (types.indexOf(scene.presumedType) < 0 && AppState.currentScenario !== scene.presumedType) {
        errors.push({
          msg: "Тип происшествия не совпадает с эталоном (" + scene.presumedType + ")",
          penalty: 15
        });
      }
    }

    var tagCount = Object.values(AppState.selectedTags || {}).flat().length;
    if (types.length && tagCount === 0) {
      errors.push({ msg: "Не выбраны признаки (теги)", penalty: 15 });
    }

    if (scene && scene.correctTags) {
      var tagMiss = 0;
      Object.keys(scene.correctTags).forEach(function (group) {
        var expected = scene.correctTags[group] || [];
        var got = AppState.selectedTags[group] || [];
        expected.forEach(function (t) {
          if (got.indexOf(t) < 0) tagMiss++;
        });
      });
      if (tagMiss > 0) {
        errors.push({
          msg: "Не выбраны эталонные признаки: " + tagMiss + " шт.",
          penalty: Math.min(20, tagMiss * 5)
        });
      }
    }

    if (!AppState.address.street && !AppState.address.descriptive) {
      errors.push({ msg: "Не заполнен адрес", penalty: 12 });
    }
    if (!AppState.description || AppState.description.length < 8) {
      errors.push({ msg: "Описание слишком короткое", penalty: 8 });
    }

    var expectedServices = [];
    if (scene && scene.correctServices && scene.correctServices.length) {
      expectedServices = scene.correctServices.slice();
    } else if (types.length) {
      types.forEach(function (tid) {
        var rec = (CLASSIFIER.scenarios[tid] || {}).services || [];
        rec.forEach(function (s) {
          if (expectedServices.indexOf(s) < 0) expectedServices.push(s);
        });
      });
    }

    if (expectedServices.length) {
      var missing = expectedServices.filter(function (s) {
        return AppState.services.indexOf(s) < 0;
      });
      if (missing.length) {
        errors.push({
          msg: "Не подключены нужные службы: " + missing.slice(0, 4).join(", "),
          penalty: Math.min(25, missing.length * 6)
        });
      }
      var extra = AppState.services.filter(function (s) {
        return expectedServices.indexOf(s) < 0;
      });
      if (extra.length) {
        errors.push({
          msg: "Лишние службы (не вызывать): " + extra.slice(0, 5).join(", "),
          penalty: Math.min(25, extra.length * 6)
        });
      }
    } else if (AppState.services.length > 6) {
      errors.push({
        msg: "Слишком много служб без основания (" + AppState.services.length + ")",
        penalty: 10
      });
    }

    AppState.services.forEach(function (s) {
      var card = (AppState.serviceCards || {})[s];
      if (!card || !card.status) {
        errors.push({
          msg: "Не заполнена карточка службы: " + s,
          penalty: 3
        });
      }
    });

    if (AppState.timerSeconds > AppState.timerLimit) {
      var overtime = AppState.timerSeconds - AppState.timerLimit;
      errors.push({
        msg: "Превышен норматив на " + overtime + " сек",
        penalty: Math.min(20, Math.ceil(overtime / 5) * 2)
      });
    }

    var desc = AppState.description || "";
    if (desc.length > 8) {
      var bad = /(.)\1{4,}/.test(desc) || desc === desc.toUpperCase() && desc.length > 20;
      if (bad) {
        errors.push({ msg: "Описание: проверьте грамотность / качество текста", penalty: 5 });
      }
    }

    errors.forEach(function (e) {
      score -= e.penalty;
    });
    if (score < 0) score = 0;

    AppState.evaluation = {
      score: score,
      errors: errors,
      time: AppState.timerSeconds,
      tagCount: tagCount,
      services: AppState.services.slice(),
      extraServices: expectedServices.length
        ? AppState.services.filter(function (s) {
            return expectedServices.indexOf(s) < 0;
          })
        : [],
      missingServices: expectedServices.filter(function (s) {
        return AppState.services.indexOf(s) < 0;
      })
    };

    Timer.stop();
    AppState.callBusy = false;
    this.showModal();
    if (window.DB) DB.saveEvaluation(AppState.evaluation);
    if (AppState.role === "teacher" || AppState.role === "admin") {
      this.addStudentResult(AppState.userName, score, AppState.timerSeconds);
    }
    try {
      var hist = JSON.parse(localStorage.getItem("dds_results") || "[]");
      hist.unshift({
        user: AppState.userName,
        score: score,
        time: AppState.timerSeconds,
        limit: AppState.timerLimit,
        scene: (AppState.activeScene || {}).id || null,
        type: (AppState.activeScene || {}).presumedTitle || AppState.currentScenario,
        errors: errors.map(function (e) {
          return e.msg;
        }),
        at: new Date().toISOString()
      });
      localStorage.setItem("dds_results", JSON.stringify(hist.slice(0, 100)));
    } catch (e) {}
  },

  showModal: function () {
    var overlay = document.getElementById("eval-modal");
    var body = document.getElementById("eval-modal-body");
    if (!overlay || !body) return;
    var ev = AppState.evaluation;
    var html = "<h3>Результат оценки</h3>";
    html +=
      '<div class="eval-item"><span>Время</span><span>' +
      ev.time +
      " сек (норматив " +
      AppState.timerLimit +
      ")</span></div>";
    html +=
      '<div class="eval-item"><span>Признаков</span><span>' +
      ev.tagCount +
      "</span></div>";
    html +=
      '<div class="eval-item"><span>Служб</span><span>' +
      AppState.services.length +
      "</span></div>";
    if (ev.extraServices && ev.extraServices.length) {
      html +=
        '<div class="eval-item"><span class="err">Лишние службы</span><span class="err">' +
        ev.extraServices.join(", ") +
        "</span></div>";
    }
    if (ev.missingServices && ev.missingServices.length) {
      html +=
        '<div class="eval-item"><span class="err">Не хватает</span><span class="err">' +
        ev.missingServices.join(", ") +
        "</span></div>";
    }
    if (AppState.activeScene) {
      html +=
        '<div class="eval-item"><span>Сцена</span><span>' +
        AppState.activeScene.id +
        "</span></div>";
    }
    if (!ev.errors.length) {
      html += '<div class="eval-item"><span class="ok">Замечаний нет</span></div>';
    } else {
      ev.errors.forEach(function (e) {
        html +=
          '<div class="eval-item"><span class="err">' +
          e.msg +
          '</span><span class="err">−' +
          e.penalty +
          "</span></div>";
      });
    }
    var color =
      ev.score >= 80 ? "var(--ok-bg)" : ev.score >= 50 ? "var(--warn-bg)" : "var(--err-bg)";
    html +=
      '<div class="total-score" style="background:' +
      color +
      '">Итого: ' +
      ev.score +
      "% верных действий</div>";
    body.innerHTML = html;
    overlay.classList.add("visible");
  },

  addStudentResult: function (name, score, time) {
    var list = document.getElementById("student-results");
    if (!list) return;
    var li = document.createElement("li");
    li.innerHTML =
      "<span>" +
      name +
      '</span><span class="score ' +
      (score < 50 ? "bad" : "") +
      '">' +
      score +
      " б. (" +
      time +
      "с)</span>";
    list.prepend(li);
  },

  exportReport: function () {
    try {
      var hist = JSON.parse(localStorage.getItem("dds_results") || "[]");
      var text =
        "Отчёт по практическому занятию\n" +
        "Оператор: " +
        AppState.userName +
        "\nРоль: " +
        AppState.role +
        "\nДата: " +
        new Date().toLocaleString("ru-RU") +
        "\n\n";
      hist.slice(0, 20).forEach(function (h, i) {
        text +=
          i +
          1 +
          ") " +
          h.at +
          " | " +
          h.user +
          " | " +
          h.score +
          " б. | " +
          h.time +
          "с / " +
          h.limit +
          "с | " +
          (h.type || "") +
          "\n   Ошибки: " +
          (h.errors || []).join("; ") +
          "\n";
      });
      var blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "report_dds_" + Date.now() + ".txt";
      a.click();
      toast("Отчёт выгружен");
    } catch (e) {
      toast("Не удалось выгрузить отчёт");
    }
  }
};
