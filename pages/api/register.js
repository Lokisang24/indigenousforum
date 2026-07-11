const { formidable } = require("formidable");
const fs = require("fs");
const prisma = require("../../lib/db");
const { generateVerificationCode } = require("../../lib/idGenerator");
const {
  notifyAdminOfNewApplication,
  sendApplicantAcknowledgement,
} = require("../../lib/mailer");

// Disable Next's default body parser so formidable can handle multipart/form-data
// (needed for the optional photo upload).
export const config = {
  api: {
    bodyParser: false,
  },
};

function parseForm(req) {
  const form = formidable({ multiples: false, maxFileSize: 5 * 1024 * 1024 });
  return new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
}

// Retries a few times in the rare case of a unique-constraint collision on
// the randomly generated idNumber / verificationCode.
async function withUniqueRetry(fn, attempts = 5) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      if (err.code === "P2002") {
        lastErr = err;
        continue; // unique constraint collision — regenerate and retry
      }
      throw err;
    }
  }
  throw lastErr;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { fields, files } = await parseForm(req);

    const firstName = String(fields.firstName || "").trim();
    const surname = String(fields.surname || "").trim();
    const dateOfBirth = String(fields.dateOfBirth || "").trim();
    const clan = String(fields.clan || "").trim();
    const address = String(fields.address || "").trim();
    const gender = String(fields.gender || "").trim();
    const email = String(fields.email || "").trim();
    const idNumber = String(fields.idNumber || "").trim();

    if (!firstName || !surname || !dateOfBirth || !clan || !address || !gender || !email || !idNumber) {
      return res.status(400).json({ error: "All fields are required." });
    }

    let photoUrl = null;
    const photoFile = files.photo && (Array.isArray(files.photo) ? files.photo[0] : files.photo);
    if (photoFile && photoFile.filepath) {
      const buffer = fs.readFileSync(photoFile.filepath);
      const mime = photoFile.mimetype || "image/jpeg";
      // Stored inline as a base64 data URL for simplicity. For production,
      // swap this for a proper object storage upload (S3 / Vercel Blob) and
      // store the resulting URL instead.
      photoUrl = `data:${mime};base64,${buffer.toString("base64")}`;
    }

    let application;
    try {
      application = await withUniqueRetry(() =>
        prisma.application.create({
          data: {
            firstName,
            surname,
            dateOfBirth: new Date(dateOfBirth),
            clan,
            address,
            gender,
            email,
            photoUrl,
            idNumber,
            verificationCode: generateVerificationCode(),
          },
        })
      );
    } catch (err) {
      if (err.code === "P2002") {
        const target = (err.meta && err.meta.target) || "";
        if (target.includes("idNumber")) {
          return res.status(400).json({ error: "This ID number has already been used to register." });
        }
      }
      throw err;
    }

    // Fire-and-forget-ish notifications (awaited but errors are logged, not fatal)
    try {
      await notifyAdminOfNewApplication(application);
      await sendApplicantAcknowledgement(application);
    } catch (mailErr) {
      console.error("Notification email failed:", mailErr);
    }

    return res.status(201).json({
      message: "Application submitted successfully. It is now pending review.",
      idNumber: application.idNumber,
      verificationCode: application.verificationCode,
    });
  } catch (err) {
    console.error("Registration error:", err);
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
}
