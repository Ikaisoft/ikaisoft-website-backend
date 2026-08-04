import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import ExcelJS from "exceljs";
import { ZipArchive } from "archiver";
import College from "../models/College.js";
import StudentCertificate from "../models/StudentCertificate.js";
import {
  buildCertificateNumberFromSequence,
  buildVerificationUrl,
  generateVerificationToken,
  generateCertificateArtifacts,
  deleteUploadIfExists,
} from "../services/certificateService.js";
import {
  validateCollegePayload,
  validateStudentCertificatePayload,
  sanitizeText,
  sanitizeEmail,
} from "../validators/certificateValidator.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

function toAbsolutePath(fileUrl) {
  if (!fileUrl) return null;
  if (fileUrl.startsWith("http")) return null;
  return path.resolve(rootDir, fileUrl.replace(/^\/+/, ""));
}

async function ensureUniqueCertificateNumber(year) {
  const count = await StudentCertificate.countDocuments({ certificateYear: year });
  return buildCertificateNumberFromSequence(count + 1, year);
}

async function generateCertificateRecord(payload, options = {}) {
  const year = payload.certificateYear || new Date().getFullYear();
  const certificateNumber = options.certificateNumber || (await ensureUniqueCertificateNumber(year));
  const verificationToken = options.verificationToken || generateVerificationToken();
  const artifacts = await generateCertificateArtifacts({
    studentName: payload.studentName,
    courseName: payload.courseName,
    college: payload.college,
    issuedDate: payload.issuedDate || new Date(),
  }, certificateNumber);

  return {
    certificateNumber,
    verificationToken,
    qrCodeUrl: artifacts.qrCodeUrl,
    pdfUrl: artifacts.pdfUrl,
  };
}

export const getColleges = async (req, res) => {
  try {
    const colleges = await College.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: colleges });
  } catch (error) {
    console.error("Get Colleges Error:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

export const createCollege = async (req, res) => {
  const validation = validateCollegePayload(req.body);
  if (!validation.valid) {
    return res.status(400).json({ success: false, message: validation.errors[0] });
  }

  try {
    const payload = { ...validation.data };
    if (req.file) {
      payload.logoUrl = `/uploads/colleges/${req.file.filename}`;
    }
    const college = await College.create(payload);
    res.status(201).json({ success: true, data: college });
  } catch (error) {
    console.error("Create College Error:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

export const updateCollege = async (req, res) => {
  const { id } = req.params;
  const validation = validateCollegePayload(req.body);
  if (!validation.valid) {
    return res.status(400).json({ success: false, message: validation.errors[0] });
  }

  try {
    const college = await College.findById(id);
    if (!college) {
      return res.status(404).json({ success: false, message: "College not found." });
    }

    const updates = { ...validation.data };
    if (req.file) {
      updates.logoUrl = `/uploads/colleges/${req.file.filename}`;
      if (college.logoUrl) {
        await deleteUploadIfExists(college.logoUrl);
      }
    }

    Object.assign(college, updates);
    await college.save();
    res.status(200).json({ success: true, data: college });
  } catch (error) {
    console.error("Update College Error:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

export const deleteCollege = async (req, res) => {
  const { id } = req.params;
  try {
    const college = await College.findByIdAndDelete(id);
    if (!college) {
      return res.status(404).json({ success: false, message: "College not found." });
    }
    if (college.logoUrl) {
      await deleteUploadIfExists(college.logoUrl);
    }
    res.status(200).json({ success: true, message: "College deleted successfully." });
  } catch (error) {
    console.error("Delete College Error:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

export const getCertificates = async (req, res) => {
  const { page = 1, limit = 10, search = "", college = "", course = "", year = "", status = "", issueDate = "" } = req.query;
  const filter = {};

  if (search) {
    const q = sanitizeText(search);
    filter.$or = [
      { studentName: { $regex: q, $options: "i" } },
      { college: { $regex: q, $options: "i" } },
      { courseName: { $regex: q, $options: "i" } },
      { certificateNumber: { $regex: q, $options: "i" } },
      { email: { $regex: q, $options: "i" } },
      { phone: { $regex: q, $options: "i" } },
    ];
  }

  if (college) filter.college = { $regex: sanitizeText(college), $options: "i" };
  if (course) filter.courseName = { $regex: sanitizeText(course), $options: "i" };
  if (year) filter.certificateYear = Number(year);
  if (status) filter.status = status;
  if (issueDate) {
    const start = new Date(issueDate);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    filter.issuedDate = { $gte: start, $lt: end };
  }

  try {
    const total = await StudentCertificate.countDocuments(filter);
    const data = await StudentCertificate.find(filter)
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    res.status(200).json({ success: true, data, total, page: Number(page), limit: Number(limit) });
  } catch (error) {
    console.error("Get Certificates Error:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

export const createCertificate = async (req, res) => {
  const validation = validateStudentCertificatePayload(req.body);
  if (!validation.valid) {
    return res.status(400).json({ success: false, message: validation.errors[0] });
  }

  try {
    const payload = { ...validation.data, ...req.body }; 
    const artifacts = await generateCertificateRecord(payload);
    const certificate = await StudentCertificate.create({
      ...payload,
      ...artifacts,
      certificateYear: payload.certificateYear || new Date().getFullYear(),
    });
    res.status(201).json({ success: true, data: certificate });
  } catch (error) {
    console.error("Create Certificate Error:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

export const updateCertificate = async (req, res) => {
  const { id } = req.params;
  const validation = validateStudentCertificatePayload(req.body);
  if (!validation.valid) {
    return res.status(400).json({ success: false, message: validation.errors[0] });
  }

  try {
    const certificate = await StudentCertificate.findById(id);
    if (!certificate) {
      return res.status(404).json({ success: false, message: "Certificate record not found." });
    }

    const payload = { ...validation.data, ...req.body };
    Object.assign(certificate, payload);
    certificate.certificateYear = certificate.certificateYear || new Date().getFullYear();
    if (!certificate.certificateNumber) {
      certificate.certificateNumber = await ensureUniqueCertificateNumber(certificate.certificateYear);
    }
    if (!certificate.verificationToken) {
      certificate.verificationToken = generateVerificationToken();
    }
    if (!certificate.qrCodeUrl || !certificate.pdfUrl) {
      const artifacts = await generateCertificateRecord({ ...certificate.toObject() }, { certificateNumber: certificate.certificateNumber, verificationToken: certificate.verificationToken });
      certificate.qrCodeUrl = artifacts.qrCodeUrl;
      certificate.pdfUrl = artifacts.pdfUrl;
    }

    await certificate.save();
    res.status(200).json({ success: true, data: certificate });
  } catch (error) {
    console.error("Update Certificate Error:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

export const deleteCertificate = async (req, res) => {
  const { id } = req.params;
  try {
    const certificate = await StudentCertificate.findByIdAndDelete(id);
    if (!certificate) {
      return res.status(404).json({ success: false, message: "Certificate record not found." });
    }
    if (certificate.pdfUrl) await deleteUploadIfExists(certificate.pdfUrl);
    if (certificate.qrCodeUrl) await deleteUploadIfExists(certificate.qrCodeUrl);
    res.status(200).json({ success: true, message: "Certificate deleted successfully." });
  } catch (error) {
    console.error("Delete Certificate Error:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

export const verifyCertificate = async (req, res) => {
  const { certificateNumber } = req.params;
  try {
    const record = await StudentCertificate.findOne({ certificateNumber }).lean();
    if (!record) {
      return res.status(404).json({ success: false, message: "Certificate not found." });
    }

    res.status(200).json({
      success: true,
      data: {
        ...record,
        verificationUrl: buildVerificationUrl(certificateNumber),
      },
    });
  } catch (error) {
    console.error("Verify Certificate Error:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

function buildBackendOrigin(req) {
  if (process.env.BACKEND_ORIGIN) {
    return process.env.BACKEND_ORIGIN.replace(/\/$/, "");
  }
  const proto = req.headers["x-forwarded-proto"] || req.protocol;
  const host = req.headers["x-forwarded-host"] || req.get("host");
  return `${proto}://${host}`;
}

export const getCertificateByNumber = async (req, res) => {
  const { certificateNumber } = req.params;
  try {
    const record = await StudentCertificate.findOne({ certificateNumber }).lean();
    if (!record) {
      return res.status(404).json({ success: false, message: "Certificate not found." });
    }

    const origin = buildBackendOrigin(req);
    const pdfUrl = record.pdfUrl ? `${origin}${record.pdfUrl}` : null;
    const qrCodeUrl = record.qrCodeUrl ? `${origin}${record.qrCodeUrl}` : null;

    res.status(200).json({
      success: true,
      data: {
        ...record,
        pdfUrl,
        qrCodeUrl,
      },
    });
  } catch (error) {
    console.error("Get Certificate Error:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

export const publicVerifyCertificate = async (req, res) => {
  const { certificateNumber } = req.params;
  try {
    const record = await StudentCertificate.findOne({ certificateNumber }).lean();
    if (!record) return res.status(404).send("Certificate not found.");

    const verifyUrl = buildVerificationUrl(certificateNumber);
    const qrUrl = record.qrCodeUrl || `/uploads/certificates/${encodeURIComponent((record.studentName || 'certificate').toLowerCase().replace(/[^a-z0-9]+/g,'-'))}-${certificateNumber.toLowerCase()}.png`;
    const pdfUrl = `/api/certificates/public/${encodeURIComponent(certificateNumber)}/download`;

    const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Certificate ${certificateNumber}</title><style>body{font-family:Arial,sans-serif;background:#f6fbf7;padding:24px} .card{max-width:900px;margin:20px auto;background:#fff;border:12px solid #144a21;border-radius:16px;padding:28px;color:#0f2a18} h1{color:#144a21} .meta{margin-top:10px;color:#334155} .qr{float:right}</style></head><body><div class="card"><div class="qr"><img src="${qrUrl}" width="160" height="160" alt="QR"></div><h1>CERTIFICATE OF COMPLETION</h1><p>This is to certify that</p><h2>${record.studentName}</h2><p>has successfully completed the <strong>${record.courseName}</strong> conducted by <strong>${record.college}</strong>.</p><p class="meta">Date: ${new Date(record.issuedDate || record.createdAt).toLocaleDateString()}</p><p class="meta">Certificate ID: ${certificateNumber}</p><p><a href="${pdfUrl}">Download PDF</a></p><p style="margin-top:32px;font-size:12px;color:#666">Verified at ${verifyUrl}</p></div></body></html>`;

    res.setHeader('Content-Type','text/html');
    res.send(html);
  } catch (error) {
    console.error('Public Verify Error:', error);
    res.status(500).send('Server error.');
  }
};

export const bulkImportCertificates = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "An Excel file is required." });
  }

  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(req.file.path);
    const sheet = workbook.getWorksheet(1);
    const created = [];

    if (!sheet) {
      return res.status(400).json({ success: false, message: "The uploaded Excel file is empty." });
    }

    const rows = [];
    sheet.eachRow({ includeEmpty: false }, (row) => rows.push(row.values.slice(1)));
    rows.shift();

    for (const row of rows) {
      const [studentName, email, phone, college, courseName, duration, completionDate, grade] = row;
      const payload = {
        studentName: sanitizeText(studentName || ""),
        email: sanitizeEmail(email || ""),
        phone: sanitizeText(phone || ""),
        courseName: sanitizeText(courseName || ""),
        courseDuration: sanitizeText(duration || ""),
        completionDate: completionDate ? new Date(completionDate) : null,
        grade: sanitizeText(grade || ""),
        college: sanitizeText(college || ""),
        status: "Issued",
      };
      const validation = validateStudentCertificatePayload(payload);
      if (!validation.valid) continue;
      const artifacts = await generateCertificateRecord(payload);
      const certificate = await StudentCertificate.create({ ...payload, ...artifacts, certificateYear: new Date().getFullYear() });
      created.push(certificate);
    }

    res.status(200).json({ success: true, message: `${created.length} certificates imported successfully.`, data: created });
  } catch (error) {
    console.error("Bulk Import Certificates Error:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

export const exportCertificates = async (req, res) => {
  try {
    const certificates = await StudentCertificate.find().sort({ createdAt: -1 });
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Certificates");
    sheet.columns = [
      { header: "Student Name", key: "studentName", width: 24 },
      { header: "Email", key: "email", width: 24 },
      { header: "College", key: "college", width: 24 },
      { header: "Course", key: "courseName", width: 24 },
      { header: "Certificate Number", key: "certificateNumber", width: 24 },
      { header: "Verification URL", key: "verificationUrl", width: 40 },
      { header: "Status", key: "status", width: 16 },
    ];

    certificates.forEach((certificate) => {
      sheet.addRow({
        studentName: certificate.studentName,
        email: certificate.email,
        college: certificate.college,
        courseName: certificate.courseName,
        certificateNumber: certificate.certificateNumber,
        verificationUrl: buildVerificationUrl(certificate.certificateNumber),
        status: certificate.status,
      });
    });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=certificates.xlsx");
    await workbook.xlsx.write(res);
  } catch (error) {
    console.error("Export Certificates Error:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

export const downloadCertificatePdf = async (req, res) => {
  const { id } = req.params;
  try {
    const certificate = await StudentCertificate.findById(id);
    if (!certificate) {
      return res.status(404).json({ success: false, message: "Certificate record not found." });
    }
    const filePath = toAbsolutePath(certificate.pdfUrl);
    if (!filePath) {
      return res.status(404).json({ success: false, message: "PDF not found." });
    }
    res.setHeader("Content-Type", "application/pdf");
    res.download(filePath, `${certificate.certificateNumber}.pdf`);
  } catch (error) {
    console.error("Download Certificate PDF Error:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// Public download by certificate number (no auth) — used by QR/verify pages
export const publicDownloadByCertificateNumber = async (req, res) => {
  const { certificateNumber } = req.params;
  try {
    const certificate = await StudentCertificate.findOne({ certificateNumber });
    if (!certificate) return res.status(404).send('Certificate not found.');
    const filePath = toAbsolutePath(certificate.pdfUrl);
    if (!filePath) return res.status(404).send('PDF not found.');
    res.setHeader('Content-Type', 'application/pdf');
    res.download(filePath, `${certificate.certificateNumber}.pdf`);
  } catch (error) {
    console.error('Public Download Error:', error);
    res.status(500).send('Server error.');
  }
};

export const downloadAllCertificatesZip = async (req, res) => {
  try {
    const certificates = await StudentCertificate.find({ pdfUrl: { $exists: true, $ne: "" } });
    if (!certificates.length) {
      return res.status(404).json({ success: false, message: "No certificates available." });
    }

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", "attachment; filename=all-certificates.zip");
    const archive = new ZipArchive();
    archive.on("error", (error) => {
      throw error;
    });
    archive.pipe(res);

    for (const certificate of certificates) {
      const filePath = toAbsolutePath(certificate.pdfUrl);
      if (filePath) {
        archive.file(filePath, { name: `${certificate.certificateNumber}.pdf` });
      }
    }

    await archive.finalize();
  } catch (error) {
    console.error("Download Certificates Zip Error:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

export const regenerateCertificate = async (req, res) => {
  const { id } = req.params;
  try {
    const certificate = await StudentCertificate.findById(id);
    if (!certificate) {
      return res.status(404).json({ success: false, message: "Certificate record not found." });
    }
    const artifacts = await generateCertificateRecord({
      studentName: certificate.studentName,
      courseName: certificate.courseName,
      college: certificate.college,
      issuedDate: certificate.issuedDate || new Date(),
    }, { certificateNumber: certificate.certificateNumber, verificationToken: certificate.verificationToken });
    if (certificate.pdfUrl) await deleteUploadIfExists(certificate.pdfUrl);
    if (certificate.qrCodeUrl) await deleteUploadIfExists(certificate.qrCodeUrl);
    certificate.pdfUrl = artifacts.pdfUrl;
    certificate.qrCodeUrl = artifacts.qrCodeUrl;
    await certificate.save();
    res.status(200).json({ success: true, data: certificate });
  } catch (error) {
    console.error("Regenerate Certificate Error:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

export const regenerateQr = async (req, res) => {
  const { id } = req.params;
  try {
    const certificate = await StudentCertificate.findById(id);
    if (!certificate) {
      return res.status(404).json({ success: false, message: "Certificate record not found." });
    }
    const artifacts = await generateCertificateRecord({
      studentName: certificate.studentName,
      courseName: certificate.courseName,
      college: certificate.college,
      issuedDate: certificate.issuedDate || new Date(),
    }, { certificateNumber: certificate.certificateNumber, verificationToken: certificate.verificationToken });
    if (certificate.qrCodeUrl) await deleteUploadIfExists(certificate.qrCodeUrl);
    certificate.qrCodeUrl = artifacts.qrCodeUrl;
    await certificate.save();
    res.status(200).json({ success: true, data: certificate });
  } catch (error) {
    console.error("Regenerate QR Error:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
};
