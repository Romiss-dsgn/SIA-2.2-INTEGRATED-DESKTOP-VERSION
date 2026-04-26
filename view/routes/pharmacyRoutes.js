import express from "express";
import mongoose from "mongoose";
import Medicine from "../models/MedicineModel.js"; // EMR local medicine model

const router = express.Router();

// ✅ Create a separate connection to Pharmacy's MongoDB Atlas database
let pharmacyConnection = null;
let PharmacyMedicine = null;

async function getPharmacyConnection() {
  // If connection already exists and is ready, return it
  if (pharmacyConnection && pharmacyConnection.readyState === 1) {
    return pharmacyConnection;
  }

  // Get pharmacy MongoDB URI from environment variable
  const pharmacyMongoUri = process.env.PHARMACY_MONGO_URI || process.env.PHARMACY_DB_URI;
  
  if (!pharmacyMongoUri) {
    console.warn("⚠️ PHARMACY_MONGO_URI not configured. Cannot connect to Pharmacy database directly.");
    return null;
  }

  try {
    // Create a new connection to pharmacy database (separate from EMR's connection)
    pharmacyConnection = await mongoose.createConnection(pharmacyMongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    // Define Pharmacy Medicine schema (matching pharmacy system)
    const pharmacyMedicineSchema = new mongoose.Schema(
      {
        name: { type: String, required: true },
        genericName: String,
        type: { type: String, required: true },
        strength: String,
        manufacturer: mongoose.Schema.Types.ObjectId,
        requiresPrescription: { type: Boolean, default: false },
      },
      { timestamps: true, versionKey: false }
    );

    // Create model on pharmacy connection
    PharmacyMedicine = pharmacyConnection.model('Medicine', pharmacyMedicineSchema);

    console.log("✅ Connected to Pharmacy MongoDB Atlas database directly");
    return pharmacyConnection;
  } catch (err) {
    console.error("❌ Failed to connect to Pharmacy database:", err.message);
    return null;
  }
}

// ✅ Route to search medicines from Pharmacy's MongoDB Atlas (direct connection)
router.get("/pharmacy-medicines", async (req, res) => {
  const search = req.query.search || "";

  try {
    // Get pharmacy connection
    const conn = await getPharmacyConnection();
    
    if (!conn || !PharmacyMedicine) {
      return res.status(503).json({ 
        message: "Pharmacy database connection unavailable",
        error: "PHARMACY_MONGO_URI not configured or connection failed"
      });
    }

    // Query pharmacy's Medicine collection directly
    const meds = await PharmacyMedicine.find({
      name: { $regex: search, $options: "i" }
    })
      .select("name strength type requiresPrescription")
      .limit(20)
      .lean(); // Use lean() for better performance

    console.log(`✅ Found ${meds.length} medicines from Pharmacy database (direct connection)`);
    res.json(meds);
  } catch (err) {
    console.error("❌ Pharmacy database search error:", err);
    res.status(500).json({ message: "Pharmacy database search failed", error: err.message });
  }
});

// ✅ Route to search medicines from EMR local database (fallback)
router.get("/medicines", async (req, res) => {
  const q = req.query.search || "";

  try {
    const meds = await Medicine.find({
      name: { $regex: q, $options: "i" }
    })
    .limit(20)
    .select("name strength type requiresPrescription");

    res.json(meds);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Search failed" });
  }
});

export default router;