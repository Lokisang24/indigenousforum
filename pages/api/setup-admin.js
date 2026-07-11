const prisma = require("../../lib/db");
const { hashPassword } = require("../../lib/auth");

// One-time setup endpoint: lets you create the first admin account by
// visiting a URL on your LIVE Vercel deployment, without needing a working
// local `npm install` / `npm run seed:admin`.
//
// Protected by SETUP_SECRET (set this in Vercel env vars to any random
// string). After you've created your admin, delete this file (or at least
// remove/rotate SETUP_SECRET) so it can't be used again.
//
// Usage: visit, in your browser or via curl:
//   https://your-app.vercel.app/api/setup-admin?secret=YOUR_SETUP_SECRET&name=Your+Name&email=you@example.com&password=yourpassword
export default async function handler(req, res) {
  const { secret, name, email, password } = req.query;

  if (!process.env.SETUP_SECRET || secret !== process.env.SETUP_SECRET) {
    return res.status(401).json({ error: "Invalid or missing setup secret." });
  }

  if (!name || !email || !password) {
    return res.status(400).json({ error: "Provide name, email, and password as query params." });
  }

  try {
    const passwordHash = await hashPassword(password);
    const admin = await prisma.admin.upsert({
      where: { email },
      update: { name, passwordHash },
      create: { name, email, passwordHash },
    });

    return res.status(200).json({
      message: `Admin ready: ${admin.email}. You can now log in at /admin/login. Please delete this endpoint or rotate SETUP_SECRET now.`,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Could not create admin. Have you created the database tables yet (setup.sql)?" });
  }
}
