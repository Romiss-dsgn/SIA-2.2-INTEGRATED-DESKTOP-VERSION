import mongoose from "mongoose";

const appointmentSchema = new mongoose.Schema({
  patient: { type: mongoose.Schema.Types.ObjectId, ref: "PatientModel", required: true },
  doctor: { type: mongoose.Schema.Types.ObjectId, ref: "UserModel", required: true },
  date: { type: Date, required: true },
  status: { type: String, default: "scheduled" },
}, { timestamps: true });

const AppointmentModel = mongoose.models.AppointmentModel || mongoose.model("AppointmentModel", appointmentSchema);

export default AppointmentModel;