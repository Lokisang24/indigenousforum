import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";

const TABS = ["PENDING", "APPROVED", "REJECTED"];
const PAGE_SIZE = 5;

const NAV_ITEMS = [
  { id: "dashboard", key: "DASHBOARD", label: "Dashboard", icon: "\u2302" },
  { id: "pending", key: "PENDING", label: "Pending", icon: "\u23F3" },
  { id: "approved", key: "APPROVED", label: "Approved", icon: "\u2713" },
  { id: "rejected", key: "REJECTED", label: "Rejected", icon: "\u2715" },
  { id: "certificates", key: "APPROVED", label: "Certificates", icon: "\u2637" },
];

// Still not built out as real pages — shown for layout parity only.
const COMING_SOON_ITEMS = ["Verification", "Administrators", "Settings"];

function initials(name) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function AdminDashboard() {
  const router = useRouter();
  const [tab, setTab] = useState("PENDING");
  const [applications, setApplications] = useState([]);
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actioningId, setActioningId] = useState(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [viewApplication, setViewApplication] = useState(null);
  const [admin, setAdmin] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const loadStats = async () => {
    const res = await fetch("/api/admin/applications/stats");
    if (res.status === 401) {
      router.push("/admin/login");
      return;
    }
    const data = await res.json();
    setStats(data);
  };

  const load = async (status) => {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/admin/applications?status=${status}`);
    if (res.status === 401) {
      router.push("/admin/login");
      return;
    }
    const data = await res.json();
    setApplications(data.applications || []);
    setLoading(false);
  };

  useEffect(() => {
    load(tab);
    loadStats();
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const filtered = useMemo(() => {
    if (!search.trim()) return applications;
    const q = search.toLowerCase();
    return applications.filter((app) =>
      `${app.firstName} ${app.surname} ${app.clan} ${app.email} ${app.idNumber}`
        .toLowerCase()
        .includes(q)
    );
  }, [applications, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleApprove = async (id) => {
    setActioningId(id);
    const res = await fetch(`/api/admin/applications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve" }),
    });
    const data = await res.json();
    setActioningId(null);
    if (!res.ok) {
      setError(data.error || "Could not approve application.");
      return;
    }
    load(tab);
    loadStats();
  };

  const handleReject = async (id) => {
    const reason = window.prompt("Optional rejection reason:");
    setActioningId(id);
    const res = await fetch(`/api/admin/applications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject", rejectionReason: reason }),
    });
    const data = await res.json();
    setActioningId(null);
    if (!res.ok) {
      setError(data.error || "Could not reject application.");
      return;
    }
    load(tab);
    loadStats();
  };

  const handleLogout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  };

  const openDeleteConfirm = (app) => {
    setDeleteTarget(app);
    setDeletePassword("");
    setDeleteError("");
  };

  const confirmDelete = async () => {
    if (!deletePassword) {
      setDeleteError("Enter your admin password to confirm.");
      return;
    }
    setDeleting(true);
    setDeleteError("");
    const res = await fetch(`/api/admin/applications/${deleteTarget.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: deletePassword }),
    });
    const data = await res.json();
    setDeleting(false);

    if (!res.ok) {
      setDeleteError(data.error || "Could not delete application.");
      return;
    }

    setDeleteTarget(null);
    load(tab);
    loadStats();
  };

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="dash-shell">
      {/* Sidebar */}
      <aside className="dash-sidebar">
        <div className="dash-sidebar-brand">
          <img src="/logo.jpg" alt="Indigenous Forum logo" />
          <div className="name">
            INDIGENOUS <span>FORUM</span>
          </div>
          <div className="tagline">Unity &bull; Identity &bull; Rights</div>
        </div>

        <nav className="dash-nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              className={tab === item.key && item.key !== "DASHBOARD" ? "active" : ""}
              onClick={() => (item.key === "DASHBOARD" ? setTab("PENDING") : setTab(item.key))}
            >
              <span className="icon">{item.icon}</span>
              {item.label}
            </button>
          ))}

          <div className="nav-divider" />

          {COMING_SOON_ITEMS.map((label) => (
            <button
              key={label}
              onClick={() => window.alert(`${label} isn't built yet — coming in a future update.`)}
              style={{ opacity: 0.55 }}
            >
              <span className="icon">&bull;</span>
              {label}
            </button>
          ))}

          <div className="nav-divider" />

          <button onClick={handleLogout}>
            <span className="icon">&#8594;</span>
            Logout
          </button>
        </nav>

        <div className="dash-sidebar-footer">
          <div className="org">Indigenous Forum</div>
          Indigenous Identity Management System
        </div>
      </aside>

      {/* Main content */}
      <div className="dash-main">
        <div className="dash-topbar">
          <div>
            <h1>Admin Dashboard</h1>
            <p>Manage Indigenous Identity Applications</p>
          </div>

          <div className="dash-search">
            <span className="icon">&#128269;</span>
            <input
              placeholder="Search applications..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div className="dash-topbar-right">
            <div className="dash-user">
              <div className="avatar">{initials("Admin User")}</div>
              <div className="info">
                <div className="name">Admin User</div>
                <div className="role">Super Administrator</div>
              </div>
            </div>
          </div>
        </div>

        <div className="dash-body">
          <div className="dash-welcome">
            <div>
              <h2>Welcome, Admin</h2>
              <p>Here&apos;s what&apos;s happening with Indigenous Identity applications.</p>
            </div>
            <div className="dash-date">&#128197; {today}</div>
          </div>

          {error && <div className="alert error">{error}</div>}

          {/* Stat cards */}
          <div className="stat-grid">
            <div className="stat-card pending">
              <div className="label">
                <span className="icon-badge">&#9203;</span>PENDING
              </div>
              <div className="value">{stats.pending}</div>
              <div className="sub">Applications awaiting review</div>
            </div>
            <div className="stat-card approved">
              <div className="label">
                <span className="icon-badge">&#10003;</span>APPROVED
              </div>
              <div className="value">{stats.approved}</div>
              <div className="sub">Total approved applications</div>
            </div>
            <div className="stat-card rejected">
              <div className="label">
                <span className="icon-badge">&#10007;</span>REJECTED
              </div>
              <div className="value">{stats.rejected}</div>
              <div className="sub">Total rejected applications</div>
            </div>
            <div className="stat-card total">
              <div className="label">
                <span className="icon-badge">&#128101;</span>TOTAL USERS
              </div>
              <div className="value">{stats.total}</div>
              <div className="sub">All registered users</div>
            </div>
          </div>

          {/* Tabs */}
          <div className="dash-tabs">
            <div className="pill-tabs">
              {TABS.map((t) => (
                <button
                  key={t}
                  className={tab === t ? `active ${t}` : ""}
                  onClick={() => setTab(t)}
                >
                  {t === "PENDING" && "\u23F3"} {t === "APPROVED" && "\u2713"} {t === "REJECTED" && "\u2715"}{" "}
                  {t.charAt(0) + t.slice(1).toLowerCase()} ({t === tab ? filtered.length : ""})
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="dash-table-card">
            {loading ? (
              <div style={{ padding: 30, textAlign: "center", color: "var(--muted)" }}>Loading...</div>
            ) : pageItems.length === 0 ? (
              <div style={{ padding: 30, textAlign: "center", color: "var(--muted)" }}>
                No {tab.toLowerCase()} applications{search ? " match your search" : ""}.
              </div>
            ) : (
              <>
                <table>
                  <thead>
                    <tr>
                      <th>Photo</th>
                      <th>Name</th>
                      <th>Clan</th>
                      <th>Email</th>
                      <th>ID Number</th>
                      <th>Verification Code</th>
                      {tab === "APPROVED" && <th>Certificate No</th>}
                      <th>Submitted</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.map((app) => (
                      <tr key={app.id}>
                        <td>
                          {app.photoUrl ? (
                            <img src={app.photoUrl} alt="" className="avatar-thumb" />
                          ) : (
                            <div className="avatar-thumb placeholder">{initials(`${app.firstName} ${app.surname}`)}</div>
                          )}
                        </td>
                        <td style={{ fontWeight: 600 }}>{app.firstName} {app.surname}</td>
                        <td>{app.clan}</td>
                        <td>{app.email}</td>
                        <td>{app.idNumber}</td>
                        <td style={{ fontFamily: "monospace", fontSize: 12 }}>{app.verificationCode}</td>
                        {tab === "APPROVED" && <td>{app.certificateSerial}</td>}
                        <td>{new Date(app.createdAt).toLocaleDateString()}</td>
                        <td>
                          <span className={`badge ${app.status}`}>{app.status}</span>
                        </td>
                        <td>
                          <div className="row-actions">
                            {app.status === "PENDING" && (
                              <>
                                <button
                                  className="approve"
                                  disabled={actioningId === app.id}
                                  onClick={() => handleApprove(app.id)}
                                >
                                  &#10003; Approve
                                </button>
                                <button
                                  className="reject"
                                  disabled={actioningId === app.id}
                                  onClick={() => handleReject(app.id)}
                                >
                                  &#10007; Reject
                                </button>
                              </>
                            )}
                            {app.status === "APPROVED" && (
                              <a
                                href={`/api/admin/applications/${app.id}/certificate`}
                                target="_blank"
                                rel="noreferrer"
                                className="secondary"
                                style={{ padding: "7px 12px", borderRadius: 6, fontSize: 12, textDecoration: "none", border: "1px solid var(--border)", color: "var(--blue-dark)" }}
                              >
                                Download Certificate
                              </a>
                            )}
                            <button className="view" onClick={() => setViewApplication(app)} title="View details">
                              &#128065;
                            </button>
                            <button
                              className="view"
                              style={{ color: "var(--error-text)" }}
                              onClick={() => openDeleteConfirm(app)}
                              title="Delete application"
                            >
                              &#128465;
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="table-footer">
                  <span>
                    Showing {(page - 1) * PAGE_SIZE + 1} to {Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} entries
                  </span>
                  <div className="pagination">
                    <button disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                      &#8249;
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .slice(0, 5)
                      .map((p) => (
                        <button key={p} className={p === page ? "active" : ""} onClick={() => setPage(p)}>
                          {p}
                        </button>
                      ))}
                    <button disabled={page === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                      &#8250;
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="dash-footer">
          &copy; {new Date().getFullYear()} Indigenous Forum &nbsp;&bull;&nbsp; Indigenous Identity Management System &nbsp;&bull;&nbsp; Version 1.0.0
        </div>
      </div>

      {/* Details modal */}
      {viewApplication && (
        <div className="modal-backdrop" onClick={() => setViewApplication(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3>{viewApplication.firstName} {viewApplication.surname}</h3>
            <div className="modal-row"><span>Clan</span><span>{viewApplication.clan}</span></div>
            <div className="modal-row"><span>Date of Birth</span><span>{new Date(viewApplication.dateOfBirth).toLocaleDateString()}</span></div>
            <div className="modal-row"><span>Address</span><span>{viewApplication.address}</span></div>
            <div className="modal-row"><span>Gender</span><span>{viewApplication.gender}</span></div>
            <div className="modal-row"><span>Email</span><span>{viewApplication.email}</span></div>
            <div className="modal-row"><span>ID Number</span><span>{viewApplication.idNumber}</span></div>
            <div className="modal-row"><span>Verification Code</span><span>{viewApplication.verificationCode}</span></div>
            <div className="modal-row"><span>Status</span><span><span className={`badge ${viewApplication.status}`}>{viewApplication.status}</span></span></div>
            {viewApplication.certificateSerial && (
              <div className="modal-row"><span>Certificate No</span><span>{viewApplication.certificateSerial}</span></div>
            )}
            <div className="modal-row"><span>Submitted</span><span>{new Date(viewApplication.createdAt).toLocaleString()}</span></div>
            <button className="primary modal-close" onClick={() => setViewApplication(null)}>Close</button>
          </div>
        </div>
      )}
      {/* Delete confirmation modal — requires the logged-in admin's password */}
      {deleteTarget && (
        <div className="modal-backdrop" onClick={() => !deleting && setDeleteTarget(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3>Delete application?</h3>
            <p style={{ fontSize: 13, color: "var(--muted)", marginTop: -8 }}>
              This permanently deletes <b>{deleteTarget.firstName} {deleteTarget.surname}</b>&apos;s
              application ({deleteTarget.idNumber}). This cannot be undone. Enter your admin password to confirm.
            </p>

            {deleteError && <div className="alert error">{deleteError}</div>}

            <div className="form-group">
              <label>Your Admin Password</label>
              <input
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && confirmDelete()}
                autoFocus
              />
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button className="secondary" style={{ flex: 1 }} onClick={() => setDeleteTarget(null)} disabled={deleting}>
                Cancel
              </button>
              <button
                className="reject"
                style={{ flex: 1, justifyContent: "center", padding: "11px 0" }}
                onClick={confirmDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete Permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
