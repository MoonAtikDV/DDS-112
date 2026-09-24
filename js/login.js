window.Login = {
  init: function () {
    var btn = document.getElementById("login-btn");
    if (!btn) return;
    btn.addEventListener("click", function () {
      Login.doLogin();
    });
    ["user-login", "user-pass"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) {
        el.addEventListener("keydown", function (e) {
          if (e.key === "Enter") Login.doLogin();
        });
      }
    });
  },

  doLogin: function () {
    var loginEl = document.getElementById("user-login");
    var passEl = document.getElementById("user-pass");
    var err = document.getElementById("login-error");
    var btn = document.getElementById("login-btn");
    var login = (loginEl && loginEl.value ? loginEl.value : "").trim();
    var password = passEl ? passEl.value : "";
    if (err) {
      err.style.display = "none";
      err.textContent = "";
    }
    if (!login || !password) {
      if (err) {
        err.style.display = "block";
        err.textContent = "Введите логин и пароль";
      }
      return;
    }
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Вход…";
    }
    fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login: login, password: password })
    })
      .then(function (r) {
        return r.json().then(function (j) {
          return { status: r.status, body: j };
        });
      })
      .then(function (res) {
        if (btn) {
          btn.disabled = false;
          btn.textContent = "Войти";
        }
        if (res.status !== 200 || !res.body || !res.body.ok) {
          if (err) {
            err.style.display = "block";
            err.textContent =
              (res.body && res.body.error) || "Неверный логин или пароль";
          }
          return;
        }
        var user = res.body.user;
        var token = res.body.token;
        try {
          sessionStorage.setItem("dds_token", token);
          sessionStorage.setItem("dds_user", JSON.stringify(user));
          sessionStorage.setItem(
            "dds_session_id",
            String(res.body.session_id || "")
          );
        } catch (e) {}
        if (window.DB) {
          DB.token = token;
          DB.sessionId = res.body.session_id;
        }
        if (user.role === "admin") {
          location.replace("admin.html");
          return;
        }
        if (user.role === "teacher") {
          location.replace("teacher.html");
          return;
        }
        Login.enterTrainer(user, token);
      })
      .catch(function () {
        if (btn) {
          btn.disabled = false;
          btn.textContent = "Войти";
        }
        if (err) {
          err.style.display = "block";
          err.textContent =
            "Сервер недоступен. Запустите: python3 server.py";
        }
      });
  },

  enterTrainer: function (user, token) {
    AppState.role = user.role;
    AppState.userName = user.full_name || user.login;
    AppState.userLogin = user.login;
    AppState.token = token;
    var loginScreen = document.getElementById("login-screen");
    var app = document.getElementById("app");
    if (loginScreen) {
      loginScreen.classList.add("hidden");
      loginScreen.style.display = "none";
    }
    if (app) {
      app.classList.add("visible");
      app.style.display = "flex";
    }
    var ud = document.getElementById("user-display");
    if (ud) {
      ud.textContent = AppState.userName + " (" + roleLabel(user.role) + ")";
    }
    try { Search.initDemo(); } catch (e) {}
    try { DDS.initDemo(); } catch (e) {}
    try { Modes.show("card"); } catch (e) {}
    try { Calls.schedule(); } catch (e) {}
    Login.startHeartbeat(token);
    toast("Вход выполнен");
  },

  startHeartbeat: function (token) {
    function beat() {
      fetch("/api/presence/heartbeat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token
        },
        body: JSON.stringify({ token: token })
      }).catch(function () {});
    }
    beat();
    setInterval(beat, 15000);
  }
};
