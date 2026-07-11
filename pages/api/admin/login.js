const prisma = require("../../../lib/db");
const { verifyPassword, signAdminToken, buildAuthCookie } = require("../../../lib/auth");

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  const admin = await prisma.admin.findUnique({ where: { email } });
  if (!admin) {
    return res.status(401).json({ error: "Invalid credentials." });
  }

  const valid = await verifyPassword(password, admin.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid credentials." });
  }

  const token = signAdminToken(admin);
  res.setHeader("Set-Cookie", buildAuthCookie(token));
  return res.status(200).json({
    message: "Logged in",
    admin: { name: admin.name, email: admin.email, role: admin.role },
  });
}
