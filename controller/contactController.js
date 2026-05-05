
import Contact from "../models/Contact.js";
import { Resend } from "resend";

const sendContactMail = async (req, res) => {
  const { name, email, phone, message } = req.body;

  try {
    // Save to DB
    const resend = new Resend(process.env.RESEND_API_KEY);

    await Contact.create({ name, email, phone, message });

    // Send email
    await resend.emails.send({
      from: "onboarding@resend.dev",
      to: "info@ikaisoft.com",
      reply_to: email,
      subject: `New Contact Form - ${name}`,
      html: `
        <h3>New Contact Message</h3>
        <p><b>Name:</b> ${name}</p>
        <p><b>Email:</b> ${email}</p>
        <p><b>Phone:</b> ${phone}</p>
        <p><b>Message:</b> ${message}</p>
      `,
    });

    res.status(200).json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false });
  }
};
export default sendContactMail;