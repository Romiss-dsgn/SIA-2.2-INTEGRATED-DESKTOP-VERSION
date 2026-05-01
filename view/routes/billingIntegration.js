import express from "express";
import fs from "fs";
import axios from "axios";
import mongoose from "mongoose";

const router = express.Router();

// ✅ Create a separate connection to Billing System's MongoDB Atlas database
let billingConnection = null;
let BillingService = null;

async function getBillingConnection() {
  // If connection already exists and is ready, return it
  if (billingConnection && billingConnection.readyState === 1) {
    return billingConnection;
  }

  // Get billing MongoDB URI from environment variable
  const billingMongoUri = process.env.BILLING_MONGO_URI || process.env.BILLING_MONGODB_URI;
  
  if (!billingMongoUri) {
    console.warn("⚠️ BILLING_MONGO_URI not configured. Cannot connect to Billing database directly.");
    return null;
  }

  try {
    // Create a new connection to billing database (separate from EMR's connection)
    // Removed deprecated options: useNewUrlParser and useUnifiedTopology (not needed in MongoDB Driver 4.0.0+)
    billingConnection = await mongoose.createConnection(billingMongoUri);

    // Wait for connection to be ready before accessing database
    await new Promise((resolve, reject) => {
      if (billingConnection.readyState === 1) {
        resolve();
      } else {
        billingConnection.once('connected', resolve);
        billingConnection.once('error', reject);
      }
    });

    // Ensure we're using the BILLING database
    // If connection string doesn't include database name, switch to BILLING
    let db = billingConnection.db;
    
    // Check if db is available and get database name safely
    let dbName = null;
    if (db && db.databaseName) {
      dbName = db.databaseName;
    }
    
    // If database name is not BILLING, switch to it
    if (!dbName || dbName.toUpperCase() !== 'BILLING') {
      db = billingConnection.useDb('BILLING');
      console.log(`📝 Using BILLING database${dbName ? ` (was: ${dbName})` : ''}`);
    }

    // Define Billing Service schema (matching actual billing system structure)
    // Based on example: { service, name, price, unit }
    const billingServiceSchema = new mongoose.Schema(
      {
        service: { type: String, required: true },
        name: { type: String, required: true },
        price: { type: Number, required: true },
        unit: { type: String, default: "unit" },
        code: { type: String }, // Optional field (may not exist in all documents)
        isActive: { type: Boolean } // Optional field (may not exist in all documents)
      },
      { 
        timestamps: false, // Disable timestamps (not in actual documents)
        versionKey: false
      }
    );

    // Create model with explicit collection name "services" (lowercase)
    // The third parameter forces Mongoose to use "services" instead of "Services"
    BillingService = db.model('Service', billingServiceSchema, 'services');

    const finalDbName = db.databaseName || 'BILLING';
    console.log(`✅ Connected to Billing MongoDB Atlas (Database: ${finalDbName}, Collection: services)`);
    return billingConnection;
  } catch (err) {
    console.error("❌ Failed to connect to Billing database:", err.message);
    return null;
  }
}

// ------------------------------
// GET current billing integration status
// ------------------------------
router.get("/billing", (req, res) => {
  const enabled = process.env.ENABLE_BILLING_API === "true";
  res.json({ enabled });
});

// ------------------------------
// UPDATE billing integration toggle
// ------------------------------
router.post("/billing", (req, res) => {
  const { enabled } = req.body;

  // Replace value inside .env
  let envText = fs.readFileSync(".env", "utf8");
  
  if (envText.includes("ENABLE_BILLING_API=")) {
    envText = envText.replace(/ENABLE_BILLING_API=.*/g, `ENABLE_BILLING_API=${enabled}`);
  } else {
    envText += `\nENABLE_BILLING_API=${enabled}`;
  }

  fs.writeFileSync(".env", envText);

  // Update runtime
  process.env.ENABLE_BILLING_API = String(enabled);

  res.json({ success: true, enabled });
});

// ------------------------------
// Send patient billing info to Billing System
// ------------------------------
router.post("/billing/send", async (req, res) => {
  if (process.env.ENABLE_BILLING_API !== "true") {
    return res.status(400).json({ success: false, message: "Billing integration is disabled" });
  }

  const { patientId, patientName, services, totalAmount } = req.body;

  if (!patientId || !services || !totalAmount) {
    return res.status(400).json({ success: false, message: "Missing required billing data" });
  }

  try {
    const response = await axios.post(
      `${process.env.BILLING_URL}/api/emr-billing`,
      { patientId, patientName, services, totalAmount },
      { headers: { "Authorization": `Bearer ${process.env.BILLING_API_KEY}` } }
    );

    res.json({ success: true, message: "Billing data sent successfully", billingResponse: response.data });
  } catch (err) {
    console.error("Failed to send billing data:", err.message || err);
    res.status(500).json({ success: false, message: "Failed to send billing data" });
  }
});

// ------------------------------
// GET services from Billing System MongoDB Atlas (direct connection)
// ------------------------------
router.get("/billing/services", async (req, res) => {
  const search = req.query.search || "";

  try {
    // Get billing connection
    const conn = await getBillingConnection();
    
    if (!conn || !BillingService) {
      console.warn('⚠️ Billing DB connection unavailable - returning fallback service list');

      // Fallback: return a small set of common services so the UI can continue to function.
      const fallbackServices = [
        { service: 'General Consultation', name: 'Consultation Services', price: 0, unit: 'service', code: 'CONSULT' },
        { service: 'Follow-up Consultation', name: 'Consultation Services', price: 0, unit: 'service', code: 'FUP' },
        { service: 'Basic Lab Panel', name: 'Laboratory', price: 250.00, unit: 'package', code: 'LAB-BASIC' },
        { service: 'Chest X-Ray', name: 'Radiology', price: 500.00, unit: 'service', code: 'CXR' }
      ];

      return res.json({ success: true, data: fallbackServices, fallback: true, message: 'Using fallback services (billing DB unavailable)' });
    }

    // Query billing's services collection directly
    // Build query - only filter by isActive if the field exists
    const query = {};
    
    // Only add isActive filter if documents have this field (optional)
    // For now, we'll get all services since the example doesn't show isActive
    // If you want to filter by isActive, uncomment the line below:
    // query.isActive = { $ne: false }; // Get all services where isActive is not false

    if (search) {
      query.$or = [
        { service: { $regex: search, $options: "i" } },
        { name: { $regex: search, $options: "i" } }
      ];
      
      // Only search by code if it exists in documents
      // If code field exists, add it to the search
      // query.$or.push({ code: { $regex: search, $options: "i" } });
    }

    const services = await BillingService.find(query)
      .select("service name price unit")
      .sort({ name: 1, service: 1 })
      .limit(50)
      .lean(); // Use lean() for better performance

    console.log(`✅ Found ${services.length} services from Billing database (direct connection)`);
    res.json({ success: true, data: services });
  } catch (err) {
    console.error("❌ Billing database search error:", err);
    res.status(500).json({ 
      success: false, 
      message: "Billing database search failed", 
      error: err.message 
    });
  }
});

export default router;