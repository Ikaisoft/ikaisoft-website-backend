import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import upload from "../middleware/uploadMiddleware.js";
import {
  getColleges,
  createCollege,
  updateCollege,
  deleteCollege,
  getCertificates,
  createCertificate,
  updateCertificate,
  deleteCertificate,
  verifyCertificate,
  getCertificateByNumber,
  publicVerifyCertificate,
  publicDownloadByCertificateNumber,
  bulkImportCertificates,
  exportCertificates,
  downloadCertificatePdf,
  downloadAllCertificatesZip,
  regenerateCertificate,
  regenerateQr,
} from "../controller/certificateController.js";

const router = express.Router();

router.get("/certificate/verify/:certificateNumber", verifyCertificate);
router.get("/certificate/:certificateNumber", getCertificateByNumber);
// Public read-only verification route (accessible without auth)
router.get("/verify/:certificateNumber", publicVerifyCertificate);
// Public PDF download by certificate number
router.get('/certificates/public/:certificateNumber/download', publicDownloadByCertificateNumber);

router.get("/certificates", authMiddleware, getCertificates);
router.post("/certificates", authMiddleware, createCertificate);
router.put("/certificates/:id", authMiddleware, updateCertificate);
router.delete("/certificates/:id", authMiddleware, deleteCertificate);
router.get("/certificates/:id/download", authMiddleware, downloadCertificatePdf);
router.post("/certificates/:id/regenerate", authMiddleware, regenerateCertificate);
router.post("/certificates/:id/qr", authMiddleware, regenerateQr);
router.post("/certificates/import", authMiddleware, upload.single("file"), bulkImportCertificates);
router.get("/certificates/export", authMiddleware, exportCertificates);
router.get("/certificates/download-all", authMiddleware, downloadAllCertificatesZip);

router.get("/colleges", authMiddleware, getColleges);
router.post("/colleges", authMiddleware, upload.single("logo"), createCollege);
router.put("/colleges/:id", authMiddleware, upload.single("logo"), updateCollege);
router.delete("/colleges/:id", authMiddleware, deleteCollege);

export default router;
