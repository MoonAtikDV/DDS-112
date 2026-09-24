window.$ = (sel, ctx) => (ctx || document).querySelector(sel);
window.$$ = (sel, ctx) => [...(ctx || document).querySelectorAll(sel)];

window.toast = function (msg, ms) {
  ms = ms || 2500;
  const el = $("#toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("visible");
  setTimeout(() => el.classList.remove("visible"), ms);
};

window.roleLabel = function (r) {
  return { admin: "Администратор", teacher: "Преподаватель", student: "Обучающийся" }[r] || r;
};
