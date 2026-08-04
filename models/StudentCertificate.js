import mongoose from "mongoose";

const studentCertificateSchema = new mongoose.Schema(
  {
    studentName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, default: "" },
    courseName: { type: String, required: true, trim: true },
    courseDuration: { type: String, default: "" },
    completionDate: { type: Date, default: null },
    grade: { type: String, default: "" },
    college: { type: String, default: "" },
    collegeId: { type: mongoose.Schema.Types.ObjectId, ref: "College", default: null },
    certificateNumber: { type: String, required: true, unique: true, trim: true },
    verificationToken: { type: String, required: true, unique: true, trim: true },
    qrCodeUrl: { type: String, default: "" },
    pdfUrl: { type: String, default: "" },
    status: { type: String, enum: ["Issued", "Pending", "Revoked"], default: "Issued" },
    issuedDate: { type: Date, default: Date.now },
    remarks: { type: String, default: "" },
    certificateYear: { type: Number, default: new Date().getFullYear() },
  },
  { timestamps: true }
);

studentCertificateSchema.index({ studentName: 1, college: 1, courseName: 1, certificateNumber: 1, status: 1 });

export default mongoose.model("StudentCertificate", studentCertificateSchema);
