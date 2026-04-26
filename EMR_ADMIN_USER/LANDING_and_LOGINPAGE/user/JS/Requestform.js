const express = require("express");
const router = express.Router();
const { getDb } = require("../db");

// ✅ GET all requests — optional ?status= filter
router.get("/", async (req, res) => {
  try {
    const db = getDb();
    const query = {};

    if (req.query.status && req.query.status !== "all") {
      query.status = req.query.status;
    }

    const requests = await db
      .collection("requestForms")
      .find(query)
      .sort({ submittedAt: -1 })
      .toArray();

    res.json(requests);
  } catch (err) {
    console.error("Error fetching request forms:", err);
    res.status(500).json({ message: "Failed to fetch request forms" });
  }
});

// ✅ POST — save request (requestType REMOVED, uses only tests array)
router.post("/", async (req, res) => {
  try {
    const db = getDb();
    const {
      patientName, patientAge, patientSex, patientDOB, patientID,
      contactNumber, tests, priority, requestedDate,
      referringDoctor, submittedBy, notes,
    } = req.body;

    if (!patientName || !priority) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    if (!Array.isArray(tests) || tests.length === 0) {
      return res.status(400).json({ message: "Please select at least one laboratory test." });
    }

    const now = new Date();
    const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
    const count = await db.collection("requestForms").countDocuments();
    const requestId = `RF-${datePart}-${String(count + 1).padStart(4, "0")}`;

    const newRequest = {
      requestId,
      patientName,
      patientAge:      patientAge      || null,
      patientSex:      patientSex      || null,
      patientDOB:      patientDOB      || null,
      patientID:       patientID       || null,
      contactNumber:   contactNumber   || null,
      // ❌ requestType REMOVED - use tests array instead
      tests,                                        // ✅ Array of specific tests (e.g., ["CBC", "X-Ray"])
      priority,
      requestedDate:   requestedDate   || null,
      referringDoctor: referringDoctor || null,
      submittedBy:     submittedBy     || null,
      notes:           notes           || null,
      status:          "Pending",
      submittedAt:     now,
    };

    await db.collection("requestForms").insertOne(newRequest);

    res.status(201).json({ message: "Request submitted successfully.", requestId });
  } catch (err) {
    console.error("Error submitting request form:", err);
    res.status(500).json({ message: "Failed to submit request." });
  }
});

// ✅ GET single request by requestId
router.get("/:requestId", async (req, res) => {
  try {
    const db = getDb();
    const request = await db
      .collection("requestForms")
      .findOne({ requestId: req.params.requestId });
    if (!request) return res.status(404).json({ message: "Request not found." });
    res.json(request);
  } catch (err) {
    console.error("Error fetching request:", err);
    res.status(500).json({ message: "Failed to fetch request." });
  }
});

// ✅ PUT — update status
router.put("/:requestId/status", async (req, res) => {
  try {
    const db = getDb();
    const { status } = req.body;
    const result = await db.collection("requestForms").updateOne(
      { requestId: req.params.requestId },
      { $set: { status, updatedAt: new Date() } }
    );
    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "Request not found." });
    }
    res.json({ message: "Status updated." });
  } catch (err) {
    console.error("Error updating status:", err);
    res.status(500).json({ message: "Failed to update status." });
  }
});

module.exports = router;