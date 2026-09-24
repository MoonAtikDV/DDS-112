window.Timer = {
  start() {
    this.stop();
    AppState.timerSeconds = 0;
    this.updateUI();
    AppState.timerInterval = setInterval(() => {
      AppState.timerSeconds++;
      this.updateUI();
    }, 1000);
  },

  stop() {
    if (AppState.timerInterval) clearInterval(AppState.timerInterval);
    AppState.timerInterval = null;
  },

  updateUI() {
    const el = $("#timer");
    if (!el) return;
    const m = String(Math.floor(AppState.timerSeconds / 60)).padStart(2, "0");
    const s = String(AppState.timerSeconds % 60).padStart(2, "0");
    const timeEl = el.querySelector(".time");
    if (timeEl) timeEl.textContent = m + ":" + s;
    el.classList.remove("warn", "over");
    if (AppState.timerSeconds > AppState.timerLimit) el.classList.add("over");
    else if (AppState.timerSeconds > AppState.timerLimit * 0.7) el.classList.add("warn");
  }
};
