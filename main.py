"""
Ellipi Messenger — Real-time messaging with Flask-SocketIO + SQLite
Run: gunicorn main:app -k gthread -w 1 --threads 8 --bind 0.0.0.0:$PORT
"""
import os
import sqlite3
import hashlib
import time
from functools import wraps
from flask import Flask, render_template, session, request, jsonify, g
from flask_socketio import SocketIO, emit, join_room, leave_room

# ── App setup ─────────────────────────────────────────────────────────────────
app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "ellipi-dev-key-2024")
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SESSION_COOKIE_HTTPONLY"] = True

PORT = int(os.environ.get("PORT", 8082))
DB_PATH = os.path.join(os.path.dirname(__file__), "ellipi.db")

# threading mode — works with gunicorn gthread; polling transport is reliable
socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode="threading",
    logger=False,
    engineio_logger=False,
    cookie=None,
)

# ── In-memory online tracker: sid → user dict ─────────────────────────────────
online: dict[str, dict] = {}

AVATAR_COLORS = [
    "#FF6B6B", "#4ECDC4", "#A29BFE", "#FD79A8",
    "#FDCB6E", "#6C5CE7", "#00B894", "#E17055",
    "#0984E3", "#00CEC9", "#D63031", "#74B9FF",
]

# ── Database ───────────────────────────────────────────────────────────────────
def get_db() -> sqlite3.Connection:
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH, check_same_thread=False)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA journal_mode=WAL")
    return g.db

@app.teardown_appcontext
def close_db(e=None):
    db = g.pop("db", None)
    if db:
        db.close()

def raw_conn() -> sqlite3.Connection:
    """Thread-safe connection outside request context."""
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn

def init_db():
    conn = raw_conn()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            username     TEXT    UNIQUE NOT NULL COLLATE NOCASE,
            password     TEXT    NOT NULL,
            avatar_color TEXT    NOT NULL DEFAULT '#007AFF',
            created_at   INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS rooms (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            name       TEXT NOT NULL,
            icon       TEXT NOT NULL DEFAULT '💬',
            description TEXT NOT NULL DEFAULT '',
            created_at INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS messages (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            room_id    INTEGER NOT NULL,
            user_id    INTEGER NOT NULL,
            content    TEXT    NOT NULL,
            created_at INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY (room_id) REFERENCES rooms(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
        CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(room_id, created_at);
    """)
    # Seed default rooms
    if conn.execute("SELECT COUNT(*) FROM rooms").fetchone()[0] == 0:
        now = int(time.time())
        conn.executemany(
            "INSERT INTO rooms (name, icon, description, created_at) VALUES (?,?,?,?)",
            [
                ("عام",       "🌐", "قناة النقاش العام",          now),
                ("تقنية",     "💻", "مناقشات البرمجة والتقنية",   now),
                ("أخبار",     "📰", "آخر الأخبار والمستجدات",     now),
                ("ترفيه",     "🎮", "ألعاب وترفيه وفن",           now),
            ]
        )
    conn.commit()
    conn.close()

# ── Helpers ───────────────────────────────────────────────────────────────────
def hash_pw(pw: str) -> str:
    return hashlib.sha256(pw.encode()).hexdigest()

def rel_time(ts: int) -> str:
    diff = int(time.time()) - ts
    if diff < 60:    return "الآن"
    if diff < 3600:  return f"{diff // 60} د"
    if diff < 86400: return f"{diff // 3600} س"
    return "أمس"

def login_required(f):
    @wraps(f)
    def inner(*a, **kw):
        if "user_id" not in session:
            return jsonify({"error": "غير مصرح"}), 401
        return f(*a, **kw)
    return inner

def online_list():
    seen, out = set(), []
    for info in online.values():
        uid = info["user_id"]
        if uid not in seen:
            seen.add(uid)
            out.append({"user_id": uid, "username": info["username"],
                        "avatar_color": info["avatar_color"]})
    return out

# ── Auth routes ────────────────────────────────────────────────────────────────
@app.route("/auth/register", methods=["POST"])
def register():
    data = request.get_json() or {}
    username = (data.get("username") or "").strip()
    password = (data.get("password") or "").strip()
    if not username or not password:
        return jsonify({"error": "اسم المستخدم وكلمة المرور مطلوبان"}), 400
    if len(username) < 3:
        return jsonify({"error": "اسم المستخدم يجب أن يكون 3 أحرف على الأقل"}), 400
    if len(password) < 4:
        return jsonify({"error": "كلمة المرور يجب أن تكون 4 أحرف على الأقل"}), 400
    db = get_db()
    color = AVATAR_COLORS[db.execute("SELECT COUNT(*) FROM users").fetchone()[0] % len(AVATAR_COLORS)]
    try:
        db.execute(
            "INSERT INTO users (username, password, avatar_color, created_at) VALUES (?,?,?,?)",
            (username, hash_pw(password), color, int(time.time()))
        )
        db.commit()
        user = db.execute("SELECT * FROM users WHERE username=?", (username,)).fetchone()
        session.permanent = True
        session["user_id"] = user["id"]
        session["username"] = user["username"]
        session["avatar_color"] = user["avatar_color"]
        return jsonify({"id": user["id"], "username": user["username"],
                        "avatar_color": user["avatar_color"]})
    except sqlite3.IntegrityError:
        return jsonify({"error": "اسم المستخدم محجوز، جرّب اسماً آخر"}), 409

@app.route("/auth/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    username = (data.get("username") or "").strip()
    password = (data.get("password") or "").strip()
    db = get_db()
    user = db.execute(
        "SELECT * FROM users WHERE username=? AND password=?",
        (username, hash_pw(password))
    ).fetchone()
    if not user:
        return jsonify({"error": "اسم المستخدم أو كلمة المرور غير صحيحة"}), 401
    session.permanent = True
    session["user_id"] = user["id"]
    session["username"] = user["username"]
    session["avatar_color"] = user["avatar_color"]
    return jsonify({"id": user["id"], "username": user["username"],
                    "avatar_color": user["avatar_color"]})

@app.route("/auth/logout", methods=["POST"])
def do_logout():
    session.clear()
    return jsonify({"ok": True})

@app.route("/auth/me")
def me():
    if "user_id" not in session:
        return jsonify({"error": "not logged in"}), 401
    return jsonify({"id": session["user_id"], "username": session["username"],
                    "avatar_color": session["avatar_color"]})

# ── Rooms & Messages API ───────────────────────────────────────────────────────
@app.route("/api/rooms")
@login_required
def api_rooms():
    db = get_db()
    rows = db.execute("SELECT * FROM rooms ORDER BY id").fetchall()
    return jsonify([dict(r) for r in rows])

@app.route("/api/rooms/<int:room_id>/messages")
@login_required
def api_messages(room_id: int):
    db = get_db()
    rows = db.execute("""
        SELECT m.id, m.content, m.created_at,
               u.id   AS user_id,
               u.username,
               u.avatar_color
        FROM messages m
        JOIN users u ON m.user_id = u.id
        WHERE m.room_id = ?
        ORDER BY m.created_at DESC LIMIT 80
    """, (room_id,)).fetchall()
    msgs = []
    for r in reversed(rows):
        d = dict(r)
        d["time_str"] = rel_time(d["created_at"])
        d["mine"] = d["user_id"] == session["user_id"]
        msgs.append(d)
    return jsonify(msgs)

# ── Socket.IO events ──────────────────────────────────────────────────────────
@socketio.on("connect")
def on_connect():
    if "user_id" not in session:
        return False  # reject unauthenticated
    online[request.sid] = {
        "user_id":      session["user_id"],
        "username":     session["username"],
        "avatar_color": session["avatar_color"],
        "room_id":      None,
    }
    emit("online_users", online_list(), broadcast=True)

@socketio.on("disconnect")
def on_disconnect():
    user = online.pop(request.sid, None)
    if user and user["room_id"]:
        emit("user_left", {
            "username": user["username"],
            "room_id":  user["room_id"],
        }, to=f"room_{user['room_id']}")
    emit("online_users", online_list(), broadcast=True)

@socketio.on("join_room")
def on_join_room(data):
    user = online.get(request.sid)
    if not user:
        return
    room_id = int(data.get("room_id", 0))
    # Leave previous room
    if user["room_id"]:
        leave_room(f"room_{user['room_id']}")
        emit("user_left", {"username": user["username"], "room_id": user["room_id"]},
             to=f"room_{user['room_id']}")
    # Join new room
    user["room_id"] = room_id
    join_room(f"room_{room_id}")
    emit("user_joined", {
        "username":     user["username"],
        "avatar_color": user["avatar_color"],
        "room_id":      room_id,
    }, to=f"room_{room_id}")

@socketio.on("send_message")
def on_send_message(data):
    user = online.get(request.sid)
    if not user or not user["room_id"]:
        return
    content = (data.get("content") or "").strip()
    if not content or len(content) > 2000:
        return
    room_id = user["room_id"]
    now = int(time.time())
    conn = raw_conn()
    cursor = conn.execute(
        "INSERT INTO messages (room_id, user_id, content, created_at) VALUES (?,?,?,?)",
        (room_id, user["user_id"], content, now)
    )
    msg_id = cursor.lastrowid
    conn.commit()
    conn.close()
    emit("new_message", {
        "id":           msg_id,
        "room_id":      room_id,
        "user_id":      user["user_id"],
        "username":     user["username"],
        "avatar_color": user["avatar_color"],
        "content":      content,
        "time_str":     "الآن",
    }, to=f"room_{room_id}")

@socketio.on("typing")
def on_typing(data):
    user = online.get(request.sid)
    if not user or not user["room_id"]:
        return
    emit("user_typing", {
        "username": user["username"],
        "typing":   bool(data.get("typing")),
        "room_id":  user["room_id"],
    }, to=f"room_{user['room_id']}", include_self=False)

# ── Main routes ────────────────────────────────────────────────────────────────
@app.route("/")
def index():
    return render_template("index.html")

@app.route("/health")
def health():
    return jsonify({"status": "ok"}), 200

@app.route("/favicon.ico")
def favicon():
    return "", 204

# ── Bootstrap ─────────────────────────────────────────────────────────────────
init_db()

if __name__ == "__main__":
    print(f"Ellipi running on http://0.0.0.0:{PORT}")
    socketio.run(app, host="0.0.0.0", port=PORT, debug=False)

