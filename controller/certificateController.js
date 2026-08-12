import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import ExcelJS from "exceljs";
import { createRequire } from "module";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import College from "../models/College.js";
import StudentCertificate from "../models/StudentCertificate.js";
const require = createRequire(import.meta.url);
const archiver = require("archiver");
import {
  buildCertificateNumberFromSequence,
  buildVerificationUrl,
  generateVerificationToken,
  generateCertificateArtifacts,
  generateVerificationQrBuffer,
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
      .sort({ certificateNumber: 1 })
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
    const pdfUrl = `${origin}/api/certificates/public/${encodeURIComponent(certificateNumber)}/download`;
    const qrCodeUrl = `${origin}/api/certificate/${encodeURIComponent(certificateNumber)}/qr`;

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

export const getCertificateQr = async (req, res) => {
  const { certificateNumber } = req.params;
  try {
    const record = await StudentCertificate.findOne({ certificateNumber }).lean();
    if (!record) return res.status(404).send('Certificate not found.');

    const buffer = await generateVerificationQrBuffer(certificateNumber);
    res.setHeader('Content-Type', 'image/png');
    res.send(buffer);
  } catch (error) {
    console.error('Get Certificate QR Error:', error);
    res.status(500).send('Server error.');
  }
};

export const publicVerifyCertificate = async (req, res) => {
  const { certificateNumber } = req.params;
  try {
    const record = await StudentCertificate.findOne({ certificateNumber }).lean();
    if (!record) return res.status(404).send("Certificate not found.");

    const origin = buildBackendOrigin(req);
    return res.redirect(301, `${origin}/certificate?id=${encodeURIComponent(certificateNumber)}`);
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
    const certificates = await StudentCertificate.find().sort({ certificateNumber: 1 });
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Certificates");
    sheet.columns = [
      { header: "Student Name", key: "studentName", width: 28 },
      { header: "Certificate Number", key: "certificateNumber", width: 24 },
      { header: "Course", key: "courseName", width: 24 },
      { header: "College", key: "college", width: 24 },
      { header: "QR Code URL", key: "qrCodeUrl", width: 48 },
      { header: "Verification URL", key: "verificationUrl", width: 48 },
      { header: "Issued Date", key: "issuedDate", width: 18 },
      { header: "Status", key: "status", width: 14 },
    ];

    certificates.forEach((certificate) => {
      sheet.addRow({
        studentName: certificate.studentName,
        certificateNumber: certificate.certificateNumber,
        courseName: certificate.courseName,
        college: certificate.college,
        qrCodeUrl: buildVerificationUrl(certificate.certificateNumber),
        verificationUrl: buildVerificationUrl(certificate.certificateNumber),
        issuedDate: certificate.issuedDate ? new Date(certificate.issuedDate).toLocaleDateString() : "",
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

export const exportCertificatesPdf = async (req, res) => {
  try {
    const certificates = await StudentCertificate.find().sort({ certificateNumber: 1 });
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const pageWidth = 850;
    const pageHeight = 1100;

    let page = pdfDoc.addPage([pageWidth, pageHeight]);
    let y = pageHeight - 50;

    page.drawText("Certificates Export", {
      x: 40,
      y,
      size: 24,
      font: boldFont,
    });

    y -= 28;
    page.drawText(`Generated: ${new Date().toLocaleString()}`, {
      x: 40,
      y,
      size: 10,
      font,
    });

    y -= 26;

    for (const certificate of certificates) {
      if (y < 160) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        y = pageHeight - 50;
      }

      page.drawText(`Student Name: ${certificate.studentName || "N/A"}`, {
        x: 40,
        y,
        size: 11,
        font,
      });
      y -= 16;

      page.drawText(`Certificate Number: ${certificate.certificateNumber || "N/A"}`, {
        x: 40,
        y,
        size: 11,
        font,
      });
      y -= 16;

      page.drawText(`Course: ${certificate.courseName || "N/A"}`, {
        x: 40,
        y,
        size: 11,
        font,
      });
      y -= 16;

      page.drawText(`College: ${certificate.college || "N/A"}`, {
        x: 40,
        y,
        size: 11,
        font,
      });
      y -= 16;

        page.drawText(`QR Code: ${buildVerificationUrl(certificate.certificateNumber)}`, {
        x: 40,
        y,
        size: 10,
        font,
      });
      y -= 16;

      page.drawText(`Course: ${certificate.courseName || "N/A"}`, {
        x: 40,
        y,
        size: 10,
        font,
      });
      y -= 16;

      page.drawText(`College: ${certificate.college || "N/A"}`, {
        x: 40,
        y,
        size: 10,
        font,
      });
      y -= 24;

      page.drawLine({ start: { x: 40, y }, end: { x: pageWidth - 40, y }, color: rgb(0.75, 0.75, 0.75), thickness: 0.5 });
      y -= 18;
    }

    const pdfBytes = await pdfDoc.save();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=certificates-export.pdf");
    res.send(Buffer.from(pdfBytes));
  } catch (error) {
    console.error("Export Certificates PDF Error:", error);
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

    const archive = archiver("zip", { zlib: { level: 9 } });
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
