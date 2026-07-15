import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import contactRoutes from "./routes/contactRoutes.js";
import enrollRoutes from "./routes/enrollRoutes.js";
import registrationRoutes from "./routes/registrationRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import jobRoutes from "./routes/jobRoutes.js";
import courseRoutes from "./routes/courseRoutes.js";
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

// Server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} 🚀`);
});