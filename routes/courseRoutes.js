import express from "express";
import {
  createCourse,
  getAllCourses,
  getAllCoursesAdmin,
  updateCourse,
  toggleCourseStatus,
  deleteCourse,
} from "../controller/courseController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// Public routes
router.get("/courses", getAllCourses);

// Protected routes (Admin only)
router.post("/courses", authMiddleware, createCourse);
router.get("/courses/admin", authMiddleware, getAllCoursesAdmin);
router.put("/courses/:id", authMiddleware, updateCourse);
router.patch("/courses/:id/toggle", authMiddleware, toggleCourseStatus);
router.delete("/courses/:id", authMiddleware, deleteCourse);

export default router;
