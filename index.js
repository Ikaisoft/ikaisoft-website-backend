import express from "express";
import path from "path";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import contactRoutes from "./routes/contactRoutes.js";
import enrollRoutes from "./routes/enrollRoutes.js";
import registrationRoutes from "./routes/registrationRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import jobRoutes from "./routes/jobRoutes.js";
import courseRoutes from "./routes/courseRoutes.js";
import certificateRoutes from "./routes/certificateRoutes.js";
import { publicVerifyCertificate } from "./controller/certificateController.js";
import seedAdmin from "./config/seedAdmin.js";

dotenv.config();

const app = express();

// Middleware
app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://localhost:8080",
    "https://ikaisoft.com",
    "https://www.ikaisoft.com"
  ],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// DB Connection
connectDB().then(() => {
  seedAdmin();
});

// Routes
app.use("/api", contactRoutes);
app.use("/api", enrollRoutes);
app.use("/api", registrationRoutes);
app.use("/api", adminRoutes);
app.use("/api", jobRoutes);
app.use("/api", courseRoutes);
app.use("/api", certificateRoutes);

// Public verification page (used by QR links)
app.get('/verify/:certificateNumber', publicVerifyCertificate);

// Server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} 🚀`);
});