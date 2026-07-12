const prisma = require("../../../../lib/db");
const { getAdminFromRequest, verifyPassword } = require("../../../../lib/auth");
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

  if (req.method === "DELETE") {
    const { password } = req.body || {};
    if (!password) {
      return res.status(400).json({ error: "Password confirmation is required to delete an application." });
    }

    // Re-verify the CURRENTLY LOGGED IN admin's own password (looked up by
    // their email from the session, not any value the client could send),
    // so deletion always requires proving identity again, right before an
    // irreversible action.
    const adminRecord = await prisma.admin.findUnique({ where: { email: admin.email } });
    if (!adminRecord) {
      return res.status(401).json({ error: "Admin account not found." });
    }

    const valid = await verifyPassword(password, adminRecord.passwordHash);
    if (!valid) {
      return res.status(403).json({ error: "Incorrect password. Deletion cancelled." });
    }

    const application = await prisma.application.findUnique({ where: { id } });
    if (!application) return res.status(404).json({ error: "Not found" });

    await prisma.application.delete({ where: { id } });
    return res.status(200).json({ message: "Application deleted." });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
