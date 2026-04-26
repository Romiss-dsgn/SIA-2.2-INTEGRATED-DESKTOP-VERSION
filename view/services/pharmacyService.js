import axios from "axios";

export async function sendToPharmacy(data) {
    if (process.env.ENABLE_PHARMACY_API !== "true") {
        console.log("Pharmacy API DISABLED — skipping.");
        return { status: "pharmacy_disabled" };
    }

    try {
        const res = await axios.post(
            `${process.env.PHARMACY_URL}/api/prescriptions`,
            data,
            {
                headers: {
                    "x-api-key": process.env.PHARMACY_API_KEY
                }
            }
        );

        return res.data;
    } catch (err) {
        return { error: err.message };
    }
}