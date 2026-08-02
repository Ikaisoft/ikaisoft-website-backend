
import Contact from "../models/Contact.js";
import { Resend } from "resend";

const sendContactMail = async (req, res) => {
  const { name, email, phone,service, message } = req.body;

  try {
    // Save to DB
    const resend = new Resend(process.env.RESEND_API_KEY);

    await Contact.create({ name, email, phone, service, message });

    // Send email
    await resend.emails.send({
      from: "Ikaisoft <ikaisoftenquiry@gmail.com>",
      to: "ikaisoftenquiry@gmail.com",
      reply_to: email,
      subject: `New Enquiry Form - ${name}`,
      html: `
        <h3>New Enquiry Message</h3>
        <p><b>Name:</b> ${name}</p>
        <p><b>Email:</b> ${email}</p>
        <p><b>Phone:</b> ${phone}</p>
        <p><b>Service:</b> ${service}</p>
        <p><b>Message:</b> ${message}</p>
      `,
    });

    res.status(200).json({ 
      success: true ,
      message: "Your request has been booked successfully. Our team will contact you within 48 hours."
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "An error occurred while processing your request." });
  }
};
export default sendContactMail;