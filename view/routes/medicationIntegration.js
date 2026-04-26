import express from "express";
import fetch from "node-fetch"; // or native fetch in Node 18+
import Medication from "../models/MedicineModel.js"; // Your Medicine model
import Patient from "../models/PatientModel.js"; // Assuming you have a Patient model

const router = express.Router();

/**
 * POST /api/medication-integration/:patientId
 * Save medications and send to Pharmacy system
 */
router.post("/:patientId", async (req, res) => {
  const { patientId } = req.params;
  const { medications } = req.body;

  if (!medications || !Array.isArray(medications) || medications.length === 0) {
    return res.status(400).json({ message: "No medications provided" });
  }

  try {
    // -----------------------------
    // 1️⃣ Save Medications in EMR DB
    // -----------------------------
    const savedMeds = [];
    for (const med of medications) {
      const newMed = new Medication({
        patientId,
        medicname: med.medicname,
        dosage: med.dosage,
        frequency: med.frequency,
        quantity: med.quantity,
        presby: med.presby || "Unknown",
        presNotes: med.presNotes || ""
      });
      await newMed.save();
      savedMeds.push(newMed);
    }

    // -----------------------------
    // 2️⃣ Send prescription to Pharmacy system
    // -----------------------------
    // Build payload
    const prescriberId = req.headers["x-user-id"] || "EMR-Doctor-Unknown"; // optional dynamic
    const pharmacyPayload = {
      emrPrescriptionId: `EMR-${Date.now()}`,
      patientId,
      prescriberId,
      medicines: medications.map(m => ({
        medicineName: m.medicname,
        dosage: m.dosage,
        quantityToDispense: m.quantity,
        frequency: m.frequency
      }))
    };

    const pharmacyRes = await fetch("http://localhost:5001/api/emr/prescriptions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer EMRAccessKey123"
      },
      body: JSON.stringify(pharmacyPayload)
    });

    if (!pharmacyRes.ok) {
      const text = await pharmacyRes.text();
      console.error("Pharmacy API error:", text);
      return res.status(500).json({ message: "Pharmacy API rejected request", details: text });
    }

    const pharmacyData = await pharmacyRes.json();

    res.status(200).json({
      message: "Medications saved and sent to Pharmacy successfully",
      medications: savedMeds,
      pharmacyData
    });

  } catch (err) {
    console.error("Medication Integration Error:", err);
    res.status(500).json({ message: "Internal server error", error: err.message });
  }
});

export default router;