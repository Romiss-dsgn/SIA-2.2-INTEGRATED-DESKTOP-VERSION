const express = require('express');
const router = express.Router();

// 1. GET all requests
router.get("/", async (req, res) => {
  try {
    const db = getDb();
    const query = {};

    if (req.query.status && req.query.status !== "all") {
      query.status = req.query.status;
    }

    const requests = await db
      .collection("requestforms") // Updated to lowercase
      .find(query)
      .sort({ submittedAt: -1 })
      .toArray();

    res.json(requests);
  } catch (err) {
    console.error("Error fetching request forms:", err);
    res.status(500).json({ message: "Failed to fetch request forms" });
  }
});

// 2. MIGRATION ROUTE (Placed BEFORE :requestId)
router.get("/migrate", async (req, res) => {
  try {
    const db = getDb();
    
    const result = await db.collection("requestforms").updateMany( // Updated to lowercase
      { tests: { $exists: false } }, 
      { 
        $set: { 
          tests: [], 
          patientAge: null, 
          patientSex: null 
        } 
      }
    );

    res.json({
      message: `✅ Migration complete. Updated ${result.modifiedCount} records.`,
      modifiedCount: result.modifiedCount,
    });
  } catch (err) {
    console.error("❌ Migration error:", err);
    res.status(500).json({ message: "Migration failed: " + err.message });
  }
});

// 3. POST - submit a new request
router.post("/", async (req, res) => {
  try {
    const db = getDb();
    const {
      patientName,
      patientAge,
      patientSex,
      patientDOB,
      patientID,
      contactNumber,
      tests,
      priority,
      requestedDate,
      referringDoctor,
      submittedBy,
      notes,
    } = req.body;

    if (!patientName || !priority) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    const now = new Date();
    const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
    const count = await db.collection("requestforms").countDocuments(); // Updated to lowercase
    const requestId = `RF-${datePart}-${String(count + 1).padStart(4, "0")}`;

    const newRequest = {
      requestId,
      patientName,
      patientAge: patientAge || null,
      patientSex: patientSex || null,
      patientDOB: patientDOB || null,
      patientID: patientID || null,
      contactNumber: contactNumber || null,
      tests: Array.isArray(tests) ? tests : [], 
      priority,
      requestedDate: requestedDate || null,
      referringDoctor: referringDoctor || null,
      submittedBy: submittedBy || null,
      notes: notes || null,
      status: "Pending",
      submittedAt: now,
    };

    await db.collection("requestforms").insertOne(newRequest); // Updated to lowercase

    res.status(201).json({
      message: "Request submitted successfully.",
      requestId,
    });
  } catch (err) {
    console.error("Error submitting request form:", err);
    res.status(500).json({ message: "Failed to submit request." });
  }
});

// 4. GET single request by ID
router.get("/:requestId", async (req, res) => {
  try {
    const db = getDb();
    const request = await db
      .collection("requestforms") // Updated to lowercase
      .findOne({ requestId: req.params.requestId });
    
    if (!request) return res.status(404).json({ message: "Request not found." });
    res.json(request);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch request." });
  }
});

// 5. PUT - update request status
router.put("/:requestId/status", async (req, res) => {
  try {
    const db = getDb();
    const { status } = req.body;
    const result = await db.collection("requestforms").updateOne( // Updated to lowercase
      { requestId: req.params.requestId },
      { $set: { status, updatedAt: new Date() } }
    );
    
    if (result.matchedCount === 0) return res.status(404).json({ message: "Request not found." });
    res.json({ message: "Status updated." });
  } catch (err) {
    res.status(500).json({ message: "Failed to update status." });
  }
});

module.exports = router;