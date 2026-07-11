const prisma = require("../../../../lib/db");
const { getAdminFromRequest } = require("../../../../lib/auth");
const { issueNextCertificateNumber } = require("../../../../lib/idGenerator");
const { sendApprovalEmail, sendRejectionEmail } = require("../../../../lib/mailer");

export default async function handler(req, res) {
  const admin = getAdminFromRequest(req);
  if (!admin) {
    return res.status(401).json({ error: "Not authenticated." });
  }

  const { id } = req.query;

  if (req.method === "GET") {
    const application = await prisma.application.findUnique({ where: { id } });
    if (!application) return res.status(404).json({ error: "Not found" });
    return res.status(200).json({ application });
  }

  if (req.method === "PATCH") {
    const { action, rejectionReason } = req.body || {};

    const application = await prisma.application.findUnique({ where: { id } });
    if (!application) return res.status(404).json({ error: "Not found" });
    if (application.status !== "PENDING") {
      return res.status(400).json({ error: `Application already ${application.status.toLowerCase()}.` });
    }

    if (action === "approve") {
      // Assigns the next sequential, unique LS/ZA certificate number.
      const { number, serial } = await issueNextCertificateNumber();

      const updated = await prisma.application.update({
        where: { id },
        data: {
          status: "APPROVED",
          certificateNumber: number,
          certificateSerial: serial,
          issuedOn: new Date(),
          reviewedBy: admin.email,
          reviewedAt: new Date(),
        },
      });

      try {
        await sendApprovalEmail(updated);
      } catch (err) {
        console.error("Approval email failed:", err);
      }

      return res.status(200).json({ message: "Application approved.", application: updated });
    }

    if (action === "reject") {
      const updated = await prisma.application.update({
        where: { id },
        data: {
          status: "REJECTED",
          rejectionReason: rejectionReason || null,
          reviewedBy: admin.email,
          reviewedAt: new Date(),
        },
      });

      try {
        await sendRejectionEmail(updated, rejectionReason);
      } catch (err) {
        console.error("Rejection email failed:", err);
      }

      return res.status(200).json({ message: "Application rejected.", application: updated });
    }

    return res.status(400).json({ error: "Invalid action. Use 'approve' or 'reject'." });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
