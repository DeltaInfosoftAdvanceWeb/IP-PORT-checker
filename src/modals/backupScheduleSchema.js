import mongoose from "mongoose";

const backupScheduleSchema = new mongoose.Schema(
  {
    clientName: {
      type: String,
      required: [true, "Client name is required"],
      trim: true,
    },
    projectName: {
      type: String,
      required: [true, "Project name is required"],
      trim: true,
    },
    backupStartTime: {
      type: Date,
      required: [true, "Backup start time is required"],
    },
    backupEndTime: {
      type: Date,
      required: [true, "Backup end time is required"],
    },
  },
  {
    timestamps: true,
  }
);

backupScheduleSchema.pre("save", function (next) {
  if (this.backupEndTime <= this.backupStartTime) {
    next(new Error("Backup end time must be after backup start time"));
  } else {
    next();
  }
});

const BackupSchedule =
  mongoose.models.BackupSchedule ||
  mongoose.model("BackupSchedule", backupScheduleSchema);

export default BackupSchedule;
