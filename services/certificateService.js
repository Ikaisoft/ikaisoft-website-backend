import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import qrcode from "qrcode";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { v4 as uuidv4 } from "uuid";
import puppeteer from "puppeteer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, "../uploads/certificates");

await fs.mkdir(uploadsDir, { recursive: true });

export function buildCertificateNumberFromSequence(sequence, year = new Date().getFullYear()) {
  return `IKA-${year}-${String(sequence).padStart(6, "0")}`;
}

export function buildVerificationUrl(certificateNumber) {
  const base = process.env.VERIFY_BASE_URL || process.env.BACKEND_ORIGIN || (process.env.NODE_ENV === 'development' ? 'http://localhost:5000' : 'https://ikaisoft.com');
  return `${base.replace(/\/$/, "")}/certificate?id=${encodeURIComponent(certificateNumber)}`;
}

export function generateVerificationToken() {
  return uuidv4();
}

export async function generateVerificationQrBuffer(certificateNumber) {
  const url = buildVerificationUrl(certificateNumber);
  return qrcode.toBuffer(url, { type: "png", margin: 1, width: 220 });
}

function sanitizeFileName(value) {
  return String(value || "certificate")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "certificate";
}

function getStoragePath(fileUrl) {
  if (!fileUrl || fileUrl.startsWith("http")) return null;
  return path.resolve(__dirname, "..", fileUrl.replace(/^\/+/, ""));
}

export async function deleteUploadIfExists(fileUrl) {
  const storagePath = getStoragePath(fileUrl);
  if (!storagePath) return;
  try {
    await fs.unlink(storagePath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("Delete upload error:", error.message);
    }
  }
}

async function createPdfWithPuppeteer(html, outputPath) {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });
  const pdfBuffer = await page.pdf({ format: "A4", printBackground: true });
  await browser.close();
  await fs.writeFile(outputPath, pdfBuffer);
  return pdfBuffer;
}

async function createPdfWithPdfLib(student, certificateNumber, qrBuffer, outputPath) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([1400, 900]);
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const qrImage = await pdfDoc.embedPng(qrBuffer);

  page.drawRectangle({ x: 40, y: 40, width: 1320, height: 820, borderColor: rgb(0.14, 0.37, 0.24), borderWidth: 3 });
  page.drawRectangle({ x: 70, y: 70, width: 1260, height: 760, borderColor: rgb(0.76, 0.88, 0.82), borderWidth: 2 });

  page.drawText("Certificate of Completion", {
    x: 140,
    y: 760,
    size: 32,
    font,
    color: rgb(0.13, 0.34, 0.2),
  });
  page.drawText("Ikaisoft", {
    x: 1100,
    y: 760,
    size: 20,
    font: regularFont,
    color: rgb(0.33, 0.33, 0.33),
  });

  page.drawText("This is to certify that", {
    x: 140,
    y: 650,
    size: 20,
    font: regularFont,
    color: rgb(0.25, 0.25, 0.25),
  });
  page.drawText(student.studentName || "Student Name", {
    x: 140,
    y: 590,
    size: 34,
    font,
    color: rgb(0.12, 0.12, 0.12),
  });

  page.drawText(`has successfully completed the course ${student.courseName || "Course"}.`, {
    x: 140,
    y: 520,
    size: 20,
    font: regularFont,
    color: rgb(0.25, 0.25, 0.25),
  });

  page.drawText(`College: ${student.college || "N/A"}`, {
    x: 140,
    y: 470,
    size: 18,
    font: regularFont,
    color: rgb(0.3, 0.3, 0.3),
  });
  page.drawText(`Issue Date: ${new Date(student.issuedDate || Date.now()).toLocaleDateString()}`, {
    x: 140,
    y: 430,
    size: 18,
    font: regularFont,
    color: rgb(0.3, 0.3, 0.3),
  });
  page.drawText(`Certificate Number: ${certificateNumber}`, {
    x: 140,
    y: 390,
    size: 18,
    font: regularFont,
    color: rgb(0.3, 0.3, 0.3),
  });

  page.drawText("Digital Signature", {
    x: 140,
    y: 180,
    size: 18,
    font: regularFont,
    color: rgb(0.35, 0.35, 0.35),
  });
  page.drawLine({ start: { x: 140, y: 165 }, end: { x: 330, y: 165 }, color: rgb(0.35, 0.35, 0.35), thickness: 1.5 });
  page.drawText("Director, Ikaisoft", {
    x: 140,
    y: 140,
    size: 16,
    font: regularFont,
    color: rgb(0.25, 0.25, 0.25),
  });
  page.drawImage(qrImage, { x: 1100, y: 150, width: 120, height: 120 });

  const pdfBytes = await pdfDoc.save();
  await fs.writeFile(outputPath, pdfBytes);
  return pdfBytes;
}

export async function generateCertificateArtifacts(student, certificateNumber) {
  const qrUrl = buildVerificationUrl(certificateNumber);
  const qrBuffer = await qrcode.toBuffer(qrUrl, { type: "png", margin: 1, width: 220 });
  const safeName = sanitizeFileName(student.studentName || "student");
  const fileName = `${safeName}-${certificateNumber.toLowerCase()}`;

  const pdfPath = path.join(uploadsDir, `${fileName}.pdf`);
  const qrPath = path.join(uploadsDir, `${fileName}.png`);

  const qrDataUrl = `data:image/png;base64,${qrBuffer.toString("base64")}`;

  try {
    const html = `<!doctype html><html><head><meta charset="utf-8"/><style>body{font-family:Arial,sans-serif;padding:40px;background:#f8fafc} .card{border:2px solid #1f6f3f;padding:24px;border-radius:16px;background:white;position:relative} h1{color:#1f6f3f} .meta{margin-top:20px;color:#334155}.qr{position:absolute;right:24px;top:24px}</style></head><body><div class="card"><div class="qr"><img src="${qrDataUrl}" width="160" height="160" alt="QR"></div><h1>Certificate of Completion</h1><p>This is to certify that <strong>${student.studentName}</strong></p><p>has completed the course <strong>${student.courseName}</strong>.</p><div class="meta">College: ${student.college || "N/A"}</div><div class="meta">Certificate Number: ${certificateNumber}</div><div class="meta">Issue Date: ${new Date(student.issuedDate || Date.now()).toLocaleDateString()}</div><p style="margin-top:24px;font-size:12px;color:#666">Verify at: ${qrUrl}</p></div></body></html>`;
    await createPdfWithPuppeteer(html, pdfPath);
  } catch (error) {
    console.warn("Puppeteer PDF fallback used:", error.message);
    await createPdfWithPdfLib(student, certificateNumber, qrBuffer, pdfPath);
  }

  await fs.writeFile(qrPath, qrBuffer);

  return {
    qrCodeUrl: `/uploads/certificates/${path.basename(qrPath)}`,
    pdfUrl: `/uploads/certificates/${path.basename(pdfPath)}`,
  };
}
