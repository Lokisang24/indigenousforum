const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");
const CERT_BACKGROUND_DATA_URL = require("./certificateBackground");
const LOGO_DATA_URL = require("./logoImage");

const DARK = rgb(0.08, 0.08, 0.08);
const MUTED = rgb(0.42, 0.42, 0.42);
const ORANGE = rgb(0.91, 0.45, 0.05);
const BLUE = rgb(0.114, 0.31, 0.57);
const BLUE_DARK = rgb(0.071, 0.227, 0.431);

// Optional custom page 2: drop an image file named exactly "indigenous.jpg"
// into the lib/ folder (same place as logoImage.js) and it will be used as
// the second page's background automatically. The certificate number is
// still drawn live on top of it (bottom-left, matching the built-in page's
// footer position), so it always matches the specific applicant even though
// the rest of the page is a fixed image. If the file isn't present, the
// generator falls back to the fully dynamic text-based page below.
const CUSTOM_PAGE2_PATH = path.join(__dirname, "indigenous.jpg");

function loadCustomPage2Image() {
  try {
    const exists = fs.existsSync(CUSTOM_PAGE2_PATH);
    console.log(`[pdfGenerator] Looking for custom page 2 at: ${CUSTOM_PAGE2_PATH} — found: ${exists}`);
    if (exists) {
      return fs.readFileSync(CUSTOM_PAGE2_PATH);
    }
  } catch (err) {
    console.error("[pdfGenerator] Could not read custom page 2 image (lib/indigenous.jpg):", err.message);
  }
  return null;
}

function formatDate(d) {
  const date = new Date(d);
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

// Fractional coordinates (0–1) mapped from the certificate template image,
// measured directly (pixel-precise) against the 1240x1754 background asset,
// so text lands correctly on the printed blank lines next to each label.
const FIELDS = {
  name: { x: 0.195, yTop: 0.3335 },
  surname: { x: 0.2137, yTop: 0.3678 },
  dob: { x: 0.2661, yTop: 0.4037 },
  clan: { x: 0.1774, yTop: 0.4344 },
  address: { x: 0.2056, yTop: 0.4675 },
  idNo: { x: 0.4073, yTop: 0.6386 },
  gender: { x: 0.3935, yTop: 0.6779 },
  issuedOn: { x: 0.7419, yTop: 0.6054 },
};

// Photo frame box, as fractions of the full page (top-left origin), also
// measured pixel-precise against the same background asset.
const PHOTO_BOX = { left: 0.0887, right: 0.2742, top: 0.5617, bottom: 0.7269 };

// Certificate serial number placement — the blank line beneath the
// representatives section, centered horizontally.
const SERIAL_Y_TOP_FRACTION = 0.871;

// Text for the mandatory second page — written in Indigenous Forum's own
// voice. The SAHRC reference is a brief factual citation (what Indigenous
// Forum has done), not a reproduction of the Commission's own letterhead or
// findings. Set SAHRC_COMPLAINT_REF in your environment once a real
// case/reference number is available, and it will appear here automatically.
const SAHRC_REFERENCE = process.env.SAHRC_COMPLAINT_REF || "on file with Indigenous Forum";

const ABOUT_TEXT = [
  "Indigenous Forum is a community organization dedicated to preserving the cultural identity, " +
    "unity, and rights of indigenous Southern African peoples, including the Basotho nation. " +
    "This certificate recognizes an individual's membership within the Indigenous Forum community " +
    "and its associated cultural heritage.",
];

const HISTORY_TEXT = [
  "The Basotho are a Southern African people whose origins trace back to Bantu-speaking " +
    "communities that settled the region from around the 15th century onward. In the 19th " +
    "century, these communities were unified into a single nation under the leadership of King " +
    "Moshoeshoe I, forming the foundation of Basotho identity that continues today across " +
    "modern-day Lesotho and South Africa.",
];

const ADVOCACY_TEXT = [
  `Indigenous Forum has formally raised concerns regarding the historical dispossession of ` +
    `Basotho ancestral land and its lasting impact on Basotho cultural identity and sovereignty ` +
    `with the South African Human Rights Commission (reference: ${SAHRC_REFERENCE}).`,
];

const TERMS_TEXT = [
  "This certificate is issued by Indigenous Forum as a record of community membership and " +
    "cultural recognition. It is not a government-issued identity document and does not confer " +
    "citizenship, legal residency, nationality, or any other statutory right or status.",
];

/**
 * Wraps a paragraph of text to fit within a maximum width, returning an
 * array of lines ready to be drawn one below another.
 */
function wrapText(text, font, size, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let current = "";

  for (const word of words) {
    const trial = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(trial, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = trial;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Crops/resizes an applicant photo to exactly fill a target box (like CSS
 * `object-fit: cover`), so any photo — portrait, landscape, or square —
 * fills the certificate's photo frame with no gaps or distortion.
 */
async function coverCropPhoto(photoBytes, targetWidthPx, targetHeightPx) {
  return sharp(photoBytes)
    .resize(targetWidthPx, targetHeightPx, { fit: "cover", position: "centre" })
    .jpeg({ quality: 88 })
    .toBuffer();
}

/**
 * Generates the registration/identity certificate PDF for an approved
 * applicant, rendered directly on top of the official certificate template.
 *
 * @param {object} application - Prisma Application record (must be APPROVED
 *   and already have certificateSerial / issuedOn set).
 * @param {Buffer|null} photoBytes - optional photo image bytes (jpg/png)
 * @returns {Promise<Uint8Array>} the PDF file bytes
 */
async function generateCertificatePdf(application, photoBytes = null) {
  const pdfDoc = await PDFDocument.create();

  // Background image is a 1240x1754 px (A4-ratio) JPEG, so the page is sized
  // to match that ratio exactly at standard A4 point dimensions.
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const page = pdfDoc.addPage([pageWidth, pageHeight]);

  const bgBase64 = CERT_BACKGROUND_DATA_URL.split(",")[1];
  const bgImage = await pdfDoc.embedJpg(Buffer.from(bgBase64, "base64"));
  page.drawImage(bgImage, { x: 0, y: 0, width: pageWidth, height: pageHeight });

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const drawField = (key, text, size = 12, font = fontBold) => {
    const f = FIELDS[key];
    if (!f) return;
    const x = f.x * pageWidth;
    const y = pageHeight - f.yTop * pageHeight;
    page.drawText(text, { x, y, size, font, color: DARK });
  };

  drawField("name", application.firstName.toUpperCase());
  drawField("surname", application.surname.toUpperCase());
  drawField("dob", formatDate(application.dateOfBirth));
  drawField("clan", application.clan.toUpperCase());
  drawField("address", application.address.toUpperCase(), 11);
  drawField("idNo", application.idNumber);
  drawField("gender", application.gender.toUpperCase());
  drawField("issuedOn", formatDate(application.issuedOn || new Date()));

  // Certificate serial number (the incrementing unique LS/ZA number),
  // centered near the bottom of the page.
  if (application.certificateSerial) {
    const serialText = application.certificateSerial;
    const size = 11;
    const textWidth = fontBold.widthOfTextAtSize(serialText, size);
    page.drawText(serialText, {
      x: (pageWidth - textWidth) / 2,
      y: pageHeight - SERIAL_Y_TOP_FRACTION * pageHeight,
      size,
      font: fontBold,
      color: DARK,
    });
  }

  // Photo — cropped to fill the frame exactly, regardless of the source
  // photo's aspect ratio (portrait, landscape, or square all work).
  if (photoBytes) {
    try {
      const boxLeft = PHOTO_BOX.left * pageWidth;
      const boxRight = PHOTO_BOX.right * pageWidth;
      const boxTop = PHOTO_BOX.top * pageHeight;
      const boxBottom = PHOTO_BOX.bottom * pageHeight;
      const boxWidthPts = boxRight - boxLeft;
      const boxHeightPts = boxBottom - boxTop;

      // Render the crop at ~3x point resolution for crisp print quality.
      const targetWidthPx = Math.round(boxWidthPts * 3);
      const targetHeightPx = Math.round(boxHeightPts * 3);
      const croppedBuffer = await coverCropPhoto(photoBytes, targetWidthPx, targetHeightPx);
      const photoImage = await pdfDoc.embedJpg(croppedBuffer);

      page.drawImage(photoImage, {
        x: boxLeft,
        y: pageHeight - boxBottom,
        width: boxWidthPts,
        height: boxHeightPts,
      });
    } catch (err) {
      console.error("Could not embed applicant photo on certificate:", err.message);
    }
  }

  // ---------------------------------------------------------------
  // Page 2 (mandatory on every certificate).
  // If lib/indigenous.jpg exists, it's used as the full page background,
  // with only the certificate number drawn live on top (so it always
  // matches this specific applicant). Otherwise, falls back to the fully
  // dynamic text-based page below.
  // ---------------------------------------------------------------
  const customPage2Bytes = loadCustomPage2Image();

  if (customPage2Bytes) {
    const page2 = pdfDoc.addPage([pageWidth, pageHeight]);
    const customImage = await pdfDoc.embedJpg(customPage2Bytes);
    page2.drawImage(customImage, { x: 0, y: 0, width: pageWidth, height: pageHeight });
  } else {
    const page2 = pdfDoc.addPage([pageWidth, pageHeight]);
    const margin = 56;
    const contentWidth = pageWidth - margin * 2;
    let cursorY = pageHeight - 64;

    // Top brand bar
    page2.drawRectangle({ x: 0, y: pageHeight - 10, width: pageWidth, height: 10, color: ORANGE });
    page2.drawRectangle({ x: 0, y: pageHeight - 10, width: pageWidth * 0.5, height: 10, color: BLUE });

    const logoBase64 = LOGO_DATA_URL.split(",")[1];
    const logoImage = await pdfDoc.embedJpg(Buffer.from(logoBase64, "base64"));
    const logoSize = 48;
    page2.drawImage(logoImage, { x: margin, y: cursorY - 12, width: logoSize, height: logoSize });

    page2.drawText("INDIGENOUS FORUM", {
      x: margin + logoSize + 14,
      y: cursorY + 8,
      size: 18,
      font: fontBold,
    color: BLUE_DARK,
  });
  page2.drawText("Unity  \u2022  Identity  \u2022  Rights", {
    x: margin + logoSize + 14,
    y: cursorY - 10,
    size: 10,
    font: fontRegular,
    color: MUTED,
  });

  cursorY -= 70;
  page2.drawLine({
    start: { x: margin, y: cursorY },
    end: { x: pageWidth - margin, y: cursorY },
    thickness: 1,
    color: rgb(0.85, 0.85, 0.85),
  });
  cursorY -= 32;

  const drawSection = (heading, paragraphs) => {
    page2.drawText(heading, { x: margin, y: cursorY, size: 13, font: fontBold, color: ORANGE });
    cursorY -= 20;
    for (const para of paragraphs) {
      const lines = wrapText(para, fontRegular, 10.5, contentWidth);
      for (const line of lines) {
        page2.drawText(line, { x: margin, y: cursorY, size: 10.5, font: fontRegular, color: DARK });
        cursorY -= 15.5;
      }
      cursorY -= 8;
    }
    cursorY -= 10;
  };

  drawSection("ABOUT INDIGENOUS FORUM", ABOUT_TEXT);
  drawSection("HISTORICAL CONTEXT \u2014 THE BASOTHO PEOPLE", HISTORY_TEXT);
  drawSection("HUMAN RIGHTS ADVOCACY", ADVOCACY_TEXT);
  drawSection("CERTIFICATE TERMS", TERMS_TEXT);

  // Footer: certificate reference + contact, repeated for a document that
  // may be printed/viewed as a standalone page.
  const footerY = 64;
  page2.drawLine({
    start: { x: margin, y: footerY + 24 },
    end: { x: pageWidth - margin, y: footerY + 24 },
    thickness: 1,
    color: rgb(0.85, 0.85, 0.85),
  });

  if (application.certificateSerial) {
    page2.drawText(`Certificate No: ${application.certificateSerial}`, {
      x: margin,
      y: footerY,
      size: 9,
      font: fontBold,
      color: BLUE_DARK,
    });
  }
  const contactText = "indiforum39@gmail.com";
  const contactWidth = fontRegular.widthOfTextAtSize(contactText, 9);
  page2.drawText(contactText, {
    x: pageWidth - margin - contactWidth,
    y: footerY,
    size: 9,
    font: fontRegular,
    color: MUTED,
  });
  } // end else (dynamic text-based page 2)

  return pdfDoc.save();
}

module.exports = { generateCertificatePdf };
