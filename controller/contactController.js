import nodemailer from "nodemailer";
import Contact from "../models/Contact.js";

const sendContactMail = async (req, res) => {
  const { name, email, phone, message } = req.body;

  try {
    // Save to DB
    await Contact.create({ name, email, phone, message });

    // SMTP transporter
    const transporter = nodemailer.createTransport({
      host: "mail.ikaisoft.com",
      port: 587,
      secure: false,
      family: 4,
      auth: {
        user: "info@ikaisoft.com",
        pass: process.env.EMAIL_PASS,
      },
    });

    // Send email
    await transporter.sendMail({
      from: `"Website Contact" <info@ikaisoft.com>`,
      to: "info@ikaisoft.com",
      replyTo: email,
      subject: `New Contact Form - ${name}`,
      html: `
        <h3>New Contact Message</h3>
        <p><b>Name:</b> ${name}</p>
        <p><b>Email:</b> ${email}</p>
        <p><b>Phone:</b> ${phone}</p>
        <p><b>Message:</b> ${message}</p>
      `,
    });

    res.status(200).json({
      success: true,
      message: "Message sent successfully",
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send message",
    });
  }
};
export default sendContactMail;