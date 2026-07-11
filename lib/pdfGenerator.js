const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");
const fs = require("fs");
const path = require("path");

// Certificate copy is configurable via env vars so this can be reused for any
// org, not just the "Sotho Indigenous" example in the sample document.
const ORG_TITLE = process.env.CERT_ORG_TITLE || "SOTHO INDIGENOUS";
const CERT_TITLE = process.env.CERT_TITLE || "IDENTITY CERTIFICATE";
const CERTIFIED_BY = process.env.CERT_CERTIFIED_BY || "INDIGENOUS FORUM";
const CONTACT_EMAIL = process.env.CERT_CONTACT_EMAIL || "indiforum39@gmail.com";
const TERRITORY = process.env.CERT_TERRITORY || "MODERN DAY SA/LES";
const COORDINATING_CHIEF = process.env.CERT_COORDINATING_CHIEF || "A. MOKOTJOMELA";
const SENIOR_CHIEF = process.env.CERT_SENIOR_CHIEF || "R. GUGUSHE";

const MAROON = rgb(0.53, 0.06, 0.06);
const DARK = rgb(0.12, 0.12, 0.12);
const GOLD = rgb(0.55, 0.42, 0.1);

function formatDate(d) {
  const date = new Date(d);
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/**
 * Generates the registration/identity certificate PDF for an approved
 * applicant, laid out to resemble the provided sample certificate.
 *
 * @param {object} application - Prisma Application record (must be APPROVED
 *   and already have certificateSerial / issuedOn set).
 * @param {Buffer|null} photoBytes - optional photo image bytes (jpg/png)
 * @returns {Promise<Uint8Array>} the PDF file bytes
 */
async function generateCertificatePdf(application, photoBytes = null) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([842, 595]); // A4 landscape
  const { width, height } = page.getSize();

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);

  // Outer decorative border (simple double rule, since we don't have the
  // ornamental pattern assets — swap in a custom background image if desired
  // via public/assets/certificate-background.png).
  const margin = 18;
  page.drawRectangle({
    x: margin,
    y: margin,
    width: width - margin * 2,
    height: height - margin * 2,
    borderColor: GOLD,
    borderWidth: 3,
  });
  page.drawRectangle({
    x: margin + 8,
    y: margin + 8,
    width: width - (margin + 8) * 2,
    height: height - (margin + 8) * 2,
    borderColor: MAROON,
    borderWidth: 1,
  });

  let cursorY = height - 70;

  const drawCentered = (text, size, font, color, y) => {
    const textWidth = font.widthOfTextAtSize(text, size);
    page.drawText(text, { x: (width - textWidth) / 2, y, size, font, color });
  };

  drawCentered(ORG_TITLE, 28, fontBold, MAROON, cursorY);
  cursorY -= 30;
  drawCentered(CERT_TITLE, 18, fontBold, DARK, cursorY);
  cursorY -= 40;
  drawCentered("CERTIFICATE OF INDIGENOUS IDENTITY", 16, fontBold, DARK, cursorY);
  cursorY -= 34;
  drawCentered("This is to certify that", 13, fontItalic, DARK, cursorY);

  cursorY -= 46;
  const leftX = 70;
  const labelSize = 11;
  const valueSize = 13;
  const lineGap = 34;

  const field = (label, value, y) => {
    page.drawText(label, { x: leftX, y, size: labelSize, font: fontBold, color: MAROON });
    const labelWidth = fontBold.widthOfTextAtSize(label, labelSize);
    page.drawText(value, {
      x: leftX + labelWidth + 8,
      y,
      size: valueSize,
      font: fontRegular,
      color: DARK,
    });
    // underline
    page.drawLine({
      start: { x: leftX, y: y - 4 },
      end: { x: width - 300, y: y - 4 },
      thickness: 0.5,
      color: rgb(0.6, 0.6, 0.6),
    });
  };

  field("NAME:", application.firstName.toUpperCase(), cursorY);
  cursorY -= lineGap;
  field("SURNAME:", application.surname.toUpperCase(), cursorY);
  cursorY -= lineGap;
  field("DATE OF BIRTH:", formatDate(application.dateOfBirth), cursorY);
  cursorY -= lineGap;
  field("CLAN:", application.clan.toUpperCase(), cursorY);
  cursorY -= lineGap;
  field("ADDRESS:", application.address.toUpperCase(), cursorY);

  cursorY -= 40;
  const bodyText = [
    "Is recognized as a member of the Indigenous Community and is",
    "entitled to the rights and traditions of the people.",
  ];
  bodyText.forEach((line, i) => {
    page.drawText(line, {
      x: leftX,
      y: cursorY - i * 18,
      size: 12,
      font: fontItalic,
      color: DARK,
    });
  });

  // Photo box (bottom-left)
  const photoBoxX = leftX;
  const photoBoxY = margin + 40;
  const photoBoxW = 110;
  const photoBoxH = 130;
  page.drawRectangle({
    x: photoBoxX,
    y: photoBoxY,
    width: photoBoxW,
    height: photoBoxH,
    borderColor: DARK,
    borderWidth: 1,
  });

  if (photoBytes) {
    try {
      let img;
      try {
        img = await pdfDoc.embedJpg(photoBytes);
      } catch {
        img = await pdfDoc.embedPng(photoBytes);
      }
      const scale = Math.min(photoBoxW / img.width, photoBoxH / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      page.drawImage(img, {
        x: photoBoxX + (photoBoxW - w) / 2,
        y: photoBoxY + (photoBoxH - h) / 2,
        width: w,
        height: h,
      });
    } catch (err) {
      console.error("Could not embed applicant photo:", err.message);
    }
  } else {
    drawCentered("PHOTO", 10, fontRegular, rgb(0.6, 0.6, 0.6), photoBoxY + photoBoxH / 2);
  }

  // Right-hand details block
  const rightX = photoBoxX + photoBoxW + 40;
  let rY = photoBoxY + photoBoxH - 10;
  const rightField = (label, value) => {
    page.drawText(label, { x: rightX, y: rY, size: 11, font: fontBold, color: MAROON });
    page.drawText(value, {
      x: rightX + fontBold.widthOfTextAtSize(label, 11) + 8,
      y: rY,
      size: 12,
      font: fontRegular,
      color: DARK,
    });
    rY -= 24;
  };

  rightField("ISSUED ON:", formatDate(application.issuedOn || new Date()));
  rightField("CERTIFIED BY:", CERTIFIED_BY);
  rightField("EMAIL:", CONTACT_EMAIL);
  rightField("ID NO:", application.idNumber);
  rightField("GENDER:", application.gender.toUpperCase());
  rightField("TERRITORY:", TERRITORY);

  // Representatives (bottom, spanning width)
  page.drawText("REPRESENTATIVES:", {
    x: photoBoxX,
    y: photoBoxY - 20,
    size: 10,
    font: fontBold,
    color: MAROON,
  });
  page.drawText(`COORDINATING CHIEF: ${COORDINATING_CHIEF}`, {
    x: photoBoxX,
    y: photoBoxY - 34,
    size: 10,
    font: fontRegular,
    color: DARK,
  });
  page.drawText(`SENIOR CHIEF: ${SENIOR_CHIEF}`, {
    x: photoBoxX,
    y: photoBoxY - 48,
    size: 10,
    font: fontRegular,
    color: DARK,
  });

  // Certificate serial number, bottom center (the incrementing unique number)
  drawCentered(application.certificateSerial, 14, fontBold, MAROON, margin + 18);

  return pdfDoc.save();
}

module.exports = { generateCertificatePdf };
