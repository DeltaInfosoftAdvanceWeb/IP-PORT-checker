// modals/ipPortConfigSchema.js
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
        validator: function (entries) {
          return entries.length > 0;
        },
        message: "At least one IP/Port entry is required",
      },
    },
    configName: {
      type: String,
      trim: true,
      default: "Default Configuration",
    },
  },
  {
    timestamps: true,
  }
);

// Create index for faster queries
ipPortConfigSchema.index({ userId: 1, createdAt: -1 });

const IPPortConfig =
  mongoose.models.IPPortConfig ||
  mongoose.model("IPPortConfig", ipPortConfigSchema);

export default IPPortConfig;