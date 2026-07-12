const prisma = require("../../../../lib/db");
const { getAdminFromRequest } = require("../../../../lib/auth");

export default async function handler(req, res) {
  const admin = getAdminFromRequest(req);
  if (!admin) {
    return res.status(401).json({ error: "Not authenticated." });
  }

  const [pending, approved, rejected] = await Promise.all([
    prisma.application.count({ where: { status: "PENDING" } }),
    prisma.application.count({ where: { status: "APPROVED" } }),
    prisma.application.count({ where: { status: "REJECTED" } }),
  ]);

  return res.status(200).json({
    pending,
    approved,
    rejected,
    total: pending + approved + rejected,
  });
}
