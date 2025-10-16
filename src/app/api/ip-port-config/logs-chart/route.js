import { NextResponse } from "next/server";
import {connectToDatabase} from "../../../../../dbConfig";
import IPPortCheckedLog from "@/modals/checkedLogSchema";

export async function POST(request) {
  try {
    await connectToDatabase();

    const { startDate, endDate, entryId, entryIds } = await request.json();

    // Build query
    const query = {};

    // Handle multiple entryIds (new) or single entryId (backward compatibility)
    if (entryIds && Array.isArray(entryIds) && entryIds.length > 0) {
      query.entryId = { $in: entryIds };
    } else if (entryId && entryId !== "all") {
      query.entryId = entryId;
    }

    if (startDate || endDate) {
      query["logs.checkedAt"] = {};
      if (startDate) {
        query["logs.checkedAt"].$gte = new Date(startDate);
      }
      if (endDate) {
        query["logs.checkedAt"].$lte = new Date(endDate);
      }
    }

    // Fetch all logs
    const allLogs = await IPPortCheckedLog.find(query).lean();

    // Process and aggregate logs
    const chartData = [];

    allLogs.forEach((logDoc) => {
      const filteredLogs = logDoc.logs.filter((log) => {
        const logDate = new Date(log.checkedAt);
        if (startDate && logDate < new Date(startDate)) return false;
        if (endDate && logDate > new Date(endDate)) return false;
        return true;
      });

      filteredLogs.forEach((log) => {
        chartData.push({
          entryId: logDoc.entryId,
          ip: logDoc.ip,
          port: logDoc.port,
          referPortName: logDoc.referPortName,
          checkedAt: log.checkedAt,
          status: log.status,
          responseTime: log.responseTime,
          comment: log.comment,
        });
      });
    });

    // Sort by date
    chartData.sort((a, b) => new Date(a.checkedAt) - new Date(b.checkedAt));

    return NextResponse.json({
      success: true,
      data: chartData,
      count: chartData.length,
    });
  } catch (error) {
    console.error("Error fetching logs for chart:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch logs",
        error: error.message,
      },
      { status: 500 }
    );
  }
}
