import Admin from "../models/Admin.js";
import Contact from "../models/Contact.js";
import Enroll from "../models/Enroll.js";
import Registration from "../models/RegistrationModel.js";
import Job from "../models/Job.js";
import Course from "../models/Course.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// Login Admin
export const loginAdmin = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: "Email and password are required." });
  }

  try {
    const admin = await Admin.findOne({ email: email.toLowerCase() });

    if (!admin) {
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }

    const isMatch = await bcrypt.compare(password, admin.password);

    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }

    const token = jwt.sign(
      { id: admin._id, email: admin.email, name: admin.name },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.status(200).json({
      success: true,
      token,
      admin: { id: admin._id, email: admin.email, name: admin.name },
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// Reset Password
export const resetPassword = async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    return res.status(400).json({ success: false, message: "Old and new passwords are required." });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ success: false, message: "New password must be at least 6 characters." });
  }

  try {
    const admin = await Admin.findById(req.admin.id);

    if (!admin) {
      return res.status(404).json({ success: false, message: "Admin not found." });
    }

    const isMatch = await bcrypt.compare(oldPassword, admin.password);

    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Current password is incorrect." });
    }

    const salt = await bcrypt.genSalt(10);
    admin.password = await bcrypt.hash(newPassword, salt);
    await admin.save();

    res.status(200).json({ success: true, message: "Password updated successfully." });
  } catch (error) {
    console.error("Reset Password Error:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// Get all contacts
export const getContacts = async (req, res) => {
  try {
    const contacts = await Contact.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: contacts });
  } catch (error) {
    console.error("Get Contacts Error:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// Get all enrollments
export const getEnrollments = async (req, res) => {
  try {
    const enrollments = await Enroll.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: enrollments });
  } catch (error) {
    console.error("Get Enrollments Error:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// Get all registrations
export const getRegistrations = async (req, res) => {
  try {
    const registrations = await Registration.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: registrations });
  } catch (error) {
    console.error("Get Registrations Error:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// Dashboard stats
export const getDashboardStats = async (req, res) => {
  try {
    const [contactsCount, enrollmentsCount, registrationsCount, activeJobsCount, totalJobsCount, activeCoursesCount, totalCoursesCount] = await Promise.all([
      Contact.countDocuments(),
      Enroll.countDocuments(),
      Registration.countDocuments(),
      Job.countDocuments({ isActive: true }),
      Job.countDocuments(),
      Course.countDocuments({ isActive: true }),
      Course.countDocuments(),
    ]);

    res.status(200).json({
      success: true,
      data: {
        contacts: contactsCount,
        enrollments: enrollmentsCount,
        registrations: registrationsCount,
        activeJobs: activeJobsCount,
        totalJobs: totalJobsCount,
        activeCourses: activeCoursesCount,
        totalCourses: totalCoursesCount,
      },
    });
  } catch (error) {
    console.error("Dashboard Stats Error:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
};
