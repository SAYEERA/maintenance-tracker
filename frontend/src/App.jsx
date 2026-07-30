import React, { useEffect, useState, useCallback } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

const CATEGORIES = ["Plumbing", "Electrical", "HVAC", "Other"];
const STATUSES = ["Open", "In Progress", "Completed"];

function StatusPill({ status }) {
  return <span className={`pill pill-${status.replace(/\s/g, "").toLowerCase()}`}>{status}</span>;
}

function TenantForm({ onCreated }) {
  const [form, setForm] = useState({
    property: "",
    unit: "",
    category: "Plumbing",
    description: "",
  });
  const [suggesting, setSuggesting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [error, setError] = useState(null);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSuggest = async () => {
    if (!form.description.trim()) return;
    setSuggesting(true);
    try {
      const res = await fetch(`${API_BASE}/requests/suggest-category`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: form.description }),
      });
      const data = await res.json();
      setForm((f) => ({ ...f, category: data.suggested_category }));
    } catch (e) {
      setError("Couldn't reach the suggestion service.");
    } finally {
      setSuggesting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Request failed");
      const created = await res.json();
      setConfirmation(created);
      setForm({ property: "", unit: "", category: "Plumbing", description: "" });
      onCreated();
    } catch (e) {
      setError("Something went wrong submitting the request. Is the backend running?");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="panel">
      <h2 className="panel-title">Submit a work order</h2>
      <p className="panel-sub">Tell us what needs attention and where to find it.</p>

      <form onSubmit={handleSubmit} className="form-grid">
        <label className="field">
          <span>Property</span>
          <input
            required
            placeholder="e.g. Birchwood Commons"
            value={form.property}
            onChange={update("property")}
          />
        </label>

        <label className="field">
          <span>Unit #</span>
          <input required placeholder="e.g. 4B" value={form.unit} onChange={update("unit")} />
        </label>

        <label className="field field-wide">
          <span>What's going on?</span>
          <textarea
            required
            rows={3}
            placeholder="e.g. Kitchen sink is leaking under the cabinet."
            value={form.description}
            onChange={update("description")}
          />
        </label>

        <label className="field">
          <span>Category</span>
          <div className="category-row">
            <select value={form.category} onChange={update("category")}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn-ghost"
              onClick={handleSuggest}
              disabled={suggesting || !form.description.trim()}
            >
              {suggesting ? "Thinking…" : "Suggest"}
            </button>
          </div>
        </label>

        <div className="field field-wide submit-row">
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? "Submitting…" : "Submit request"}
          </button>
        </div>
      </form>

      {error && <p className="error-text">{error}</p>}
      {confirmation && (
        <div className="confirmation">
          Work order <strong>#{confirmation.id}</strong> logged for {confirmation.property}, unit{" "}
          {confirmation.unit}.
        </div>
      )}
    </div>
  );
}

function AdminDashboard({ requests, summary, onStatusChange, onDelete, loading }) {
  const [filter, setFilter] = useState("All");

  const visible =
    filter === "All" ? requests : requests.filter((r) => r.status === filter);

  return (
    <div className="panel">
      <div className="admin-header">
        <div>
          <h2 className="panel-title">Work order dashboard</h2>
          <p className="panel-sub">Everything logged across every property.</p>
        </div>
        <div className="summary-strip">
          {STATUSES.map((s) => (
            <div key={s} className="summary-chip">
              <span className="summary-count">{summary[s] ?? 0}</span>
              <span className="summary-label">{s}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="filter-row">
        {["All", ...STATUSES].map((s) => (
          <button
            key={s}
            className={`filter-tab ${filter === s ? "filter-tab-active" : ""}`}
            onClick={() => setFilter(s)}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="panel-sub">Loading…</p>
      ) : visible.length === 0 ? (
        <p className="panel-sub">No work orders here yet.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Property</th>
                <th>Unit</th>
                <th>Category</th>
                <th>Description</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>{r.property}</td>
                  <td>{r.unit}</td>
                  <td>{r.category}</td>
                  <td className="desc-cell">{r.description}</td>
                  <td>
                    <select
                      value={r.status}
                      onChange={(e) => onStatusChange(r.id, e.target.value)}
                      className="status-select"
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <button className="btn-link" onClick={() => onDelete(r.id)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState("tenant");
  const [requests, setRequests] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [reqRes, sumRes] = await Promise.all([
        fetch(`${API_BASE}/requests`),
        fetch(`${API_BASE}/requests/summary`),
      ]);
      setRequests(await reqRes.json());
      setSummary(await sumRes.json());
    } catch (e) {
      // backend likely not running yet
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleStatusChange = async (id, status) => {
    await fetch(`${API_BASE}/requests/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    refresh();
  };

  const handleDelete = async (id) => {
    await fetch(`${API_BASE}/requests/${id}`, { method: "DELETE" });
    refresh();
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark">WO</span>
          <div>
            <h1>Work Order Tracker</h1>
            <p>Residential maintenance, logged and routed.</p>
          </div>
        </div>
        <nav className="tabs">
          <button
            className={`tab ${tab === "tenant" ? "tab-active" : ""}`}
            onClick={() => setTab("tenant")}
          >
            Submit a request
          </button>
          <button
            className={`tab ${tab === "admin" ? "tab-active" : ""}`}
            onClick={() => setTab("admin")}
          >
            Admin dashboard
          </button>
        </nav>
      </header>

      <main className="app-main">
        {tab === "tenant" ? (
          <TenantForm onCreated={refresh} />
        ) : (
          <AdminDashboard
            requests={requests}
            summary={summary}
            onStatusChange={handleStatusChange}
            onDelete={handleDelete}
            loading={loading}
          />
        )}
      </main>
    </div>
  );
}
