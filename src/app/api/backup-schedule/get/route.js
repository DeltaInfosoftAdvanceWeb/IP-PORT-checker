import { NextResponse } from "next/server";
import { connectToDatabase } from "../../../../../dbConfig";
import BackupSchedule from "@/modals/backupScheduleSchema";

export async function GET(request) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const clientName = searchParams.get("clientName");
    const projectName = searchParams.get("projectName");

    // Build query based on filters
    const query = {};

    if (clientName && clientName !== "all") {
      query.clientName = { $regex: clientName, $options: "i" };
    }

    if (projectName && projectName !== "all") {
      query.projectName = { $regex: projectName, $options: "i" };
    }

    // Fetch backup schedules
    const backupSchedules = await BackupSchedule.find(query)
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({
      success: true,
      data: backupSchedules,
      count: backupSchedules.length,
    });
  } catch (error) {
    console.error("Error fetching backup schedules:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch backup schedules",
        error: error.message,
      },
      { status: 500 }
    );
  }
}
