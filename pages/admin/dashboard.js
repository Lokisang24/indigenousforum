import { useEffect, useState } from "react";
import { useRouter } from "next/router";

const TABS = ["PENDING", "APPROVED", "REJECTED"];

export default function AdminDashboard() {
  const router = useRouter();
  const [tab, setTab] = useState("PENDING");
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actioningId, setActioningId] = useState(null);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

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
  };

  const handleLogout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  };

  return (
    <div className="page" style={{ maxWidth: 1000 }}>
      <div className="brand-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", textAlign: "left" }}>
        <div>
          <h1 style={{ marginBottom: 0 }}>Admin Dashboard</h1>
          <p>Indigenous Forums</p>
        </div>
        <button className="secondary" onClick={handleLogout}>Log out</button>
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>
            {t.charAt(0) + t.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      <div className="card">
        {error && <div className="alert error">{error}</div>}
        {loading ? (
          <p>Loading...</p>
        ) : applications.length === 0 ? (
          <p>No {tab.toLowerCase()} applications.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Clan</th>
                <th>Email</th>
                <th>ID No</th>
                <th>Verification Code</th>
                {tab === "APPROVED" && <th>Certificate No</th>}
                <th>Submitted</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => (
                <tr key={app.id}>
                  <td>{app.firstName} {app.surname}</td>
                  <td>{app.clan}</td>
                  <td>{app.email}</td>
                  <td>{app.idNumber}</td>
                  <td>{app.verificationCode}</td>
                  {tab === "APPROVED" && <td>{app.certificateSerial}</td>}
                  <td>{new Date(app.createdAt).toLocaleDateString()}</td>
                  <td>
                    {app.status === "PENDING" && (
                      <>
                        <button
                          className="approve"
                          disabled={actioningId === app.id}
                          onClick={() => handleApprove(app.id)}
                        >
                          Approve
                        </button>
                        <button
                          className="reject"
                          disabled={actioningId === app.id}
                          onClick={() => handleReject(app.id)}
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {app.status === "APPROVED" && (
                      <a href={`/api/admin/applications/${app.id}/certificate`} target="_blank" rel="noreferrer">
                        Download Certificate
                      </a>
                    )}
                    {app.status === "REJECTED" && <span className="badge REJECTED">Rejected</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
