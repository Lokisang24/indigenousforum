const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");
const sharp = require("sharp");
const CERT_BACKGROUND_DATA_URL = require("./certificateBackground");

const DARK = rgb(0.08, 0.08, 0.08);

function formatDate(d) {
  const date = new Date(d);
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

// Fractional coordinates (0–1) mapped from the certificate template image,
// where (0,0) is the top-left corner. These were measured directly against
// the supplied certificate template so text lands on the printed blank lines.
const FIELDS = {
  name: { x: 0.206, yTop: 0.329 },
  surname: { x: 0.242, yTop: 0.359 },
  dob: { x: 0.309, yTop: 0.391 },
  clan: { x: 0.194, yTop: 0.421 },
  address: { x: 0.218, yTop: 0.453 },
  idNo: { x: 0.388, yTop: 0.620 },
  gender: { x: 0.406, yTop: 0.659 },
  issuedOn: { x: 0.728, yTop: 0.584 },
};

// Photo frame box, as fractions of the full page (top-left origin).
const PHOTO_BOX = { left: 0.1005, right: 0.300, top: 0.567, bottom: 0.734 };

// Certificate serial number placement — bottom of the page, centered.
const SERIAL_Y_TOP_FRACTION = 0.975;

/**
 * Crops/resizes an applicant photo to exactly fill a target box (like CSS
 * `object-fit: cover`), so any photo — portrait, landscape, or square —
 * fills the certificate's photo frame with no gaps or distortion.
 */
async function coverCropPhoto(photoBytes, targetWidthPx, targetHeightPx) {
  return sharp(photoBytes)
    .resize(targetWidthPx, targetHeightPx, { fit: "cover", position: "attention" })
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

  return pdfDoc.save();
}

module.exports = { generateCertificatePdf };
