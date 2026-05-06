import express from "express";
import sendEnrollForm from "../controller/enrollController.js";

const router = express.Router();

router.post("/enroll", sendEnrollForm);

export default router;