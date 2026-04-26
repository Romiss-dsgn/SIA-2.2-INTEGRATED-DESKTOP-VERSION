import express from "express";
import axios from "axios";

const router = express.Router();

// TEST connection to Pharmacy System
router.get("/pharmacy-test", async (req, res) => {
    if (process.env.ENABLE_PHARMACY_API !== "true") {
        return res.json({ connected: false, message: "Integration disabled" });
    }

    try {
        await axios.get(`${process.env.PHARMACY_URL}/api/health`);
        res.json({ connected: true, message: "Connected to Pharmacy System" });
    } catch (err) {
        res.json({ connected: false, message: "Cannot reach Pharmacy System" });
    }
});

export default router;