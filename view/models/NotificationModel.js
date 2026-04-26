// =========================
// NOTIFICATION MODEL
// models/NotificationModel.js
// =========================
import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
  // Core fields
  notificationId: { 
    type: String, 
    required: true, 
    unique: true 
  },
  
  // Type of notification
  type: { 
    type: String, 
    required: true,
    enum: [
      "doctor_enter",           // Nurse: Doctor wants to enter
      "appointment_time_arrived", // Nurse: Appointment time is now
      "nurse_response",         // Doctor: Nurse responded (patient present/absent)
      "appointment_started",    // Doctor: Nurse permitted patient to enter
      "appointment_canceled",   // Doctor: Nurse canceled appointment
      "lab_request",            // Medtech: New lab request from doctor
      "lab_result_ready",       // Doctor: Lab result completed
      "reschedule"              // Doctor: Appointment rescheduled
    ]
  },
  
  // Recipients (who should see this notification)
  recipientRole: { 
    type: String, 
    required: true,
    enum: ["Nurse", "Doctor", "Medtech", "Admin"]
  },
  recipientId: { 
    type: String,  // Specific user ID (optional - if null, all users with that role see it)
    default: null 
  },
  
  // Sender info
  senderId: { type: String, required: true },
  senderName: { type: String, required: true },
  senderRole: { type: String, required: true },
  
  // Notification content
  title: { type: String, required: true },
  message: { type: String, required: true },
  
  // Related entities (for navigation/actions)
  appointmentId: { type: String, default: null },
  patientId: { type: String, default: null },
  patientName: { type: String, default: null },
  doctorId: { type: String, default: null },
  doctorName: { type: String, default: null },
  requestId: { type: String, default: null },
  
  // Additional data (flexible field for type-specific data)
  data: { 
    type: mongoose.Schema.Types.Mixed, 
    default: {} 
  },
  
  // Status
  status: { 
    type: String, 
    enum: ["unread", "read", "handled"],
    default: "unread" 
  },
  
  // Priority
  priority: {
    type: String,
    enum: ["low", "normal", "high", "urgent"],
    default: "normal"
  },
  
  // Timestamps
  createdAt: { type: Date, default: Date.now },
  readAt: { type: Date, default: null },
  handledAt: { type: Date, default: null },
  expiresAt: { type: Date, default: null } // Auto-delete after this date (optional)
}, {
  timestamps: true
});

// Indexes for performance
notificationSchema.index({ recipientRole: 1, status: 1, createdAt: -1 });
notificationSchema.index({ recipientId: 1, status: 1, createdAt: -1 });
notificationSchema.index({ appointmentId: 1 });
notificationSchema.index({ requestId: 1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

// Generate unique notification ID
async function generateNotificationId() {
  const count = await mongoose.model("Notification").countDocuments();
  const timestamp = Date.now().toString(36);
  return `N-${timestamp}-${(count + 1).toString(36).toUpperCase()}`;
}

// Static method to create notification
notificationSchema.statics.createNotification = async function(data) {
  const notificationId = await generateNotificationId();
  
  const notification = new this({
    notificationId,
    type: data.type,
    recipientRole: data.recipientRole,
    recipientId: data.recipientId || null,
    senderId: data.senderId,
    senderName: data.senderName,
    senderRole: data.senderRole,
    title: data.title,
    message: data.message,
    appointmentId: data.appointmentId || null,
    patientId: data.patientId || null,
    patientName: data.patientName || null,
    doctorId: data.doctorId || null,
    doctorName: data.doctorName || null,
    requestId: data.requestId || null,
    data: data.data || {},
    priority: data.priority || "normal",
    expiresAt: data.expiresAt || null
  });
  
  await notification.save();
  return notification;
};

// Mark as read
notificationSchema.methods.markAsRead = async function() {
  this.status = "read";
  this.readAt = new Date();
  await this.save();
  return this;
};

// Mark as handled
notificationSchema.methods.markAsHandled = async function() {
  this.status = "handled";
  this.handledAt = new Date();
  await this.save();
  return this;
};

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;