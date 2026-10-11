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
  const prefix = `ICS-${year}-`;
  const existing = await StudentCertificate.find(
    { certificateNumber: { $regex: new RegExp(`^ICS-${year}-\\d+$`) } },
    { certificateNumber: 1 }
  ).lean();

  let maxSeq = 0;
  for (const item of existing) {
    if (item.certificateNumber) {
      const num = parseInt(item.certificateNumber.replace(prefix, ""), 10);
      if (!isNaN(num) && num > maxSeq) {
        maxSeq = num;
      }
    }
  }

  let nextSeq = maxSeq + 1;
  let candidate = buildCertificateNumberFromSequence(nextSeq, year);
  while (await StudentCertificate.exists({ certificateNumber: candidate })) {
    nextSeq += 1;
    candidate = buildCertificateNumberFromSequence(nextSeq, year);
  }
  return candidate;
}

function extractCellValue(val) {
  if (val === null || val === undefined) return "";
  if (typeof val === "string") return val.trim();
  if (typeof val === "number" || typeof val === "boolean") return String(val).trim();
  if (val instanceof Date) return val;
  if (typeof val === "object") {
    if (val.result !== undefined && val.result !== null) {
      return extractCellValue(val.result);
    }
    if (val.text !== undefined && val.text !== null) {
      return String(val.text).trim();
    }
    if (val.hyperlink) {
      return String(val.hyperlink).replace(/^mailto:/i, "").trim();
    }
    if (Array.isArray(val.richText)) {
      return val.richText.map((chunk) => chunk.text || "").join("").trim();
    }
  }
  return String(val).trim();
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
        verificationUrl: buildVerificationUrl(),
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
  const { email } = req.query;
  try {
    const record = await StudentCertificate.findOne({
      certificateNumber: { $regex: new RegExp(`^${String(certificateNumber).trim()}$`, "i") },
    }).lean();
    if (!record) {
      return res.status(404).json({ success: false, message: "Certificate not found." });
    }

    const origin = buildBackendOrigin(req);
    const pdfUrl = `${origin}/api/certificates/public/${encodeURIComponent(record.certificateNumber)}/download?email=${encodeURIComponent(record.email || "")}`;
    const qrCodeUrl = `${origin}/api/certificate/qr`;

    if (email) {
      const studentEmail = (record.email || "").toLowerCase().trim();
      const inputEmail = String(email).toLowerCase().trim();
      if (studentEmail !== inputEmail) {
        return res.status(403).json({
          success: false,
          message: "Email address does not match this certificate record.",
        });
      }

      const allCerts = await StudentCertificate.find({
        email: { $regex: new RegExp(`^${studentEmail}$`, "i") },
      }).sort({ issuedDate: -1, createdAt: -1 }).lean();

      const formattedCertificates = allCerts.map((c) => ({
        ...c,
        pdfUrl: `${origin}/api/certificates/public/${encodeURIComponent(c.certificateNumber)}/download?email=${encodeURIComponent(c.email || "")}`,
        qrCodeUrl: `${origin}/api/certificate/qr`,
        verificationUrl: buildVerificationUrl(),
      }));

      const currentCert = formattedCertificates.find(
        (c) => c.certificateNumber.toLowerCase() === record.certificateNumber.toLowerCase()
      ) || formattedCertificates[0];

      return res.status(200).json({
        success: true,
        verified: true,
        data: currentCert,
        certificates: formattedCertificates,
      });
    }

    res.status(200).json({
      success: true,
      requiresVerification: true,
      data: {
        certificateNumber: record.certificateNumber,
        requiresEmail: true,
      },
    });
  } catch (error) {
    console.error("Get Certificate Error:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

export const verifyCertificateAccess = async (req, res) => {
  const certificateNumber = req.params.certificateNumber || req.body.certificateNumber;
  const { email } = req.body;

  if (!certificateNumber || !String(certificateNumber).trim()) {
    return res.status(400).json({ success: false, message: "Certificate number is required." });
  }
  if (!email || !String(email).trim()) {
    return res.status(400).json({ success: false, message: "Email address is required." });
  }

  try {
    const record = await StudentCertificate.findOne({
      certificateNumber: { $regex: new RegExp(`^${String(certificateNumber).trim()}$`, "i") },
    }).lean();

    if (!record) {
      return res.status(404).json({ success: false, message: "Certificate not found with this ID." });
    }

    const studentEmail = (record.email || "").toLowerCase().trim();
    const inputEmail = String(email).toLowerCase().trim();

    if (studentEmail !== inputEmail) {
      return res.status(403).json({
        success: false,
        message: "Email address does not match this certificate record.",
      });
    }

    const origin = buildBackendOrigin(req);

    const allCerts = await StudentCertificate.find({
      email: { $regex: new RegExp(`^${studentEmail}$`, "i") },
    }).sort({ issuedDate: -1, createdAt: -1 }).lean();

    const formattedCertificates = allCerts.map((c) => ({
      ...c,
      pdfUrl: `${origin}/api/certificates/public/${encodeURIComponent(c.certificateNumber)}/download?email=${encodeURIComponent(c.email || "")}`,
      qrCodeUrl: `${origin}/api/certificate/qr`,
      verificationUrl: buildVerificationUrl(),
    }));

    const currentCert = formattedCertificates.find(
      (c) => c.certificateNumber.toLowerCase() === record.certificateNumber.toLowerCase()
    ) || formattedCertificates[0];

    return res.status(200).json({
      success: true,
      message: "Certificate verified successfully.",
      verified: true,
      data: currentCert,
      certificates: formattedCertificates,
    });
  } catch (error) {
    console.error("Verify Certificate Access Error:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

export const getCertificateQr = async (req, res) => {
  try {
    const buffer = await generateVerificationQrBuffer();
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');
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
    return res.status(400).json({ success: false, message: "An Excel file (.xlsx or .xls) is required." });
  }

  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(req.file.path);
    const sheet = workbook.worksheets[0];

    if (!sheet || sheet.rowCount === 0) {
      await fs.unlink(req.file.path).catch(() => {});
      return res.status(400).json({ success: false, message: "The uploaded Excel file contains no sheets or data." });
    }

    // 1. Find Header Row or detect columns
    let headerRowIdx = -1;
    const colMap = {};

    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (headerRowIdx !== -1) return;
      const values = row.values;
      if (!Array.isArray(values)) return;

      const rowTexts = values.map(extractCellValue).map((v) => (typeof v === "string" ? v.toLowerCase().replace(/[^a-z0-9]/g, "") : ""));
      const hasName = rowTexts.some((t) => t.includes("name") || t.includes("student") || t.includes("candidate"));
      const hasEmail = rowTexts.some((t) => t.includes("email") || t.includes("mail"));

      if (hasName || hasEmail) {
        headerRowIdx = rowNumber;
        values.forEach((cellVal, colIdx) => {
          const raw = String(extractCellValue(cellVal) || "").toLowerCase().replace(/[^a-z0-9]/g, "");
          if (!raw) return;
          if ((raw.includes("email") || raw.includes("mail")) && !colMap.email) {
            colMap.email = colIdx;
          } else if ((raw.includes("name") || raw.includes("student") || raw.includes("candidate")) && !colMap.studentName) {
            colMap.studentName = colIdx;
          } else if ((raw.includes("phone") || raw.includes("mobile") || raw.includes("contact")) && !colMap.phone) {
            colMap.phone = colIdx;
          } else if ((raw.includes("college") || raw.includes("university") || raw.includes("institute") || raw.includes("institution")) && !colMap.college) {
            colMap.college = colIdx;
          } else if ((raw.includes("course") || raw.includes("program") || raw.includes("training") || raw.includes("subject") || raw.includes("domain")) && !colMap.courseName) {
            colMap.courseName = colIdx;
          } else if ((raw.includes("duration") || raw.includes("period")) && !colMap.courseDuration) {
            colMap.courseDuration = colIdx;
          } else if ((raw.includes("completion") || raw.includes("enddate") || raw.includes("completed")) && !colMap.completionDate) {
            colMap.completionDate = colIdx;
          } else if ((raw.includes("issue") || raw.includes("date")) && !colMap.issuedDate) {
            colMap.issuedDate = colIdx;
          } else if ((raw.includes("grade") || raw.includes("score") || raw.includes("result") || raw.includes("marks")) && !colMap.grade) {
            colMap.grade = colIdx;
          } else if ((raw.includes("certificate") || raw.includes("certno") || raw.includes("certid")) && !colMap.certificateNumber) {
            colMap.certificateNumber = colIdx;
          }
        });
      }
    });

    const startRow = headerRowIdx === -1 ? 1 : headerRowIdx + 1;
    const year = new Date().getFullYear();
    const created = [];
    const skipped = [];

    // Pre-calculate starting sequence number for this year to make certificate numbers fast & sequential
    const prefix = `ICS-${year}-`;
    const existingCerts = await StudentCertificate.find(
      { certificateNumber: { $regex: new RegExp(`^ICS-${year}-\\d+$`) } },
      { certificateNumber: 1 }
    ).lean();
    let maxSeq = 0;
    for (const c of existingCerts) {
      if (c.certificateNumber) {
        const num = parseInt(c.certificateNumber.replace(prefix, ""), 10);
        if (!isNaN(num) && num > maxSeq) maxSeq = num;
      }
    }
    let seqCounter = maxSeq + 1;

    for (let r = startRow; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r);
      if (!row || !row.hasValues) continue;

      let studentName = "";
      let email = "";
      let phone = "";
      let college = "";
      let courseName = "";
      let courseDuration = "";
      let completionDate = null;
      let issuedDate = null;
      let grade = "";
      let customCertNum = "";

      if (headerRowIdx !== -1) {
        studentName = colMap.studentName ? extractCellValue(row.getCell(colMap.studentName).value) : "";
        email = colMap.email ? extractCellValue(row.getCell(colMap.email).value) : "";
        phone = colMap.phone ? extractCellValue(row.getCell(colMap.phone).value) : "";
        college = colMap.college ? extractCellValue(row.getCell(colMap.college).value) : "";
        courseName = colMap.courseName ? extractCellValue(row.getCell(colMap.courseName).value) : "";
        courseDuration = colMap.courseDuration ? extractCellValue(row.getCell(colMap.courseDuration).value) : "";
        completionDate = colMap.completionDate ? extractCellValue(row.getCell(colMap.completionDate).value) : null;
        issuedDate = colMap.issuedDate ? extractCellValue(row.getCell(colMap.issuedDate).value) : null;
        grade = colMap.grade ? extractCellValue(row.getCell(colMap.grade).value) : "";
        customCertNum = colMap.certificateNumber ? extractCellValue(row.getCell(colMap.certificateNumber).value) : "";
      }

      // Fallback: If values missing or no mapped header, scan row cells intelligently
      if (!studentName || !email) {
        const rowCells = [];
        row.eachCell({ includeEmpty: false }, (cell) => {
          rowCells.push(extractCellValue(cell.value));
        });

        for (const cellVal of rowCells) {
          const str = String(cellVal || "").trim();
          if (!email && isValidEmail(str)) {
            email = str;
          } else if (!studentName && str.length > 1 && !/^\d+$/.test(str) && !isValidEmail(str)) {
            studentName = str;
          } else if (!college && (str.toLowerCase().includes("college") || str.toLowerCase().includes("institute") || str.toLowerCase().includes("university"))) {
            college = str;
          }
        }
      }

      studentName = sanitizeText(studentName);
      email = sanitizeEmail(email);

      // Skip row if studentName or email is completely missing
      if (!studentName || !email) {
        skipped.push({ row: r, reason: "Missing student name or email", studentName, email });
        continue;
      }

      if (!isValidEmail(email)) {
        skipped.push({ row: r, reason: "Invalid email format", studentName, email });
        continue;
      }

      // Generate unique certificate number
      let certNumber = customCertNum ? sanitizeText(customCertNum) : "";
      if (!certNumber || (await StudentCertificate.exists({ certificateNumber: certNumber }))) {
        certNumber = buildCertificateNumberFromSequence(seqCounter++, year);
        while (await StudentCertificate.exists({ certificateNumber: certNumber })) {
          certNumber = buildCertificateNumberFromSequence(seqCounter++, year);
        }
      }

      const payload = {
        studentName,
        email,
        phone: sanitizeText(phone || ""),
        courseName: sanitizeText(courseName || req.body.courseName || "Professional Training Program"),
        courseDuration: sanitizeText(courseDuration || req.body.courseDuration || "4 Weeks"),
        college: sanitizeText(college || req.body.college || "Ikaisoft"),
        grade: sanitizeText(grade || "A"),
        completionDate: completionDate ? new Date(completionDate) : new Date(),
        issuedDate: issuedDate ? new Date(issuedDate) : new Date(),
        status: "Issued",
        certificateYear: year,
      };

      const artifacts = await generateCertificateArtifacts({
        studentName: payload.studentName,
        courseName: payload.courseName,
        college: payload.college,
        issuedDate: payload.issuedDate,
      }, certNumber);

      const certificate = await StudentCertificate.create({
        ...payload,
        certificateNumber: certNumber,
        verificationToken: generateVerificationToken(),
        qrCodeUrl: artifacts.qrCodeUrl,
        pdfUrl: artifacts.pdfUrl,
      });

      created.push(certificate);
    }

    // Clean up uploaded file
    await fs.unlink(req.file.path).catch(() => {});

    if (created.length === 0 && skipped.length > 0) {
      return res.status(400).json({
        success: false,
        message: `No valid records imported. Skipped ${skipped.length} row(s). Please verify the sheet contains student Name and Email.`,
        skipped,
      });
    }

    res.status(200).json({
      success: true,
      message: `Successfully imported ${created.length} certificate(s).${skipped.length ? ` (${skipped.length} row(s) skipped)` : ""}`,
      importedCount: created.length,
      skippedCount: skipped.length,
      data: created,
    });
  } catch (error) {
    if (req.file && req.file.path) await fs.unlink(req.file.path).catch(() => {});
    console.error("Bulk Import Certificates Error:", error);
    res.status(500).json({ success: false, message: "Server error while processing Excel file: " + error.message });
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
        qrCodeUrl: `${buildBackendOrigin(req)}/api/certificate/qr`,
        verificationUrl: buildVerificationUrl(),
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

        page.drawText(`Verification URL: ${buildVerificationUrl()}`, {
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

export const publicDownloadByCertificateNumber = async (req, res) => {
  const { certificateNumber } = req.params;
  const { email } = req.query;
  try {
    const certificate = await StudentCertificate.findOne({
      certificateNumber: { $regex: new RegExp(`^${String(certificateNumber).trim()}$`, "i") },
    });
    if (!certificate) return res.status(404).send("Certificate not found.");

    if (email && (certificate.email || "").toLowerCase().trim() !== String(email).toLowerCase().trim()) {
      return res.status(403).send("Email address does not match this certificate record.");
    }

    const filePath = toAbsolutePath(certificate.pdfUrl);
    if (!filePath) return res.status(404).send("PDF not found.");
    res.setHeader("Content-Type", "application/pdf");
    res.download(filePath, `${certificate.certificateNumber}.pdf`);
  } catch (error) {
    console.error("Public Download Error:", error);
    res.status(500).send("Server error.");
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
