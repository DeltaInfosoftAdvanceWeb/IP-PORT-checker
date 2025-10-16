import mongoose from "mongoose";

const clientSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserData",
      required: true,
      index: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Index for faster queries
clientSchema.index({ userId: 1, name: 1 });

const Client = mongoose.models.Client || mongoose.model("Client", clientSchema);

export default Client;
