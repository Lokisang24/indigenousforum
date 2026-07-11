const crypto = require("crypto");
const prisma = require("./db");

/**
 * Generates a unique 15-character hexadecimal verification code (OTP),
 * permanently linked to a single application, per the project spec.
 */
function generateVerificationCode() {
  // 15 hex characters
  return crypto.randomBytes(8).toString("hex").slice(0, 15).toUpperCase();
}

/**
 * Atomically increments the shared certificate counter and returns the next
 * certificate number + formatted serial (e.g. "LS/ZA 2006241").
 * Only called once, at admin approval time, so every approved member gets a
 * unique, sequential certificate number.
 */
async function issueNextCertificateNumber() {
  const counter = await prisma.certificateCounter.upsert({
    where: { id: 1 },
    update: { lastNumber: { increment: 1 } },
    create: { id: 1, lastNumber: 2006241 },
  });

  const number = counter.lastNumber;
  const serial = `LS/ZA ${number}`;
  return { number, serial };
}

module.exports = {
  generateVerificationCode,
  issueNextCertificateNumber,
};
