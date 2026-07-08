import express from "express";
import sendRegistrationMail  from "../controller/registrationController.js";
const router = express.Router();

router.post("/registration", sendRegistrationMail);

export default router;