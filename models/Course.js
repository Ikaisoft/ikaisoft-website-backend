import mongoose from "mongoose";

const courseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    category: {
      type: String,
      enum: ["Data Related", "Full Stack", "Other Courses"],
      default: "Other Courses",
    },
    status: {
      type: String,
      enum: ["Live", "Upcoming"],
      default: "Upcoming",
    },
    duration: { type: String, default: "" },
    level: { type: String, default: "Beginner to Advanced" },
    mode: { type: String, default: "Online / Classroom" },
    schedule: { type: String, default: "Weekdays / Weekends" },
    certificate: { type: Boolean, default: true },
    imageUrl: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
    modules: [{ type: String }],
    highlights: [{ type: String }],
  },
  { timestamps: true }
);

export default mongoose.model("Course", courseSchema);
