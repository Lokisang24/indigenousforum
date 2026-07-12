const prisma = require("../../../../lib/db");
const { getAdminFromRequest } = require("../../../../lib/auth");

export default async function handler(req, res) {
  const admin = getAdminFromRequest(req);
  if (!admin) {
    return res.status(401).json({ error: "Not authenticated." });
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const status = req.query.status; // PENDING | APPROVED | REJECTED | undefined (all)

  const applications = await prisma.application.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      firstName: true,
      surname: true,
      dateOfBirth: true,
      clan: true,
      address: true,
      gender: true,
      email: true,
      idNumber: true,
      verificationCode: true,
      status: true,
      certificateSerial: true,
      photoUrl: true,
      createdAt: true,
      reviewedAt: true,
    },
  });

  return res.status(200).json({ applications });
}
