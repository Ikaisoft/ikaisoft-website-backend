import mongoose from "mongoose";

const enrollSchema = new mongoose.Schema({
  name: String,
  email: String,
  phone: String,
  course: String,
  message: String,
}, { timestamps: true });

const Enroll = mongoose.model("Enroll", enrollSchema);

export default Enroll;