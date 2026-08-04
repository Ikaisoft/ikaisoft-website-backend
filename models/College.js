import mongoose from "mongoose";

const collegeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    code: { type: String, required: true, trim: true, unique: true },
    address: { type: String, default: "" },
    coordinatorName: { type: String, default: "" },
    coordinatorEmail: { type: String, default: "" },
    phone: { type: String, default: "" },
    logoUrl: { type: String, default: "" },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
    createdDate: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

collegeSchema.index({ name: 1, code: 1 });

export default mongoose.model("College", collegeSchema);
