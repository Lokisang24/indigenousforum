const nodemailer = require("nodemailer");

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

async function sendMail({ to, subject, html }) {
  // If SMTP isn't configured (e.g. local dev without a mail provider yet),
  // log instead of throwing, so the rest of the app keeps working.
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    console.log("[mailer] SMTP not configured. Would have sent:", { to, subject });
    return;
  }

  const transporter = getTransporter();
  await transporter.sendMail({
    from: process.env.SMTP_FROM || `"Indigenous Forums" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
  });
}

async function notifyAdminOfNewApplication(application) {
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
  if (!adminEmail) return;

  await sendMail({
    to: adminEmail,
    subject: `New registration: ${application.firstName} ${application.surname}`,
    html: `
      <h2>New Application Submitted</h2>
      <p><b>Name:</b> ${application.firstName} ${application.surname}</p>
      <p><b>Date of Birth:</b> ${new Date(application.dateOfBirth).toLocaleDateString()}</p>
      <p><b>Clan:</b> ${application.clan}</p>
      <p><b>Address:</b> ${application.address}</p>
      <p><b>Gender:</b> ${application.gender}</p>
      <p><b>Email:</b> ${application.email}</p>
      <p><b>ID No:</b> ${application.idNumber}</p>
      <p><b>Verification Code:</b> ${application.verificationCode}</p>
      <p><b>Submitted:</b> ${new Date(application.createdAt).toLocaleString()}</p>
      <p>Log in to the admin dashboard to review this application.</p>
    `,
  });
}

async function sendApplicantAcknowledgement(application) {
  await sendMail({
    to: application.email,
    subject: "We received your Indigenous Forums registration",
    html: `
      <p>Dear ${application.firstName},</p>
      <p>Thank you for registering with Indigenous Forums. Your application has been received
      and is pending review by an administrator.</p>
      <p>Your reference verification code is: <b>${application.verificationCode}</b></p>
      <p>You will be notified by email once a decision has been made.</p>
    `,
  });
}

async function sendApprovalEmail(application) {
  await sendMail({
    to: application.email,
    subject: "Your Indigenous Forums registration has been approved",
    html: `
      <p>Dear ${application.firstName},</p>
      <p>Congratulations — your application has been <b>approved</b>.</p>
      <p>Your official certificate number is: <b>${application.certificateSerial}</b></p>
      <p>Your certificate is attached / available for download from your confirmation link.</p>
    `,
  });
}

async function sendRejectionEmail(application, reason) {
  await sendMail({
    to: application.email,
    subject: "Update on your Indigenous Forums registration",
    html: `
      <p>Dear ${application.firstName},</p>
      <p>We regret to inform you that your application was not approved at this time.</p>
      ${reason ? `<p><b>Reason:</b> ${reason}</p>` : ""}
    `,
  });
}

module.exports = {
  sendMail,
  notifyAdminOfNewApplication,
  sendApplicantAcknowledgement,
  sendApprovalEmail,
  sendRejectionEmail,
};
