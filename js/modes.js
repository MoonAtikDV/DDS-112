window.Modes = {
  show(mode) {
    AppState.mode = mode;
    const card = $("#card-workspace");
    const locked = $("#locked-workspace");
    const dds = $("#dds-workspace");
    const search = $("#search-workspace");

    const hasActiveSession = !!(AppState.activeScene || AppState.callWindowOpen || AppState.currentScenario);

    if (mode === "card") {
      if (hasActiveSession) {
        if (locked) locked.style.display = "none";
        if (card) card.style.display = "flex";
      } else {
        if (card) card.style.display = "none";
        if (locked) locked.style.display = "flex";
      }
      if (dds) dds.classList.remove("visible");
      if (search) search.classList.remove("visible");
    } else if (mode === "dds") {
      if (card) card.style.display = "none";
      if (locked) locked.style.display = "none";
      if (dds) dds.classList.add("visible");
      if (search) search.classList.remove("visible");
      DDS.render();
    } else if (mode === "search") {
      if (card) card.style.display = "none";
      if (locked) locked.style.display = "none";
      if (dds) dds.classList.remove("visible");
      if (search) search.classList.add("visible");
      Search.render(($("#search-input") || {}).value || "");
      Search.updateClock();
    }

    $$(".side-nav button").forEach((b) => b.classList.remove("active"));
    const map = { card: "nav-card", dds: "nav-dds", search: "nav-search" };
    const btn = document.getElementById(map[mode]);
    if (btn) btn.classList.add("active");
  }
};
