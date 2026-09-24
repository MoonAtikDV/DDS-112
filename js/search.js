window.Search = {
  initDemo() {
    AppState.incidents = [
      {
        num: "36814848",
        date: "17.09.26",
        time: "11:16:53",
        type: "ДТП",
        post: "Нет",
        addr: "Москва, (ТАО, Вороновское), Троицкий административный округ",
        status: "Добавлена",
        desc: "ДТП, столкнулись 2 автомобиля, разлив топлива, есть пострадавшие",
        badge: "101"
      },
      {
        num: "36814845",
        date: "17.09.26",
        time: "11:12:43",
        type: "101",
        post: "Нет",
        addr: "Москва, (ТАО, Вороновское)",
        status: "Добавлена",
        desc: "Пожар в квартире",
        badge: null
      },
      {
        num: "36814844",
        date: "17.09.26",
        time: "11:11:01",
        type: "",
        post: "Нет",
        addr: "",
        status: "Добавлена",
        desc: "ТЕСТ 1",
        badge: null
      },
      {
        num: "36814850",
        date: "17.09.26",
        time: "11:37:02",
        type: "П: Взрыв",
        post: "Нет",
        addr: "Москва, ЦАО",
        status: "Добавлена",
        desc: "Сообщение о звуках, похожих на взрыв",
        badge: null
      },
      {
        num: "36814851",
        date: "17.09.26",
        time: "11:38:33",
        type: "101",
        post: "Нет",
        addr: "ул. Тверская, 12",
        status: "Добавлена",
        desc: "Открытое пламя / дым в доме",
        badge: "101"
      },
      {
        num: "36814830",
        date: "17.09.26",
        time: "10:55:12",
        type: "ДТП",
        post: "Да",
        addr: "Ленинградский пр-т, 45",
        status: "Добавлена",
        desc: "Столкновение, пострадавшие",
        badge: null
      },
      {
        num: "36814820",
        date: "17.09.26",
        time: "10:40:00",
        type: "104",
        post: "Нет",
        addr: "ул. Арбат, 8",
        status: "Добавлена",
        desc: "Запах газа в подъезде",
        badge: null
      }
    ];
  },

  render(filter) {
    filter = filter || "";
    const listEl = $("#search-list");
    if (!listEl) return;
    listEl.innerHTML = "";
    const q = filter.toLowerCase().trim();
    const list = AppState.incidents.filter((inc) => {
      if (!q) return true;
      return (
        (inc.num + inc.type + inc.addr + inc.desc).toLowerCase().indexOf(q) >= 0
      );
    });
    list.forEach((inc) => {
      const card = document.createElement("div");
      card.className = "inc-card";
      card.innerHTML =
        '<div><div class="inc-time">' +
        inc.time +
        '</div><div class="inc-date">' +
        inc.date +
        '</div><div class="inc-num">№ ' +
        inc.num +
        '</div></div><div><div class="inc-type">' +
        (inc.type || "—") +
        (inc.badge ? ' <span class="type-badge">' + inc.badge + "</span>" : "") +
        '</div><div class="inc-addr">' +
        (inc.addr || "Адрес не указан") +
        '</div><div class="inc-desc">' +
        inc.desc +
        '</div></div><div class="inc-status">' +
        inc.status +
        "</div>";
      card.onclick = () => {
        toast("Для заполнения новой карточки дождитесь входящего вызова");
      };
      listEl.appendChild(card);
    });
  },

  updateClock() {
    const el = $("#search-clock");
    if (!el) return;
    const now = new Date();
    const days = [
      "Воскресенье",
      "Понедельник",
      "Вторник",
      "Среда",
      "Четверг",
      "Пятница",
      "Суббота"
    ];
    const months = [
      "Января",
      "Февраля",
      "Марта",
      "Апреля",
      "Мая",
      "Июня",
      "Июля",
      "Августа",
      "Сентября",
      "Октября",
      "Ноября",
      "Декабря"
    ];
    const d = el.querySelector(".date");
    const t = el.querySelector(".time");
    if (d)
      d.textContent =
        days[now.getDay()] +
        ", " +
        now.getDate() +
        " " +
        months[now.getMonth()] +
        " " +
        now.getFullYear();
    if (t)
      t.textContent =
        String(now.getHours()).padStart(2, "0") +
        ":" +
        String(now.getMinutes()).padStart(2, "0") +
        ":" +
        String(now.getSeconds()).padStart(2, "0");
  }
};
