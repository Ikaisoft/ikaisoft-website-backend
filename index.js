import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import contactRoutes from "./routes/contactRoutes.js";

dotenv.config();

const app = express();

// Middleware
app.use(cors({
  origin: [
    "http://localhost:5173",
    " http://localhost:8080",
    "https://ikaisoft.com"
  ],
  methods:["POST"],
  credentials: true,
}));
app.use(express.json());

// DB Connection
connectDB();

// Routes
app.use("/api", contactRoutes);

// Server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} 🚀`);
});