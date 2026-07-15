import express from "express";
import {
  loginAdmin,
  resetPassword,
  getContacts,
  getEnrollments,
  getRegistrations,
  getDashboardStats,
} from "../controller/adminController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// Public routes
router.post("/admin/login", loginAdmin);

// Protected routes
router.post("/admin/reset-password", authMiddleware, resetPassword);
router.get("/admin/contacts", authMiddleware, getContacts);
router.get("/admin/enrollments", authMiddleware, getEnrollments);
router.get("/admin/registrations", authMiddleware, getRegistrations);
router.get("/admin/stats", authMiddleware, getDashboardStats);

export default router;
