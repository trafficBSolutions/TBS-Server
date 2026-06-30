const express = require("express");
const router = express.Router();
const { sendFollowUpEmails } = require("../controllers/followUpController");

// POST /send-followup-emails
// Sends a one-time follow-up email to all applicants who haven't received one yet.
router.post("/send-followup-emails", sendFollowUpEmails);

module.exports = router;
