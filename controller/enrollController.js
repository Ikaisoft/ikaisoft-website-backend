import Enroll from "../models/Enroll.js";
import { Resend } from "resend";

const sendEnrollForm = async (req, res) => {
  const { name, email, phone, course, message } = req.body;

  // Validation
  if (!name || !email || !phone || !course) {
    return res.status(400).json({
      success: false,
      message: "Please fill all required fields.",
    });
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);

    // Save to DB
    await Enroll.create({ name, email, phone, course, message });

    // Send notification email to admin
    await resend.emails.send({
      from: "Ikaisoft <contact@ikaisoft.com>",
      to: "contact@ikaisoft.com",
      reply_to: email,
      subject: `New Course Enrollment - ${name}`,
      html: `
<div style="font-family:Arial,sans-serif;">
    <h2 style="color:#229920;">New Course Enrollment</h2>

    <table cellpadding="8">
        <tr>
            <td><strong>Name</strong></td>
            <td>${name}</td>
        </tr>
        <tr>
            <td><strong>Email</strong></td>
            <td>${email}</td>
        </tr>
        <tr>
            <td><strong>Phone</strong></td>
            <td>${phone}</td>
        </tr>
        <tr>
            <td><strong>Course</strong></td>
            <td>${course}</td>
        </tr>
        <tr>
            <td><strong>Message</strong></td>
            <td>${message || "N/A"}</td>
        </tr>
    </table>
</div>
`,
    });

    // Send confirmation email to the user
    await resend.emails.send({
      from: "Ikaisoft <contact@ikaisoft.com>",
      to: email,
      subject: `Enrollment Confirmation - ${course} | Ikaisoft`,
      html: `
<div style="font-family:Arial,sans-serif; max-width:600px; margin:0 auto;">
    <div style="background:#229920; padding:24px 32px; border-radius:12px 12px 0 0;">
        <h2 style="color:#ffffff; margin:0;">Thank You for Enrolling!</h2>
    </div>
    <div style="padding:32px; background:#ffffff; border:1px solid #e5e7eb; border-top:none; border-radius:0 0 12px 12px;">
        <p style="font-size:16px; color:#1f2937;">Hi <strong>${name}</strong>,</p>
        <p style="font-size:15px; color:#4b5563; line-height:1.7;">
            We have received your enrollment request for the course: <strong style="color:#229920;">${course}</strong>.
        </p>
        <p style="font-size:15px; color:#4b5563; line-height:1.7;">
            Our team will review your application and <strong>contact you within 48 hours</strong> to provide further details about the course schedule, fees, and next steps.
        </p>
        <div style="background:#f0fdf4; border-left:4px solid #229920; padding:16px; margin:24px 0; border-radius:0 8px 8px 0;">
            <p style="margin:0; font-size:14px; color:#166534;">
                📞 If you have any urgent questions, feel free to reach us at <a href="mailto:contact@ikaisoft.com" style="color:#229920;">contact@ikaisoft.com</a>
            </p>
        </div>
        <p style="font-size:15px; color:#4b5563;">Best regards,</p>
        <p style="font-size:15px; color:#1f2937; font-weight:600;">The Ikaisoft Team</p>
    </div>
</div>
`,
    });

    res.status(200).json({
      success: true,
      message: "Enrollment successful! Our team will contact you within 48 hours.",
    });

  } catch (error) {
    console.error("Enroll Error:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while processing your enrollment. Please try again.",
    });
  }
};

export default sendEnrollForm;