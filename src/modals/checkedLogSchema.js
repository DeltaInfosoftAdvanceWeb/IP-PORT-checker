import mongoose from "mongoose";

const ipportCheckedLog = new mongoose.Schema({
  ip: {
    type: String,
    required: true,
  },
  port: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    default: "unknown",
  },
  checkedAt: {
    type: Date,
  },
  responseTime: {
    type: Number,
    default: null,
  },
  referPortName: {
    type: String,
    default: "custom",
  },
});

const userIpPortCheckedLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserData",
      required: true,
      index: true,
    },
    logs: {
      type: [ipportCheckedLog],
      required: true,
      validate: {
        validator: function (logs) {
          return Array.isArray(logs) && logs.length > 0;
        },
        message: "At least one IP/Port log is required",
      },
    },
  },
  { timestamps: true }
);

const IPPortCheckedLog =
  mongoose.models.IPPortCheckedLog ||
  mongoose.model("IPPortCheckedLog", userIpPortCheckedLogSchema);

export default IPPortCheckedLog;
