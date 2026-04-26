import express from "express";
import fetch from "node-fetch";

const router = express.Router();

// Helper to safely build URLs from env vars
function safeBuildUrl(envVarName, path) {
  const base = process.env[envVarName];
  if (!base) return null;
  try {
    return new URL(path, base).toString();
  } catch (err) {
    console.warn(`Invalid URL in env ${envVarName}:`, base);
    return null;
  }
}

// Simulate DB storage for toggle status (replace with your real DB)
let integrationStatus = {
  emr: false,
  billing: false,
  pharmacy: false
};

// GET current integration status
router.get("/status", (req, res) => {
  res.json(integrationStatus);
});

// POST update integration status
router.post("/status", (req, res) => {
  const { emr, billing, pharmacy } = req.body;
  integrationStatus.emr = !!emr;
  integrationStatus.billing = !!billing;
  integrationStatus.pharmacy = !!pharmacy;

  console.log("Updated integration status:", integrationStatus);
  res.json({ success: true, integrationStatus });
});

// GET test integration (check EMR, Billing & Pharmacy API)
router.get("/test", async (req, res) => {
  const results = {};
  
  // Test EMR API
  if (integrationStatus.emr) {
    try {
      const emrUrl = safeBuildUrl('EMR_URL', '/api/test');
      if (!emrUrl) {
        results.emr = { success: false, message: 'EMR_URL not set or invalid' };
      } else {
        const emrRes = await fetch(emrUrl, { headers: { "x-api-key": process.env.EMR_API_KEY } });
        const data = await emrRes.json();
        results.emr = { success: true, response: data };
      }
    } catch (err) {
      results.emr = { success: false, error: err.message };
    }
  } else {
    results.emr = { success: false, message: "EMR API disabled" };
  }

  // Test Billing API
  if (integrationStatus.billing) {
    try {
      const billingUrl = safeBuildUrl('BILLING_URL', '/api/test');
      if (!billingUrl) {
        results.billing = { success: false, message: 'BILLING_URL not set or invalid' };
      } else {
        const billingRes = await fetch(billingUrl, { headers: { "x-api-key": process.env.BILLING_API_KEY } });
        const data = await billingRes.json();
        results.billing = { success: true, response: data };
      }
    } catch (err) {
      results.billing = { success: false, error: err.message };
    }
  } else {
    results.billing = { success: false, message: "Billing API disabled" };
  }

  // Test Pharmacy API
  if (integrationStatus.pharmacy) {
    try {
      const pharmacyUrl = safeBuildUrl('PHARMACY_URL', '/api/test');
      if (!pharmacyUrl) {
        results.pharmacy = { success: false, message: 'PHARMACY_URL not set or invalid' };
      } else {
        const pharmacyRes = await fetch(pharmacyUrl, { headers: { "x-api-key": process.env.PHARMACY_API_KEY } });
        const data = await pharmacyRes.json();
        results.pharmacy = { success: true, response: data };
      }
    } catch (err) {
      results.pharmacy = { success: false, error: err.message };
    }
  } else {
    results.pharmacy = { success: false, message: "Pharmacy API disabled" };
  }

  res.json(results);
});

export default router;