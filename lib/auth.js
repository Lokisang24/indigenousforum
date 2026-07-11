const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-env";
const COOKIE_NAME = "if_admin_token";

function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

function signAdminToken(admin) {
  return jwt.sign(
    { id: admin.id, email: admin.email, role: admin.role, name: admin.name },
    JWT_SECRET,
    { expiresIn: "12h" }
  );
}

function verifyAdminToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

// Reads the admin JWT from the request cookies. Returns the decoded payload or null.
function getAdminFromRequest(req) {
  const cookieHeader = req.headers.cookie || "";
  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE_NAME}=`));

  if (!match) return null;
  const token = match.split("=")[1];
  return verifyAdminToken(token);
}

function buildAuthCookie(token) {
  const maxAge = 12 * 60 * 60; // 12 hours in seconds
  const secure = process.env.NODE_ENV === "production" ? "Secure; " : "";
  return `${COOKIE_NAME}=${token}; HttpOnly; ${secure}Path=/; Max-Age=${maxAge}; SameSite=Lax`;
}

function buildLogoutCookie() {
  return `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`;
}

module.exports = {
  COOKIE_NAME,
  hashPassword,
  verifyPassword,
  signAdminToken,
  verifyAdminToken,
  getAdminFromRequest,
  buildAuthCookie,
  buildLogoutCookie,
};
