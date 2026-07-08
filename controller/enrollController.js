import Enroll from "../models/Enroll.js";
import { Resend } from "resend";

const sendEnrollForm = async (req, res) => {
  const { name, email, phone, course, message } = req.body;

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);

    // Save to DB
    await Enroll.create({ name, email, phone, course, message });

    // Send Email
    await resend.emails.send({
      from: "onboarding@resend.dev", 
      to: "contact@ikaisoft.com",
      reply_to: email,
      subject: `New Enrollment - ${name}`,
      html: `
        <h3>New Enrollment Request</h3>
        <p><b>Name:</b> ${name}</p>
        <p><b>Email:</b> ${email}</p>
        <p><b>Phone:</b> ${phone}</p>
        <p><b>Course:</b> ${course}</p>
        <p><b>Message:</b> ${message}</p>
      `,
    });

    res.status(200).json({ success: true });

  } catch (error) {
    console.error("Enroll Error:", error);
    res.status(500).json({ success: false });
  }
};

export default sendEnrollForm;