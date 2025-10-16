import mongoose from "mongoose";

const ipPortEntrySchema = new mongoose.Schema({
  ip: {
    type: String,
    required: true,
    trim: true,
  },
  port: {
    type: String,
    required: true,
    trim: true,
  },
  checkedAt: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    enum: ["online", "offline"],
    default: "offline",
  },
  responseTime: {
    type: Number,
    default: null,
  },
  referPortName: {
    type: String,
    default: "custom",
  },
  clientName: {
    type: String,
    required: false,
    trim: true,
    default: "",
  },
  emails: {
    type: [String],
    validate: {
      validator: function (emails) {
        return emails.every((email) =>
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        );
      },
      message: "One or more email addresses are invalid",
    },
    default: [],
  },
});

const ipPortConfigSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserData",
      required: true,
      index: true,
    },
    entries: {
      type: [ipPortEntrySchema],
      required: true,
      validate: {
        validator: (entries) => Array.isArray(entries) && entries.length > 0,
        message: "At least one IP/Port entry is required",
      },
    },
  },
  { timestamps: true }
);

ipPortConfigSchema.index({ userId: 1, createdAt: -1 });

const IPPortConfig =
  mongoose.models.IPPortConfig ||
  mongoose.model("IPPortConfig", ipPortConfigSchema);

export default IPPortConfig;
