import mongoose from "mongoose";

const jobSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    type: {
      type: String,
      enum: ["Full Time", "Part Time", "Internship", "Contract"],
      default: "Full Time",
    },
    team: {
      type: String,
      enum: ["Development", "Consulting", "Design", "Operations", "Other"],
      default: "Development",
    },
    location: {
      type: String,
      enum: ["Remote", "Lucknow", "Hybrid"],
      default: "Remote",
    },
    summary: { type: String, required: true },
    tags: [{ type: String }],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("Job", jobSchema);
