
import Registration from "../models/RegistrationModel.js";
import { Resend } from "resend";

const sendRegistrationMail = async (req, res) => {
    const { name, email, phone, course, message } = req.body;
    if (!name || !email || !phone || !course) {
        return res.status(400).json({
            success: false,
            message: "Please fill all required fields.",
        });
    }
    try {
        // Save to DB
        const resend = new Resend(process.env.RESEND_API_KEY);

        await Registration.create({ name, email, phone, course, message });

        // Send email
        await resend.emails.send({
            from: "Ikaisoft <ikaisoftenquiry@gmail.com>",
            to: "ikaisoftenquiry@gmail.com",
            reply_to: email,
            subject: `New Enquiry Form - ${name}`,
            html: `
<div style="font-family:Arial,sans-serif;">
    <h2 style="color:#0A8F2D;">New Registration</h2>

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
            <td>${message}</td>
        </tr>
    </table>
</div>
`,
        });

        await resend.emails.send({
            from: "Ikaisoft <ikaisoftenquiry@gmail.com>",
            to: email,
            subject: `Confirmation of Registration, ${name}`,
            html: `
        <h3>Thank you for your registration, ${name}!</h3>
        <p>We have received your registration for the course: <b>${course}</b>.</p>
        <p>Our team will contact you within 48 hours to provide further details.</p>
        <p>Best regards,</p>
        <p>The Ikaisoft Team</p>
      `,
        });

        res.status(200).json({
            success: true,
            message: "Your request has been booked successfully. Our team will contact you within 48 hours."
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "An error occurred while processing your request." });
    }
};
export default sendRegistrationMail;