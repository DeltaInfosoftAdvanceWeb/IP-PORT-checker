import { NextResponse } from "next/server";
import { connectToDatabase } from "../../../../../dbConfig";
import BackupSchedule from "@/modals/backupScheduleSchema";

// Helper function to parse date format "17 Jan 2025 23:45"
const parseCustomDate = (dateString) => {
  try {
    // Check if already a valid ISO date or parseable by Date constructor
    const directDate = new Date(dateString);
    if (!isNaN(directDate.getTime())) {
      return directDate;
    }

    // Parse custom format: "17 Jan 2025 23:45"
    const parts = dateString.trim().split(/\s+/);
    if (parts.length < 4) {
      throw new Error("Invalid date format");
    }

    const day = parseInt(parts[0], 10);
    const monthStr = parts[1];
    const year = parseInt(parts[2], 10);
    const timeParts = parts[3].split(":");
    const hour = parseInt(timeParts[0], 10);
    const minute = parseInt(timeParts[1], 10);

    // Month mapping
    const months = {
      Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
      Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
    };

    const month = months[monthStr];
    if (month === undefined) {
      throw new Error("Invalid month");
    }

    // Create date in Asia/Kolkata timezone
    const date = new Date(year, month, day, hour, minute, 0);

    if (isNaN(date.getTime())) {
      throw new Error("Invalid date");
    }

    return date;
  } catch (error) {
    throw new Error(`Failed to parse date: ${dateString}. Expected format: "17 Jan 2025 23:45"`);
  }
};

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

    // Parse dates using custom parser that handles "17 Jan 2025 23:45" format
    let startTime, endTime;

    try {
      startTime = parseCustomDate(backupStartTime);
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          message: `Invalid backup start time: ${error.message}`,
        },
        { status: 400 }
      );
    }

    try {
      endTime = parseCustomDate(backupEndTime);
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          message: `Invalid backup end time: ${error.message}`,
        },
        { status: 400 }
      );
    }

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
