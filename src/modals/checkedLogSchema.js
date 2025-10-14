import mongoose from "mongoose";

const ipPortSingleLogSchema = new mongoose.Schema({
  checkedAt: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ["online", "offline", "timeout", "checking", "unknown"],
    default: "unknown",
  },
  responseTime: { type: Number, default: null },
  comment: { type: String, trim: true, default: "" },
});

ipPortSingleLogSchema.pre("save", function (next) {
  if (!this.comment) {
    if (this.status === "online") this.comment = "Active / Running";
    else if (this.status === "offline") this.comment = "Server is offline / unreachable";
    else if (this.status === "timeout") this.comment = "Connection timed out";
    else if (this.status === "checking") this.comment = "Checking status...";
    else this.comment = "Status unknown";
  }
  next();
});

const ipPortEntryLogSchema = new mongoose.Schema(
  {
    entryId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "IPPortConfig",
      unique: true, // One doc per entry
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
