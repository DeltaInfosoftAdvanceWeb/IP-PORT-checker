import { NextResponse } from "next/server";
import { connectToDatabase } from "../../../../../dbConfig";
import BackupSchedule from "@/modals/backupScheduleSchema";

export async function POST(request) {
  try {
    await connectToDatabase();

    const { clientName, projectName, backupStartTime, backupEndTime } =
      await request.json();

    if (!clientName || !projectName || !backupStartTime || !backupEndTime) {
      return NextResponse.json(
        {
          success: false,
          message: "All fields are required",
        },
        { status: 400 }
      );
    }

    // Validate that end time is after start time
    const startTime = new Date(backupStartTime);
    const endTime = new Date(backupEndTime);

    if (endTime <= startTime) {
      return NextResponse.json(
        {
          success: false,
          message: "Backup end time must be after backup start time",
        },
        { status: 400 }
      );
    }

    // Create new backup schedule
    const newBackupSchedule = new BackupSchedule({
      clientName,
      projectName,
      backupStartTime: startTime,
      backupEndTime: endTime,
    });

    await newBackupSchedule.save();

    return NextResponse.json(
      {
        success: true,
        message: "Backup schedule created successfully",
        data: newBackupSchedule,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating backup schedule:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to create backup schedule",
        error: error.message,
      },
      { status: 500 }
    );
  }
}
