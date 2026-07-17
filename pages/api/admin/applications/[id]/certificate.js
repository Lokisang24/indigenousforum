const prisma = require("../../../../../lib/db");
const { getAdminFromRequest } = require("../../../../../lib/auth");
const { generateCertificatePdf, getCustomPage2Diagnostic } = require("../../../../../lib/pdfGenerator");

export default async function handler(req, res) {
  const admin = getAdminFromRequest(req);
  if (!admin) {
    return res.status(401).json({ error: "Not authenticated." });
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Diagnostic mode: visit the certificate URL with &debug=1 appended to see,
  // directly in the browser, whether lib/indigenous.jpg was actually found on
  // the server — no need to dig through Vercel's log UI.
  if (req.query.debug === "1") {
    const diagnostic = getCustomPage2Diagnostic();
    return res.status(200).json(diagnostic);
  }

  const { id } = req.query;
  const application = await prisma.application.findUnique({ where: { id } });

  if (!application) return res.status(404).json({ error: "Not found" });
  if (application.status !== "APPROVED") {
    return res.status(400).json({ error: "Certificate is only available for approved applications." });
  }

  let photoBytes = null;
  if (application.photoUrl && application.photoUrl.startsWith("data:")) {
    const base64 = application.photoUrl.split(",")[1];
    photoBytes = Buffer.from(base64, "base64");
  }

  const pdfBytes = await generateCertificatePdf(application, photoBytes);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${application.firstName}_${application.surname}_certificate.pdf"`
  );
  return res.status(200).send(Buffer.from(pdfBytes));
}
