#!/usr/bin/env python3
import hashlib
import json
import os
import secrets
import sqlite3
import sys
import time
from datetime import datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

ROOT = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.environ.get("DDS_DB", os.path.join(ROOT, "dds112.db"))
PORT = int(os.environ.get("PORT", "8765"))
ONLINE_TTL = 45

ADMIN_LOGIN = "4dm1n15tr4t0r"
ADMIN_PASS = "cpSMCgKsB9AHJWSG7qhTENRq"


def now_iso():
    return datetime.now().isoformat(timespec="seconds")


def hash_password(password, salt=None):
    if not salt:
        salt = secrets.token_hex(16)
    digest = hashlib.sha256((salt + password).encode("utf-8")).hexdigest()
    return salt, digest


def verify_password(password, salt, digest):
    return hash_password(password, salt)[1] == digest


def db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    conn = db()
    tables = [
        """CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            login TEXT NOT NULL UNIQUE,
            full_name TEXT,
            role TEXT NOT NULL,
            password_salt TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL
        )""",
        """CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            login TEXT,
            role TEXT,
            token TEXT UNIQUE,
            started_at TEXT NOT NULL,
            ended_at TEXT,
            last_seen TEXT
        )""",
        """CREATE TABLE IF NOT EXISTS evaluations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER,
            user_login TEXT,
            user_name TEXT,
            role TEXT,
            score INTEGER,
            time_sec INTEGER,
            limit_sec INTEGER,
            scene_id TEXT,
            scene_type TEXT,
            card_id TEXT,
            services_json TEXT,
            tags_json TEXT,
            errors_json TEXT,
            description TEXT,
            address_json TEXT,
            teacher_grade INTEGER,
            teacher_comment TEXT,
            graded_by TEXT,
            created_at TEXT NOT NULL
        )""",
        """CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_login TEXT,
            to_name TEXT,
            to_phone TEXT,
            body TEXT,
            created_at TEXT NOT NULL
        )""",
        """CREATE TABLE IF NOT EXISTS app_config (
            key TEXT PRIMARY KEY,
            value TEXT
        )""",
        """CREATE TABLE IF NOT EXISTS cards (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            card_id TEXT,
            user_login TEXT,
            payload_json TEXT,
            created_at TEXT NOT NULL
        )""",
        """CREATE TABLE IF NOT EXISTS assignments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            teacher_login TEXT NOT NULL,
            student_login TEXT NOT NULL,
            title TEXT NOT NULL,
            body TEXT,
            scene_id TEXT,
            status TEXT NOT NULL DEFAULT 'sent',
            created_at TEXT NOT NULL,
            read_at TEXT
        )""",
        """CREATE TABLE IF NOT EXISTS presence (
            login TEXT PRIMARY KEY,
            role TEXT,
            full_name TEXT,
            last_seen REAL NOT NULL,
            token TEXT
        )""",
    ]
    for sql in tables:
        try:
            conn.execute(sql)
        except Exception as e:
            sys.stderr.write("table warn: %s\n" % e)
    conn.commit()
    row = conn.execute("SELECT id FROM users WHERE login=?", (ADMIN_LOGIN,)).fetchone()
    if not row:
        salt, digest = hash_password(ADMIN_PASS)
        conn.execute(
            "INSERT INTO users(login, full_name, role, password_salt, password_hash, active, created_at) VALUES(?,?,?,?,?,?,?)",
            (ADMIN_LOGIN, "Администратор системы", "admin", salt, digest, 1, now_iso()),
        )
        conn.commit()
    conn.close()


def user_public(row):
    if not row:
        return None
    return {
        "id": row["id"],
        "login": row["login"],
        "full_name": row["full_name"],
        "role": row["role"],
        "active": bool(row["active"]),
        "created_at": row["created_at"],
    }


def get_user_by_token(conn, token):
    if not token:
        return None
    row = conn.execute(
        """SELECT u.* FROM sessions s
           JOIN users u ON u.id = s.user_id
           WHERE s.token=? AND s.ended_at IS NULL AND u.active=1""",
        (token,),
    ).fetchone()
    return row


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def log_message(self, fmt, *args):
        sys.stderr.write("[%s] %s\n" % (self.log_date_time_string(), fmt % args))

    def _json(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self):
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0:
            return {}
        raw = self.rfile.read(length)
        try:
            return json.loads(raw.decode("utf-8"))
        except Exception:
            return {}

    def _token(self):
        auth = self.headers.get("Authorization") or ""
        if auth.lower().startswith("bearer "):
            return auth[7:].strip()
        data_token = None
        return data_token

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        qs = parse_qs(parsed.query)

        if path == "/api/health":
            return self._json(200, {"ok": True, "db": DB_PATH})

        if path == "/api/online":
            conn = db()
            cutoff = time.time() - ONLINE_TTL
            role = (qs.get("role") or [None])[0]
            if role:
                rows = conn.execute(
                    "SELECT login, role, full_name, last_seen FROM presence WHERE last_seen>=? AND role=?",
                    (cutoff, role),
                ).fetchall()
            else:
                rows = conn.execute(
                    "SELECT login, role, full_name, last_seen FROM presence WHERE last_seen>=?",
                    (cutoff,),
                ).fetchall()
            conn.close()
            items = []
            for r in rows:
                items.append(
                    {
                        "login": r["login"],
                        "role": r["role"],
                        "full_name": r["full_name"],
                        "online": True,
                        "last_seen": r["last_seen"],
                    }
                )
            return self._json(200, {"items": items})

        if path == "/api/users":
            conn = db()
            token = self._token()
            me = get_user_by_token(conn, token)
            if not me or me["role"] not in ("admin", "teacher"):
                conn.close()
                return self._json(403, {"error": "forbidden"})
            rows = conn.execute(
                "SELECT id, login, full_name, role, active, created_at FROM users ORDER BY id DESC"
            ).fetchall()
            conn.close()
            return self._json(200, {"items": [user_public(r) for r in rows]})

        if path == "/api/evaluations":
            limit = int((qs.get("limit") or ["100"])[0])
            conn = db()
            rows = conn.execute(
                "SELECT * FROM evaluations ORDER BY id DESC LIMIT ?", (limit,)
            ).fetchall()
            conn.close()
            return self._json(200, {"items": [dict(r) for r in rows]})

        if path == "/api/sessions":
            conn = db()
            rows = conn.execute(
                "SELECT id, login, role, started_at, last_seen FROM sessions ORDER BY id DESC LIMIT 100"
            ).fetchall()
            conn.close()
            return self._json(200, {"items": [dict(r) for r in rows]})

        if path == "/api/assignments":
            conn = db()
            token = self._token()
            me = get_user_by_token(conn, token)
            if not me:
                conn.close()
                return self._json(401, {"error": "unauthorized"})
            if me["role"] == "student":
                rows = conn.execute(
                    "SELECT * FROM assignments WHERE student_login=? ORDER BY id DESC",
                    (me["login"],),
                ).fetchall()
            else:
                rows = conn.execute(
                    "SELECT * FROM assignments ORDER BY id DESC LIMIT 200"
                ).fetchall()
            conn.close()
            return self._json(200, {"items": [dict(r) for r in rows]})

        if path == "/api/ais/config":
            conn = db()
            row = conn.execute("SELECT value FROM app_config WHERE key='ais'").fetchone()
            conn.close()
            cfg = {
                "url": "",
                "token": "",
                "mode": "sandbox",
                "timeout_ms": 5000,
                "allow_outbound": False,
            }
            if row:
                try:
                    cfg.update(json.loads(row[0]))
                except Exception:
                    pass
            return self._json(200, cfg)

        if path == "/api/config":
            conn = db()
            row = conn.execute(
                "SELECT value FROM app_config WHERE key='trainer'"
            ).fetchone()
            conn.close()
            cfg = {"timer_default": 30, "call_min": 15, "call_max": 35}
            if row:
                try:
                    cfg.update(json.loads(row[0]))
                except Exception:
                    pass
            return self._json(200, cfg)

        return super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path
        data = self._read_json()
        now = now_iso()

        if path == "/api/auth/register":
            login = (data.get("login") or "").strip()
            password = data.get("password") or ""
            full_name = (data.get("full_name") or login).strip()
            role = data.get("role") or "student"
            if role not in ("student", "teacher"):
                return self._json(400, {"error": "Роль только student или teacher"})
            if len(login) < 3:
                return self._json(400, {"error": "Логин слишком короткий"})
            if len(password) < 6:
                return self._json(400, {"error": "Пароль не менее 6 символов"})
            if login == ADMIN_LOGIN:
                return self._json(400, {"error": "Логин занят"})
            salt, digest = hash_password(password)
            conn = db()
            try:
                conn.execute(
                    "INSERT INTO users(login, full_name, role, password_salt, password_hash, active, created_at) VALUES(?,?,?,?,?,?,?)",
                    (login, full_name, role, salt, digest, 1, now),
                )
                conn.commit()
            except sqlite3.IntegrityError:
                conn.close()
                return self._json(409, {"error": "Логин уже существует"})
            conn.close()
            return self._json(200, {"ok": True, "login": login, "role": role})

        if path == "/api/auth/login":
            login = (data.get("login") or "").strip()
            password = data.get("password") or ""
            conn = db()
            row = conn.execute(
                "SELECT * FROM users WHERE login=? AND active=1", (login,)
            ).fetchone()
            if not row or not verify_password(password, row["password_salt"], row["password_hash"]):
                conn.close()
                return self._json(401, {"error": "Неверный логин или пароль"})
            token = secrets.token_hex(24)
            cur = conn.execute(
                "INSERT INTO sessions(user_id, login, role, token, started_at, last_seen) VALUES(?,?,?,?,?,?)",
                (row["id"], row["login"], row["role"], token, now, now),
            )
            session_id = cur.lastrowid
            conn.execute(
                "INSERT INTO presence(login, role, full_name, last_seen, token) VALUES(?,?,?,?,?) ON CONFLICT(login) DO UPDATE SET role=excluded.role, full_name=excluded.full_name, last_seen=excluded.last_seen, token=excluded.token",
                (row["login"], row["role"], row["full_name"], time.time(), token),
            )
            conn.commit()
            conn.close()
            return self._json(
                200,
                {
                    "ok": True,
                    "token": token,
                    "session_id": session_id,
                    "user": user_public(row),
                },
            )

        if path == "/api/auth/logout":
            token = data.get("token") or self._token()
            conn = db()
            row = conn.execute(
                "SELECT login FROM sessions WHERE token=?", (token,)
            ).fetchone()
            conn.execute(
                "UPDATE sessions SET ended_at=? WHERE token=?", (now, token)
            )
            if row:
                conn.execute("DELETE FROM presence WHERE login=?", (row["login"],))
            conn.commit()
            conn.close()
            return self._json(200, {"ok": True})

        if path == "/api/presence/heartbeat":
            token = data.get("token") or self._token()
            conn = db()
            me = get_user_by_token(conn, token)
            if not me:
                conn.close()
                return self._json(401, {"error": "unauthorized"})
            conn.execute(
                "INSERT INTO presence(login, role, full_name, last_seen, token) VALUES(?,?,?,?,?) ON CONFLICT(login) DO UPDATE SET last_seen=excluded.last_seen, role=excluded.role, full_name=excluded.full_name, token=excluded.token",
                (me["login"], me["role"], me["full_name"], time.time(), token),
            )
            conn.execute(
                "UPDATE sessions SET last_seen=? WHERE token=?", (now, token)
            )
            conn.commit()
            conn.close()
            return self._json(200, {"ok": True})

        if path == "/api/users/set-active":
            token = self._token() or data.get("token")
            conn = db()
            me = get_user_by_token(conn, token)
            if not me or me["role"] != "admin":
                conn.close()
                return self._json(403, {"error": "forbidden"})
            login = data.get("login")
            active = 1 if data.get("active") else 0
            if login == ADMIN_LOGIN and not active:
                conn.close()
                return self._json(400, {"error": "Нельзя отключить администратора"})
            conn.execute("UPDATE users SET active=? WHERE login=?", (active, login))
            conn.commit()
            conn.close()
            return self._json(200, {"ok": True})

        if path == "/api/users/set-role":
            token = self._token() or data.get("token")
            conn = db()
            me = get_user_by_token(conn, token)
            if not me or me["role"] != "admin":
                conn.close()
                return self._json(403, {"error": "forbidden"})
            login = data.get("login")
            role = data.get("role")
            if role not in ("student", "teacher", "admin"):
                conn.close()
                return self._json(400, {"error": "bad role"})
            if login == ADMIN_LOGIN:
                conn.close()
                return self._json(400, {"error": "Роль главного админа не меняется"})
            conn.execute("UPDATE users SET role=? WHERE login=?", (role, login))
            conn.commit()
            conn.close()
            return self._json(200, {"ok": True})

        if path == "/api/users/create":
            token = self._token() or data.get("token")
            conn = db()
            me = get_user_by_token(conn, token)
            if not me or me["role"] != "admin":
                conn.close()
                return self._json(403, {"error": "forbidden"})
            login = (data.get("login") or "").strip()
            password = data.get("password") or ""
            full_name = (data.get("full_name") or login).strip()
            role = data.get("role") or "student"
            if role not in ("student", "teacher", "admin"):
                conn.close()
                return self._json(400, {"error": "bad role"})
            if len(login) < 3 or len(password) < 6:
                conn.close()
                return self._json(400, {"error": "Логин/пароль слишком короткие"})
            salt, digest = hash_password(password)
            try:
                conn.execute(
                    "INSERT INTO users(login, full_name, role, password_salt, password_hash, active, created_at) VALUES(?,?,?,?,?,?,?)",
                    (login, full_name, role, salt, digest, 1, now),
                )
                conn.commit()
            except sqlite3.IntegrityError:
                conn.close()
                return self._json(409, {"error": "Логин занят"})
            conn.close()
            return self._json(200, {"ok": True})

        if path == "/api/assignments/create":
            token = self._token() or data.get("token")
            conn = db()
            me = get_user_by_token(conn, token)
            if not me or me["role"] not in ("teacher", "admin"):
                conn.close()
                return self._json(403, {"error": "forbidden"})
            student = (data.get("student_login") or "").strip()
            title = (data.get("title") or "").strip()
            body = data.get("body") or ""
            scene_id = data.get("scene_id") or ""
            if not student or not title:
                conn.close()
                return self._json(400, {"error": "Укажите ученика и тему"})
            st = conn.execute(
                "SELECT role FROM users WHERE login=? AND active=1", (student,)
            ).fetchone()
            if not st or st["role"] != "student":
                conn.close()
                return self._json(400, {"error": "Получатель должен быть учеником"})
            pr = conn.execute(
                "SELECT last_seen FROM presence WHERE login=?", (student,)
            ).fetchone()
            if not pr or pr["last_seen"] < time.time() - ONLINE_TTL:
                conn.close()
                return self._json(400, {"error": "Ученик не в сети"})
            cur = conn.execute(
                "INSERT INTO assignments(teacher_login, student_login, title, body, scene_id, status, created_at) VALUES(?,?,?,?,?,?,?)",
                (me["login"], student, title, body, scene_id, "sent", now),
            )
            aid = cur.lastrowid
            conn.commit()
            conn.close()
            return self._json(200, {"ok": True, "id": aid})

        if path == "/api/evaluation/grade":
            token = self._token() or data.get("token")
            conn = db()
            me = get_user_by_token(conn, token)
            if not me or me["role"] not in ("teacher", "admin"):
                conn.close()
                return self._json(403, {"error": "forbidden"})
            eid = data.get("id")
            grade = data.get("teacher_grade")
            comment = data.get("teacher_comment") or ""
            conn.execute(
                "UPDATE evaluations SET teacher_grade=?, teacher_comment=?, graded_by=? WHERE id=?",
                (grade, comment, me["login"], eid),
            )
            conn.commit()
            conn.close()
            return self._json(200, {"ok": True})

        if path == "/api/evaluation":
            conn = db()
            conn.execute(
                """INSERT INTO evaluations(
                    session_id, user_login, user_name, role, score, time_sec, limit_sec,
                    scene_id, scene_type, card_id, services_json, tags_json, errors_json,
                    description, address_json, created_at
                ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (
                    data.get("session_id"),
                    data.get("user_login") or data.get("userName"),
                    data.get("user_name") or data.get("userName"),
                    data.get("role"),
                    int(data.get("score") or 0),
                    int(data.get("time_sec") or data.get("time") or 0),
                    int(data.get("limit_sec") or data.get("limit") or 30),
                    data.get("scene_id"),
                    data.get("scene_type"),
                    data.get("card_id"),
                    json.dumps(data.get("services") or [], ensure_ascii=False),
                    json.dumps(data.get("tags") or {}, ensure_ascii=False),
                    json.dumps(data.get("errors") or [], ensure_ascii=False),
                    data.get("description") or "",
                    json.dumps(data.get("address") or {}, ensure_ascii=False),
                    now,
                ),
            )
            conn.commit()
            conn.close()
            return self._json(200, {"ok": True})

        if path == "/api/message":
            conn = db()
            conn.execute(
                "INSERT INTO messages(user_login, to_name, to_phone, body, created_at) VALUES(?,?,?,?,?)",
                (
                    data.get("user_login") or "",
                    data.get("to_name") or "",
                    data.get("to_phone") or "",
                    data.get("body") or "",
                    now,
                ),
            )
            conn.commit()
            conn.close()
            return self._json(200, {"ok": True})

        if path == "/api/card":
            conn = db()
            conn.execute(
                "INSERT INTO cards(card_id, user_login, payload_json, created_at) VALUES(?,?,?,?)",
                (
                    data.get("card_id") or "",
                    data.get("user_login") or "",
                    json.dumps(data.get("payload") or data, ensure_ascii=False),
                    now,
                ),
            )
            conn.commit()
            conn.close()
            return self._json(200, {"ok": True})

        if path == "/api/ais/config":
            conn = db()
            conn.execute(
                "INSERT INTO app_config(key, value) VALUES('ais', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                (json.dumps(data, ensure_ascii=False),),
            )
            conn.commit()
            conn.close()
            return self._json(200, {"ok": True})

        if path == "/api/ais/ping":
            conn = db()
            row = conn.execute("SELECT value FROM app_config WHERE key='ais'").fetchone()
            conn.close()
            cfg = {"mode": "sandbox", "allow_outbound": False, "url": ""}
            if row:
                try:
                    cfg.update(json.loads(row[0]))
                except Exception:
                    pass
            if not cfg.get("allow_outbound"):
                return self._json(
                    200,
                    {
                        "ok": True,
                        "message": "Исходящие в АИС запрещены (учебный режим).",
                    },
                )
            if not cfg.get("url"):
                return self._json(200, {"ok": False, "message": "URL АИС не задан"})
            return self._json(
                200,
                {
                    "ok": True,
                    "message": "Режим %s: запрос к АИС подготовлен (локальный контур)."
                    % cfg.get("mode"),
                },
            )

        if path == "/api/config":
            conn = db()
            conn.execute(
                "INSERT INTO app_config(key, value) VALUES('trainer', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                (json.dumps(data, ensure_ascii=False),),
            )
            conn.commit()
            conn.close()
            return self._json(200, {"ok": True})

        if path == "/api/session/start":
            return self._json(
                200, {"session_id": None, "note": "Используйте /api/auth/login"}
            )

        self._json(404, {"error": "not found"})


def main():
    init_db()
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print("DDS-112: http://0.0.0.0:%s (LAN)" % PORT)
    print("SQLite: %s" % DB_PATH)
    print("Admin: %s" % ADMIN_LOGIN)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nstop")
        server.server_close()


if __name__ == "__main__":
    main()
