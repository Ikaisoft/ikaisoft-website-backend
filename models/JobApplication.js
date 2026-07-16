import mongoose from "mongoose";

const jobApplicationSchema = new mongoose.Schema(
  {
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: "Job", required: true, index: true },
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    experience: { type: String, trim: true },
    education: { type: String, trim: true },
    message: { type: String, trim: true },
    resumeName: { type: String, trim: true },
    resumeType: { type: String, trim: true },
    resumeData: { type: String, trim: true },
  },
  { timestamps: true }
);

export default mongoose.model("JobApplication", jobApplicationSchema);
