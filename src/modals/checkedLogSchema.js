import mongoose from "mongoose";

// --- Individual check log (for one timestamp) ---
const ipPortSingleLogSchema = new mongoose.Schema({
  checkedAt: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ["online", "offline"], // ✅ Only two statuses
    default: "offline",
  },
  responseTime: { type: Number, default: null },
  comment: { type: String, trim: true, default: "" },
});

// --- Auto-generate readable comment before saving ---
ipPortSingleLogSchema.pre("save", function (next) {
  if (!this.comment) {
    this.comment =
      this.status === "online"
        ? "Active / Running"
        : "Server is offline / unreachable";
  }
  next();
});

// --- Log document for each entry ---
const ipPortEntryLogSchema = new mongoose.Schema(
  {
    entryId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "IPPortConfig",
      unique: true, // ✅ 1 log doc per entry
    },
    ip: { type: String, required: true },
    port: { type: String, required: true },
    referPortName: { type: String, default: "custom" },
    logs: { type: [ipPortSingleLogSchema], default: [] },
  },
  { timestamps: true }
);

const IPPortCheckedLog =
  mongoose.models.IPPortCheckedLog ||
  mongoose.model("IPPortCheckedLog", ipPortEntryLogSchema);

export default IPPortCheckedLog;
