import React, { useState, useEffect, useCallback } from "react";
import {
  Bell,
  CheckCircle2,
  Clock3,
  LogOut,
  Plus,
  Lock,
  User,
  Building2,
  ShieldCheck,
  Inbox,
  Send,
  AlertCircle,
} from "lucide-react";

// ---------- storage helpers ----------
const encode = (s) => {
  try {
    return btoa(unescape(encodeURIComponent(s)));
  } catch {
    return btoa(s);
  }
};

const genId = () => `sug_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

async function listAll(prefix) {
  try {
    const res = await window.storage.list(prefix, true);
    return res && res.keys ? res.keys : [];
  } catch {
    return [];
  }
}

async function getJSON(key) {
  try {
    const res = await window.storage.get(key, true);
    return res ? JSON.parse(res.value) : null;
  } catch {
    return null;
  }
}

async function setJSON(key, value) {
  try {
    await window.storage.set(key, JSON.stringify(value), true);
    return true;
  } catch {
    return false;
  }
}

const ADMIN_USERNAME = "admin";
const ADMIN_DEFAULT_PASSWORD = "Maoni@2024";

export default function MaoniApp() {
  const [booting, setBooting] = useState(true);
  const [screen, setScreen] = useState("auth"); // auth | client | admin
  const [authMode, setAuthMode] = useState("login"); // login | signup
  const [currentUser, setCurrentUser] = useState(null);

  const [formUsername, setFormUsername] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formCompany, setFormCompany] = useState("");
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);

  const [submissions, setSubmissions] = useState([]);
  const [subsLoading, setSubsLoading] = useState(false);

  const [newTitle, setNewTitle] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [sendBusy, setSendBusy] = useState(false);
  const [flash, setFlash] = useState("");

  const [adminFilter, setAdminFilter] = useState("all"); // all | pending | completed

  // Seed the admin account once.
  useEffect(() => {
    (async () => {
      const existing = await getJSON(`users:${ADMIN_USERNAME}`);
      if (!existing) {
        await setJSON(`users:${ADMIN_USERNAME}`, {
          username: ADMIN_USERNAME,
          password: encode(ADMIN_DEFAULT_PASSWORD),
          role: "admin",
          company: "Maoni Admin",
          createdAt: Date.now(),
        });
      }
      setBooting(false);
    })();
  }, []);

  const loadSubmissions = useCallback(async (user) => {
    setSubsLoading(true);
    const keys = await listAll("submissions:");
    const items = (await Promise.all(keys.map((k) => getJSON(k)))).filter(Boolean);
    items.sort((a, b) => b.createdAt - a.createdAt);
    const scoped =
      user && user.role === "admin"
        ? items
        : items.filter((s) => s.username === user.username);
    setSubmissions(scoped);
    setSubsLoading(false);
  }, []);

  useEffect(() => {
    if (currentUser) loadSubmissions(currentUser);
  }, [currentUser, loadSubmissions]);

  function resetAuthForm() {
    setFormUsername("");
    setFormPassword("");
    setFormCompany("");
    setAuthError("");
  }

  async function handleAuthSubmit(e) {
    e.preventDefault();
    setAuthError("");
    const uname = formUsername.trim().toLowerCase();
    const pass = formPassword;

    if (!uname || !pass) {
      setAuthError("Enter a username and password.");
      return;
    }

    setAuthBusy(true);
    try {
      if (authMode === "signup") {
        if (uname === ADMIN_USERNAME) {
          setAuthError("That username is reserved.");
          return;
        }
        if (pass.length < 4) {
          setAuthError("Password needs at least 4 characters.");
          return;
        }
        const existing = await getJSON(`users:${uname}`);
        if (existing) {
          setAuthError("That username is already taken.");
          return;
        }
        const user = {
          username: uname,
          password: encode(pass),
          role: "client",
          company: formCompany.trim() || uname,
          createdAt: Date.now(),
        };
        const ok = await setJSON(`users:${uname}`, user);
        if (!ok) {
          setAuthError("Couldn't create your account. Try again.");
          return;
        }
        setCurrentUser(user);
        setScreen("client");
        resetAuthForm();
      } else {
        const user = await getJSON(`users:${uname}`);
        if (!user || user.password !== encode(pass)) {
          setAuthError("Username or password is incorrect.");
          return;
        }
        setCurrentUser(user);
        setScreen(user.role === "admin" ? "admin" : "client");
        resetAuthForm();
      }
    } finally {
      setAuthBusy(false);
    }
  }

  function handleLogout() {
    setCurrentUser(null);
    setSubmissions([]);
    setScreen("auth");
    setAuthMode("login");
    resetAuthForm();
  }

  async function handleSendSuggestion(e) {
    e.preventDefault();
    if (!newTitle.trim() || !newMessage.trim()) return;
    setSendBusy(true);
    const item = {
      id: genId(),
      username: currentUser.username,
      company: currentUser.company,
      title: newTitle.trim(),
      message: newMessage.trim(),
      status: "pending",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const ok = await setJSON(`submissions:${item.id}`, item);
    setSendBusy(false);
    if (ok) {
      setNewTitle("");
      setNewMessage("");
      setFlash("Suggestion sent.");
      setTimeout(() => setFlash(""), 2500);
      loadSubmissions(currentUser);
    }
  }

  async function toggleStatus(item) {
    const updated = {
      ...item,
      status: item.status === "pending" ? "completed" : "pending",
      updatedAt: Date.now(),
    };
    const ok = await setJSON(`submissions:${item.id}`, updated);
    if (ok) loadSubmissions(currentUser);
  }

  const pendingCount = submissions.filter((s) => s.status === "pending").length;
  const visibleAdminItems =
    adminFilter === "all" ? submissions : submissions.filter((s) => s.status === adminFilter);

  function formatDate(ts) {
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  }

  return (
    <div className="maoni-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700&family=Inter:wght@400;500;600&display=swap');

        .maoni-root {
          --bg: #0A0D13;
          --panel: #12161F;
          --elevated: #171C27;
          --border: #262C3A;
          --text: #EDEFF3;
          --text-dim: #8A93A6;
          --accent: #E8A33D;
          --accent-strong: #F2B65B;
          --success: #3FAE6B;
          --success-bg: rgba(63,174,107,0.12);
          --pending-bg: rgba(232,163,61,0.12);
          --danger: #E0616B;
          font-family: 'Inter', sans-serif;
          background: var(--bg);
          color: var(--text);
          min-height: 100vh;
          width: 100%;
          box-sizing: border-box;
        }
        .maoni-root *, .maoni-root *::before, .maoni-root *::after { box-sizing: border-box; }
        .maoni-root h1, .maoni-root h2, .maoni-root h3 {
          font-family: 'Sora', sans-serif;
          margin: 0;
          letter-spacing: -0.01em;
        }
        .maoni-root button { font-family: 'Inter', sans-serif; cursor: pointer; }
        .maoni-root input, .maoni-root textarea {
          font-family: 'Inter', sans-serif;
        }
        .maoni-root a { color: var(--accent); }

        /* ---------- auth screen ---------- */
        .auth-wrap {
          min-height: 100vh;
          display: grid;
          grid-template-columns: 1.1fr 1fr;
        }
        @media (max-width: 860px) {
          .auth-wrap { grid-template-columns: 1fr; }
        }
        .auth-brand {
          background: linear-gradient(160deg, #0A0D13 0%, #131826 100%);
          padding: 56px 56px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          border-right: 1px solid var(--border);
        }
        @media (max-width: 860px) {
          .auth-brand { padding: 36px 28px; border-right: none; border-bottom: 1px solid var(--border); }
        }
        .wordmark {
          display: flex;
          align-items: center;
          gap: 10px;
          font-family: 'Sora', sans-serif;
          font-weight: 700;
          font-size: 20px;
          color: var(--text);
        }
        .wordmark-dot {
          width: 9px; height: 9px; border-radius: 50%;
          background: var(--accent);
        }
        .auth-hero h1 {
          font-size: 42px;
          line-height: 1.12;
          font-weight: 700;
          max-width: 480px;
          margin-top: 48px;
        }
        @media (max-width: 860px) {
          .auth-hero h1 { font-size: 30px; margin-top: 28px; }
        }
        .auth-hero p {
          color: var(--text-dim);
          font-size: 15px;
          line-height: 1.65;
          max-width: 420px;
          margin-top: 16px;
        }
        .mock-card {
          margin-top: 40px;
          background: var(--elevated);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 18px 20px;
          max-width: 420px;
        }
        .mock-card-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          padding: 10px 0;
        }
        .mock-card-row + .mock-card-row { border-top: 1px solid var(--border); }
        .mock-card-title { font-size: 14px; font-weight: 500; color: var(--text); }
        .mock-card-sub { font-size: 12.5px; color: var(--text-dim); margin-top: 3px; }
        .pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 12px;
          font-weight: 500;
          padding: 4px 9px;
          border-radius: 100px;
          white-space: nowrap;
        }
        .pill-pending { background: var(--pending-bg); color: var(--accent-strong); }
        .pill-completed { background: var(--success-bg); color: var(--success); }
        .footnote { color: var(--text-dim); font-size: 13px; }

        .auth-form-side {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 28px;
        }
        .auth-card {
          width: 100%;
          max-width: 380px;
        }
        .auth-tabs {
          display: flex;
          gap: 4px;
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 4px;
          margin-bottom: 28px;
        }
        .auth-tab {
          flex: 1;
          border: none;
          background: transparent;
          color: var(--text-dim);
          font-size: 14px;
          font-weight: 500;
          padding: 9px 0;
          border-radius: 7px;
          transition: background 0.15s, color 0.15s;
        }
        .auth-tab.active {
          background: var(--elevated);
          color: var(--text);
        }
        .field-label {
          font-size: 13px;
          color: var(--text-dim);
          margin-bottom: 6px;
          display: block;
        }
        .field-group { margin-bottom: 16px; }
        .field-input-wrap {
          position: relative;
          display: flex;
          align-items: center;
        }
        .field-input-wrap svg {
          position: absolute;
          left: 13px;
          color: var(--text-dim);
        }
        .field-input {
          width: 100%;
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 11px 13px 11px 38px;
          color: var(--text);
          font-size: 14.5px;
          outline: none;
          transition: border-color 0.15s;
        }
        .field-input:focus { border-color: var(--accent); }
        .btn-primary {
          width: 100%;
          background: var(--accent);
          color: #16130A;
          border: none;
          border-radius: 8px;
          padding: 12px 0;
          font-size: 14.5px;
          font-weight: 600;
          margin-top: 6px;
          transition: background 0.15s;
        }
        .btn-primary:hover { background: var(--accent-strong); }
        .btn-primary:disabled { opacity: 0.6; cursor: default; }
        .auth-err {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          background: rgba(224,97,107,0.1);
          border: 1px solid rgba(224,97,107,0.35);
          color: var(--danger);
          font-size: 13px;
          padding: 10px 12px;
          border-radius: 8px;
          margin-bottom: 16px;
        }
        .admin-hint {
          margin-top: 22px;
          font-size: 12.5px;
          color: var(--text-dim);
          display: flex;
          align-items: center;
          gap: 6px;
        }

        /* ---------- dashboards ---------- */
        .dash {
          min-height: 100vh;
        }
        .dash-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 32px;
          border-bottom: 1px solid var(--border);
        }
        @media (max-width: 640px) {
          .dash-header { padding: 16px 18px; }
        }
        .dash-header-right { display: flex; align-items: center; gap: 18px; }
        .who { font-size: 13.5px; color: var(--text-dim); }
        .who strong { color: var(--text); font-weight: 500; }
        .badge-wrap { position: relative; display: flex; align-items: center; }
        .badge-dot {
          position: absolute;
          top: -4px; right: -4px;
          background: var(--danger);
          color: white;
          font-size: 10px;
          font-weight: 600;
          min-width: 16px;
          height: 16px;
          border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          padding: 0 3px;
        }
        .icon-btn {
          background: var(--panel);
          border: 1px solid var(--border);
          color: var(--text-dim);
          border-radius: 8px;
          padding: 8px 10px;
          display: flex; align-items: center;
        }
        .logout-btn {
          display: flex; align-items: center; gap: 6px;
          background: transparent;
          border: 1px solid var(--border);
          color: var(--text-dim);
          border-radius: 8px;
          padding: 8px 13px;
          font-size: 13.5px;
          transition: border-color 0.15s, color 0.15s;
        }
        .logout-btn:hover { border-color: var(--text-dim); color: var(--text); }
        .admin-tag {
          font-size: 11px;
          font-weight: 600;
          color: var(--accent);
          background: var(--pending-bg);
          padding: 3px 8px;
          border-radius: 5px;
        }

        .dash-body {
          max-width: 1080px;
          margin: 0 auto;
          padding: 36px 32px 60px;
        }
        @media (max-width: 640px) {
          .dash-body { padding: 24px 18px 48px; }
        }

        .client-grid {
          display: grid;
          grid-template-columns: 360px 1fr;
          gap: 32px;
          align-items: start;
        }
        @media (max-width: 860px) {
          .client-grid { grid-template-columns: 1fr; }
        }
        .panel-box {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 22px;
        }
        .panel-box h2 { font-size: 17px; font-weight: 600; margin-bottom: 4px; }
        .panel-sub { color: var(--text-dim); font-size: 13.5px; margin-bottom: 20px; }
        textarea.field-input {
          padding: 11px 13px;
          resize: vertical;
          min-height: 96px;
          line-height: 1.5;
        }
        .flash-msg {
          background: var(--success-bg);
          color: var(--success);
          border: 1px solid rgba(63,174,107,0.35);
          font-size: 13px;
          padding: 9px 12px;
          border-radius: 8px;
          margin-top: 12px;
        }

        .list-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
        }
        .list-heading h2 { font-size: 17px; font-weight: 600; }
        .count-tag { font-size: 12.5px; color: var(--text-dim); }

        .sug-row {
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 16px 18px;
          margin-bottom: 12px;
          background: var(--panel);
        }
        .sug-row-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
        }
        .sug-title { font-size: 15px; font-weight: 500; }
        .sug-message {
          color: var(--text-dim);
          font-size: 13.5px;
          line-height: 1.55;
          margin-top: 6px;
        }
        .sug-meta {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 12px;
          font-size: 12.5px;
          color: var(--text-dim);
        }
        .sug-client { font-weight: 500; color: var(--text); }

        .empty-state {
          border: 1px dashed var(--border);
          border-radius: 10px;
          padding: 30px 20px;
          text-align: left;
          color: var(--text-dim);
          font-size: 14px;
        }

        .filter-row {
          display: flex;
          gap: 8px;
          margin-bottom: 20px;
        }
        .filter-chip {
          border: 1px solid var(--border);
          background: var(--panel);
          color: var(--text-dim);
          font-size: 13px;
          padding: 7px 14px;
          border-radius: 100px;
          transition: all 0.15s;
        }
        .filter-chip.active {
          background: var(--elevated);
          border-color: var(--accent);
          color: var(--text);
        }

        .status-btn {
          display: flex; align-items: center; gap: 6px;
          border: 1px solid var(--border);
          background: var(--elevated);
          color: var(--text-dim);
          font-size: 12.5px;
          font-weight: 500;
          padding: 7px 12px;
          border-radius: 8px;
          white-space: nowrap;
          transition: border-color 0.15s, color 0.15s;
        }
        .status-btn.is-completed { color: var(--success); border-color: rgba(63,174,107,0.4); }
        .status-btn.is-pending { color: var(--accent-strong); border-color: rgba(232,163,61,0.4); }
        .status-btn:hover { filter: brightness(1.15); }
      `}</style>

      {booting ? (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-dim)", fontSize: 14 }}>
          Loading…
        </div>
      ) : screen === "auth" ? (
        <div className="auth-wrap">
          <div className="auth-brand">
            <div className="wordmark">
              <span className="wordmark-dot" />
              Maoni
            </div>
            <div className="auth-hero">
              <h1>Every idea, tracked to done.</h1>
              <p>
                Send a suggestion about your page whenever it comes to mind. We see it the
                moment it lands, and you'll always know whether it's still pending or already
                shipped.
              </p>
              <div className="mock-card">
                <div className="mock-card-row">
                  <div>
                    <div className="mock-card-title">Move the pricing table higher</div>
                    <div className="mock-card-sub">Sent 3 days ago</div>
                  </div>
                  <span className="pill pill-completed"><CheckCircle2 size={13} /> Completed</span>
                </div>
                <div className="mock-card-row">
                  <div>
                    <div className="mock-card-title">Add a WhatsApp contact button</div>
                    <div className="mock-card-sub">Sent yesterday</div>
                  </div>
                  <span className="pill pill-pending"><Clock3 size={13} /> Pending</span>
                </div>
              </div>
            </div>
            <div className="footnote">Nairobi · built for teams who ship on client feedback</div>
          </div>

          <div className="auth-form-side">
            <div className="auth-card">
              <div className="auth-tabs">
                <button
                  className={`auth-tab ${authMode === "login" ? "active" : ""}`}
                  onClick={() => { setAuthMode("login"); setAuthError(""); }}
                >
                  Log in
                </button>
                <button
                  className={`auth-tab ${authMode === "signup" ? "active" : ""}`}
                  onClick={() => { setAuthMode("signup"); setAuthError(""); }}
                >
                  Sign up
                </button>
              </div>

              <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 6 }}>
                {authMode === "login" ? "Welcome back" : "Create your account"}
              </h2>
              <p className="panel-sub" style={{ marginBottom: 22 }}>
                {authMode === "login"
                  ? "Log in to send a suggestion or check on one you already sent."
                  : "Set up an account so we can keep track of what you send us."}
              </p>

              {authError && (
                <div className="auth-err">
                  <AlertCircle size={15} style={{ marginTop: 1, flexShrink: 0 }} />
                  <span>{authError}</span>
                </div>
              )}

              <form onSubmit={handleAuthSubmit}>
                {authMode === "signup" && (
                  <div className="field-group">
                    <label className="field-label">Company or page name</label>
                    <div className="field-input-wrap">
                      <Building2 size={16} />
                      <input
                        className="field-input"
                        placeholder="e.g. Baraka Traders"
                        value={formCompany}
                        onChange={(e) => setFormCompany(e.target.value)}
                      />
                    </div>
                  </div>
                )}
                <div className="field-group">
                  <label className="field-label">Username</label>
                  <div className="field-input-wrap">
                    <User size={16} />
                    <input
                      className="field-input"
                      placeholder="yourname"
                      value={formUsername}
                      onChange={(e) => setFormUsername(e.target.value)}
                      autoCapitalize="none"
                    />
                  </div>
                </div>
                <div className="field-group">
                  <label className="field-label">Password</label>
                  <div className="field-input-wrap">
                    <Lock size={16} />
                    <input
                      className="field-input"
                      type="password"
                      placeholder="••••••••"
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                    />
                  </div>
                </div>
                <button className="btn-primary" type="submit" disabled={authBusy}>
                  {authBusy ? "Please wait…" : authMode === "login" ? "Log in" : "Create account"}
                </button>
              </form>

              <div className="admin-hint">
                <ShieldCheck size={14} />
                Admins log in here too, with their admin username and password.
              </div>
            </div>
          </div>
        </div>
      ) : screen === "client" ? (
        <div className="dash">
          <div className="dash-header">
            <div className="wordmark">
              <span className="wordmark-dot" />
              Maoni
            </div>
            <div className="dash-header-right">
              <span className="who">Signed in as <strong>{currentUser.company}</strong></span>
              <button className="logout-btn" onClick={handleLogout}>
                <LogOut size={14} /> Log out
              </button>
            </div>
          </div>

          <div className="dash-body">
            <div className="client-grid">
              <div className="panel-box">
                <h2>Send a suggestion</h2>
                <p className="panel-sub">Tell us what you'd like changed or added on your page.</p>
                <form onSubmit={handleSendSuggestion}>
                  <div className="field-group">
                    <label className="field-label">Title</label>
                    <input
                      className="field-input"
                      style={{ paddingLeft: 13 }}
                      placeholder="e.g. Update the homepage banner"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                    />
                  </div>
                  <div className="field-group">
                    <label className="field-label">Details</label>
                    <textarea
                      className="field-input"
                      style={{ paddingLeft: 13 }}
                      placeholder="Describe what you'd like to see"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                    />
                  </div>
                  <button className="btn-primary" type="submit" disabled={sendBusy}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, justifyContent: "center", width: "100%" }}>
                      <Send size={14} /> {sendBusy ? "Sending…" : "Send suggestion"}
                    </span>
                  </button>
                </form>
                {flash && <div className="flash-msg">{flash}</div>}
              </div>

              <div>
                <div className="list-heading">
                  <h2>Your suggestions</h2>
                  <span className="count-tag">{submissions.length} sent</span>
                </div>
                {subsLoading ? (
                  <div className="footnote">Loading…</div>
                ) : submissions.length === 0 ? (
                  <div className="empty-state">
                    Nothing sent yet. Use the form to send your first suggestion — it'll show up
                    here with its status.
                  </div>
                ) : (
                  submissions.map((s) => (
                    <div className="sug-row" key={s.id}>
                      <div className="sug-row-top">
                        <div>
                          <div className="sug-title">{s.title}</div>
                          <div className="sug-message">{s.message}</div>
                        </div>
                        {s.status === "completed" ? (
                          <span className="pill pill-completed"><CheckCircle2 size={13} /> Completed</span>
                        ) : (
                          <span className="pill pill-pending"><Clock3 size={13} /> Pending</span>
                        )}
                      </div>
                      <div className="sug-meta">Sent {formatDate(s.createdAt)}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="dash">
          <div className="dash-header">
            <div className="wordmark">
              <span className="wordmark-dot" />
              Maoni
              <span className="admin-tag">ADMIN</span>
            </div>
            <div className="dash-header-right">
              <div className="badge-wrap">
                <div className="icon-btn"><Bell size={16} /></div>
                {pendingCount > 0 && <span className="badge-dot">{pendingCount}</span>}
              </div>
              <span className="who">Signed in as <strong>{currentUser.username}</strong></span>
              <button className="logout-btn" onClick={handleLogout}>
                <LogOut size={14} /> Log out
              </button>
            </div>
          </div>

          <div className="dash-body">
            <div className="list-heading">
              <h2>All client suggestions</h2>
              <span className="count-tag">{pendingCount} pending · {submissions.length} total</span>
            </div>

            <div className="filter-row">
              <button className={`filter-chip ${adminFilter === "all" ? "active" : ""}`} onClick={() => setAdminFilter("all")}>All</button>
              <button className={`filter-chip ${adminFilter === "pending" ? "active" : ""}`} onClick={() => setAdminFilter("pending")}>Pending</button>
              <button className={`filter-chip ${adminFilter === "completed" ? "active" : ""}`} onClick={() => setAdminFilter("completed")}>Completed</button>
            </div>

            {subsLoading ? (
              <div className="footnote">Loading…</div>
            ) : visibleAdminItems.length === 0 ? (
              <div className="empty-state">
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <Inbox size={16} />
                  <span style={{ color: "var(--text)" }}>Nothing here yet</span>
                </div>
                No suggestions match this filter right now.
              </div>
            ) : (
              visibleAdminItems.map((s) => (
                <div className="sug-row" key={s.id}>
                  <div className="sug-row-top">
                    <div>
                      <div className="sug-title">{s.title}</div>
                      <div className="sug-message">{s.message}</div>
                    </div>
                    <button
                      className={`status-btn ${s.status === "completed" ? "is-completed" : "is-pending"}`}
                      onClick={() => toggleStatus(s)}
                    >
                      {s.status === "completed" ? <CheckCircle2 size={14} /> : <Clock3 size={14} />}
                      {s.status === "completed" ? "Completed" : "Mark complete"}
                    </button>
                  </div>
                  <div className="sug-meta">
                    <span className="sug-client">{s.company || s.username}</span>
                    <span>· @{s.username}</span>
                    <span>· Sent {formatDate(s.createdAt)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
