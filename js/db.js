window.DB = {
  sessionId: null,
  token: null,
  base: "",

  headers: function () {
    var h = { "Content-Type": "application/json" };
    if (this.token) h.Authorization = "Bearer " + this.token;
    return h;
  },

  post: function (path, data) {
    return fetch(this.base + path, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(data || {})
    })
      .then(function (r) {
        return r.json().catch(function () {
          return {};
        });
      })
      .catch(function () {
        return null;
      });
  },

  get: function (path) {
    var self = this;
    return fetch(this.base + path, { headers: this.headers() })
      .then(function (r) {
        return r.json();
      })
      .catch(function () {
        return null;
      });
  },

  saveEvaluation: function (ev) {
    var payload = {
      session_id: this.sessionId,
      user_login: AppState.userLogin || AppState.userName,
      user_name: AppState.userName,
      role: AppState.role,
      score: ev.score,
      time_sec: ev.time,
      limit_sec: AppState.timerLimit,
      scene_id: (AppState.activeScene || {}).id || null,
      scene_type: (AppState.activeScene || {}).presumedTitle || AppState.currentScenario,
      card_id: AppState.cardId,
      services: AppState.services || [],
      tags: AppState.selectedTags || {},
      errors: (ev.errors || []).map(function (e) {
        return e.msg || e;
      }),
      description: AppState.description || "",
      address: AppState.address || {}
    };
    return this.post("/api/evaluation", payload);
  },

  saveMessage: function (toName, toPhone, body) {
    return this.post("/api/message", {
      user_login: AppState.userLogin || AppState.userName,
      to_name: toName,
      to_phone: toPhone,
      body: body
    });
  },

  saveCard: function () {
    return this.post("/api/card", {
      card_id: AppState.cardId,
      user_login: AppState.userLogin || AppState.userName,
      payload: {
        address: AppState.address,
        description: AppState.description,
        services: AppState.services,
        serviceCards: AppState.serviceCards,
        tags: AppState.selectedTags,
        scenarios: AppState.selectedScenarios
      }
    });
  }
};
