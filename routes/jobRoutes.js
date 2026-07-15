import express from "express";
import {
  createJob,
  getAllJobs,
  getAllJobsAdmin,
  updateJob,
  toggleJobStatus,
  deleteJob,
} from "../controller/jobController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// Public routes
router.get("/jobs", getAllJobs);

// Protected routes (Admin only)
router.post("/jobs", authMiddleware, createJob);
router.get("/jobs/admin", authMiddleware, getAllJobsAdmin);
router.put("/jobs/:id", authMiddleware, updateJob);
router.patch("/jobs/:id/toggle", authMiddleware, toggleJobStatus);
router.delete("/jobs/:id", authMiddleware, deleteJob);

export default router;
