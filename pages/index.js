import { useState } from "react";

export default function Home() {
  const [form, setForm] = useState({
    firstName: "",
    surname: "",
    dateOfBirth: "",
    clan: "",
    address: "",
    gender: "",
    email: "",
  });
  const [photo, setPhoto] = useState(null);
  const [status, setStatus] = useState({ loading: false, message: "", error: "" });
  const [result, setResult] = useState(null);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ loading: true, message: "", error: "" });
    setResult(null);

    try {
      const body = new FormData();
      Object.entries(form).forEach(([key, value]) => body.append(key, value));
      if (photo) body.append("photo", photo);

      const res = await fetch("/api/register", { method: "POST", body });
      const data = await res.json();

      if (!res.ok) {
        setStatus({ loading: false, message: "", error: data.error || "Submission failed." });
        return;
      }

      setStatus({ loading: false, message: data.message, error: "" });
      setResult(data);
      setForm({
        firstName: "",
        surname: "",
        dateOfBirth: "",
        clan: "",
        address: "",
        gender: "",
        email: "",
      });
      setPhoto(null);
    } catch (err) {
      setStatus({ loading: false, message: "", error: "Network error. Please try again." });
    }
  };

  return (
    <div className="page">
      <div className="brand-header">
        <h1>Indigenous Forums</h1>
        <p>Membership Registration</p>
      </div>

      <div className="card">
        {status.error && <div className="alert error">{status.error}</div>}
        {status.message && (
          <div className="alert success">
            {status.message}
            {result && (
              <div style={{ marginTop: 8 }}>
                <div>
                  <b>ID No:</b> {result.idNumber}
                </div>
                <div>
                  <b>Verification Code:</b> {result.verificationCode}
                </div>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>First Name</label>
            <input type="text" name="firstName" value={form.firstName} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label>Surname</label>
            <input type="text" name="surname" value={form.surname} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label>Date of Birth</label>
            <input type="date" name="dateOfBirth" value={form.dateOfBirth} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label>Clan</label>
            <input type="text" name="clan" value={form.clan} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label>Address</label>
            <input type="text" name="address" value={form.address} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label>Gender</label>
            <select name="gender" value={form.gender} onChange={handleChange} required>
              <option value="">Select...</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div className="form-group">
            <label>Email Address</label>
            <input type="email" name="email" value={form.email} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label>Photo (optional)</label>
            <input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files[0])} />
          </div>

          <button className="primary" type="submit" disabled={status.loading}>
            {status.loading ? "Submitting..." : "Submit Application"}
          </button>
        </form>
      </div>
    </div>
  );
}
