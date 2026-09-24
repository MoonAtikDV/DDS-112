window.DDS = {
  initDemo() {
    AppState.messages = [
      { id: 1, time: "11:32", type: "Пожар", addr: "ул. Тверская, 12", status: "new", district: "ЦАО" },
      { id: 2, time: "11:28", type: "ДТП", addr: "Ленинградский пр-т, 45", status: "accepted", district: "САО" },
      { id: 3, time: "11:15", type: "Запах газа", addr: "ул. Арбат, 8", status: "done", district: "ЦАО" },
      { id: 4, time: "11:05", type: "Обрушение", addr: "пр. Мира, 100", status: "accepted", district: "СВАО" },
      { id: 5, time: "10:58", type: "БПЛА", addr: "Поселение Вороновское", status: "new", district: "ТиНАО" },
      { id: 6, time: "10:41", type: "Скорая", addr: "ул. Вавилова, 7", status: "new", district: "ЮЗАО" },
      { id: 7, time: "10:22", type: "Подтопление", addr: "Каширское шоссе, 30", status: "accepted", district: "ЮАО" }
    ];
  },

  render() {
    const list = $("#msg-list");
    if (!list) return;
    list.innerHTML = "";
    const labels = {
      new: "Новое",
      accepted: "Принято",
      done: "Завершено",
      rejected: "Отказ"
    };
    AppState.messages.forEach(function (m) {
      const row = document.createElement("div");
      row.className = "msg-row";
      row.innerHTML =
        "<span>" + m.time + "</span><span>" + m.type + "</span><span>" + m.addr +
        "</span><span>" + m.district + '</span><span class="status ' + m.status + '">' +
        (labels[m.status] || m.status) +
        '</span><span><button type="button" class="btn-text open-card">Открыть</button></span>';
      row.querySelector(".open-card").onclick = function (e) {
        e.stopPropagation();
        DDS.openCard(m);
      };
      row.onclick = function () { DDS.openCard(m); };
      list.appendChild(row);
    });
  },

  openCard(m) {

    AppState.callBusy = true;
    Card.startNew();
    Timer.start();
    const locked = $("#locked-workspace");
    if (locked) locked.style.display = "none";
    const card = $("#card-workspace");
    if (card) card.style.display = "flex";
    AppState.mode = "card";
    $$(".side-nav button").forEach(function (b) { b.classList.remove("active"); });
    const nav = document.getElementById("nav-card");
    if (nav) nav.classList.add("active");
    const dds = $("#dds-workspace");
    if (dds) dds.classList.remove("visible");
    if (m) {
      if (m.addr && $("#addr-desc")) $("#addr-desc").value = m.addr;
      if (m.type && $("#desc-text")) $("#desc-text").value = "Обращение: " + m.type + " · " + (m.addr || "");
    }
    toast("Карточка открыта: " + (m ? m.type : ""));
  }
};
