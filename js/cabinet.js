window.Cabinet = {
  role: null,
  token: null,
  user: null,

  authHeaders: function () {
    return {
      "Content-Type": "application/json",
      Authorization: "Bearer " + (this.token || "")
    };
  },

  init: function (role) {
    this.role = role;
    try {
      this.token = sessionStorage.getItem("dds_token") || "";
      this.user = JSON.parse(sessionStorage.getItem("dds_user") || "null");
    } catch (e) {
      this.user = null;
    }
    if (!this.token || !this.user) {
      location.replace("index.html");
      return;
    }
    if (this.user.role !== role) {
      if (this.user.role === "admin") {
        location.replace("admin.html");
        return;
      }
      if (this.user.role === "teacher") {
        location.replace("teacher.html");
        return;
      }
      location.replace("index.html");
      return;
    }
    var who = document.getElementById("who");
    if (who) {
      who.textContent =
        (this.user.full_name || this.user.login) + " · " + this.user.role;
    }
    var self = this;
    var logout = document.getElementById("btn-logout");
    if (logout) {
      logout.onclick = function () {
        fetch("/api/auth/logout", {
          method: "POST",
          headers: self.authHeaders(),
          body: JSON.stringify({ token: self.token })
        }).finally(function () {
          try {
            sessionStorage.clear();
          } catch (e) {}
          location.replace("index.html");
        });
      };
    }
    document.querySelectorAll(".cab-nav button, .tabs button").forEach(function (b) {
      b.onclick = function () {
        document.querySelectorAll(".cab-nav button, .tabs button").forEach(function (x) {
          x.classList.remove("active");
        });
        b.classList.add("active");
        var t = b.getAttribute("data-t");
        document.querySelectorAll(".panel").forEach(function (p) {
          p.classList.remove("on");
        });
        var panel = document.getElementById("p-" + t);
        if (panel) panel.classList.add("on");
      };
    });
    this.heartbeat();
    setInterval(function () {
      self.heartbeat();
    }, 15000);
    if (role === "admin") this.initAdmin();
    if (role === "teacher") this.initTeacher();
  },

  heartbeat: function () {
    fetch("/api/presence/heartbeat", {
      method: "POST",
      headers: this.authHeaders(),
      body: JSON.stringify({ token: this.token })
    }).catch(function () {});
  },

  initAdmin: function () {
    var self = this;
    var b;
    b = document.getElementById("btn-refresh-users");
    if (b) b.onclick = function () { self.loadUsers(); };
    b = document.getElementById("btn-create-user");
    if (b) b.onclick = function () { self.createUser(); };
    b = document.getElementById("btn-ref-online");
    if (b) b.onclick = function () { self.loadOnline(); };
    b = document.getElementById("btn-ref-eval");
    if (b) b.onclick = function () { self.loadEval(); };
    b = document.getElementById("btn-ais-save");
    if (b) b.onclick = function () { self.saveAis(); };
    b = document.getElementById("btn-ais-ping");
    if (b) b.onclick = function () { self.pingAis(); };
    b = document.getElementById("btn-cfg-save");
    if (b) b.onclick = function () { self.saveCfg(); };
    this.loadUsers();
    this.loadOnline();
    this.loadEval();
    this.loadAis();
  },

  initTeacher: function () {
    var self = this;
    var b;
    b = document.getElementById("btn-ref-students");
    if (b) b.onclick = function () { self.loadOnlineStudents(); };
    b = document.getElementById("btn-send-as");
    if (b) b.onclick = function () { self.sendAssignment(); };
    b = document.getElementById("btn-ref-online");
    if (b) b.onclick = function () { self.loadOnlineStudentsTable(); };
    b = document.getElementById("btn-ref-eval");
    if (b) b.onclick = function () { self.loadEval(); };
    this.loadOnlineStudents();
    this.loadOnlineStudentsTable();
    this.loadAssignments();
    this.loadEval();
  },

  loadUsers: function () {
    var self = this;
    fetch("/api/users", { headers: this.authHeaders() })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var tb = document.getElementById("users-tb");
        if (!tb) return;
        if (data && data.error) {
          tb.innerHTML = "<tr><td colspan='5'>" + data.error + "</td></tr>";
          return;
        }
        var items = (data && data.items) || [];
        tb.innerHTML = items
          .map(function (u) {
            return (
              "<tr><td>" +
              u.login +
              "</td><td>" +
              (u.full_name || "") +
              "</td><td>" +
              u.role +
              '</td><td><span class="badge' +
              (u.active ? "" : " off") +
              '">' +
              (u.active ? "активен" : "отключён") +
              '</span></td><td><button type="button" class="btn ghost" data-act="toggle" data-login="' +
              u.login +
              '" data-active="' +
              (u.active ? "0" : "1") +
              '">' +
              (u.active ? "Отключить" : "Включить") +
              "</button></td></tr>"
            );
          })
          .join("");
        tb.querySelectorAll("button[data-act=toggle]").forEach(function (btn) {
          btn.onclick = function () {
            fetch("/api/users/set-active", {
              method: "POST",
              headers: self.authHeaders(),
              body: JSON.stringify({
                token: self.token,
                login: btn.getAttribute("data-login"),
                active: btn.getAttribute("data-active") === "1"
              })
            }).then(function () { self.loadUsers(); });
          };
        });
      })
      .catch(function () {
        var tb = document.getElementById("users-tb");
        if (tb) tb.innerHTML = "<tr><td colspan='5'>Нет связи с сервером</td></tr>";
      });
  },

  createUser: function () {
    var self = this;
    var body = {
      token: this.token,
      login: (document.getElementById("nu-login").value || "").trim(),
      full_name: (document.getElementById("nu-name").value || "").trim(),
      role: document.getElementById("nu-role").value,
      password: document.getElementById("nu-pass").value
    };
    fetch("/api/users/create", {
      method: "POST",
      headers: this.authHeaders(),
      body: JSON.stringify(body)
    })
      .then(function (r) {
        return r.json().then(function (j) { return { s: r.status, j: j }; });
      })
      .then(function (res) {
        var msg = document.getElementById("users-msg");
        if (res.s === 200 && res.j.ok) {
          msg.className = "msg ok";
          msg.textContent = "Учётка создана";
          self.loadUsers();
        } else {
          msg.className = "msg err";
          msg.textContent = (res.j && res.j.error) || "Ошибка";
        }
      });
  },

  loadOnline: function () {
    fetch("/api/online")
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var tb = document.getElementById("online-tb");
        if (!tb) return;
        var items = (data && data.items) || [];
        tb.innerHTML = items.length
          ? items
              .map(function (u) {
                return (
                  "<tr><td>" +
                  u.login +
                  "</td><td>" +
                  (u.full_name || "") +
                  "</td><td>" +
                  u.role +
                  '</td><td><span class="badge">в сети</span></td></tr>'
                );
              })
              .join("")
          : "<tr><td colspan='4'>Никого нет в сети</td></tr>";
      });
  },

  loadOnlineStudents: function () {
    fetch("/api/online?role=student")
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var sel = document.getElementById("as-student");
        if (!sel) return;
        var items = (data && data.items) || [];
        sel.innerHTML = items.length
          ? items
              .map(function (u) {
                return (
                  '<option value="' +
                  u.login +
                  '">' +
                  u.login +
                  " · " +
                  (u.full_name || "") +
                  " (онлайн)</option>"
                );
              })
              .join("")
          : '<option value="">Нет учеников в сети</option>';
      });
  },

  loadOnlineStudentsTable: function () {
    fetch("/api/online?role=student")
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var tb = document.getElementById("online-tb");
        if (!tb) return;
        var items = (data && data.items) || [];
        tb.innerHTML = items.length
          ? items
              .map(function (u) {
                return (
                  "<tr><td>" +
                  u.login +
                  "</td><td>" +
                  (u.full_name || "") +
                  '</td><td><span class="badge">в сети</span></td></tr>'
                );
              })
              .join("")
          : "<tr><td colspan='3'>Нет учеников в сети</td></tr>";
      });
  },

  sendAssignment: function () {
    var self = this;
    var body = {
      token: this.token,
      student_login: document.getElementById("as-student").value,
      title: (document.getElementById("as-title").value || "").trim(),
      body: document.getElementById("as-body").value,
      scene_id: (document.getElementById("as-scene").value || "").trim()
    };
    fetch("/api/assignments/create", {
      method: "POST",
      headers: this.authHeaders(),
      body: JSON.stringify(body)
    })
      .then(function (r) {
        return r.json().then(function (j) { return { s: r.status, j: j }; });
      })
      .then(function (res) {
        var msg = document.getElementById("as-msg");
        if (res.s === 200 && res.j.ok) {
          msg.className = "msg ok";
          msg.textContent = "Задание отправлено";
          self.loadAssignments();
        } else {
          msg.className = "msg err";
          msg.textContent = (res.j && res.j.error) || "Ошибка";
        }
      });
  },

  loadAssignments: function () {
    fetch("/api/assignments", { headers: this.authHeaders() })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var tb = document.getElementById("as-tb");
        if (!tb) return;
        var items = (data && data.items) || [];
        tb.innerHTML =
          items
            .map(function (a) {
              return (
                "<tr><td>" +
                (a.created_at || "") +
                "</td><td>" +
                a.student_login +
                "</td><td>" +
                a.title +
                "</td><td>" +
                a.status +
                "</td></tr>"
              );
            })
            .join("") || "<tr><td colspan='4'>Пока нет заданий</td></tr>";
      });
  },

  loadEval: function () {
    var self = this;
    fetch("/api/evaluations?limit=100")
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var tb = document.getElementById("eval-tb");
        if (!tb) return;
        var items = (data && data.items) || [];
        tb.innerHTML =
          items
            .map(function (e) {
              return (
                "<tr><td>" +
                (e.created_at || "") +
                "</td><td>" +
                (e.user_name || e.user_login || "") +
                "</td><td>" +
                (e.score != null ? e.score + "%" : "—") +
                "</td><td>" +
                (e.time_sec || "") +
                "</td><td>" +
                (e.scene_type || "") +
                "</td><td>" +
                (e.teacher_grade != null ? e.teacher_grade : "—") +
                '</td><td><input type="number" min="0" max="100" style="width:70px;margin:0" data-id="' +
                e.id +
                '" class="grade-in" value="' +
                (e.teacher_grade != null ? e.teacher_grade : "") +
                '" /> <button type="button" class="btn ghost grade-btn" data-id="' +
                e.id +
                '">OK</button></td></tr>'
              );
            })
            .join("") || "<tr><td colspan='7'>Нет результатов</td></tr>";
        tb.querySelectorAll(".grade-btn").forEach(function (btn) {
          btn.onclick = function () {
            var id = btn.getAttribute("data-id");
            var inp = tb.querySelector('.grade-in[data-id="' + id + '"]');
            fetch("/api/evaluation/grade", {
              method: "POST",
              headers: self.authHeaders(),
              body: JSON.stringify({
                token: self.token,
                id: parseInt(id, 10),
                teacher_grade: parseInt(inp.value, 10),
                teacher_comment: ""
              })
            }).then(function () { self.loadEval(); });
          };
        });
      });
  },

  loadAis: function () {
    fetch("/api/ais/config")
      .then(function (r) { return r.json(); })
      .then(function (c) {
        if (!c || !document.getElementById("ais-url")) return;
        document.getElementById("ais-url").value = c.url || "";
        document.getElementById("ais-token").value = c.token || "";
        document.getElementById("ais-mode").value = c.mode || "sandbox";
        document.getElementById("ais-allow").value = c.allow_outbound ? "1" : "0";
      });
  },

  saveAis: function () {
    fetch("/api/ais/config", {
      method: "POST",
      headers: this.authHeaders(),
      body: JSON.stringify({
        url: document.getElementById("ais-url").value,
        token: document.getElementById("ais-token").value,
        mode: document.getElementById("ais-mode").value,
        allow_outbound: document.getElementById("ais-allow").value === "1",
        timeout_ms: 5000
      })
    }).then(function () {
      var m = document.getElementById("ais-msg");
      m.className = "msg ok";
      m.textContent = "Сохранено";
    });
  },

  pingAis: function () {
    fetch("/api/ais/ping", { method: "POST", headers: this.authHeaders() })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        var el = document.getElementById("ais-msg");
        el.className = "msg " + (res.ok ? "ok" : "err");
        el.textContent = res.message || "";
      });
  },

  saveCfg: function () {
    fetch("/api/config", {
      method: "POST",
      headers: this.authHeaders(),
      body: JSON.stringify({
        timer_default: parseInt(document.getElementById("cfg-timer").value, 10) || 30,
        call_min: parseInt(document.getElementById("cfg-min").value, 10) || 15,
        call_max: parseInt(document.getElementById("cfg-max").value, 10) || 35
      })
    }).then(function () {
      var m = document.getElementById("cfg-msg");
      m.className = "msg ok";
      m.textContent = "Сохранено";
    });
  }
};
