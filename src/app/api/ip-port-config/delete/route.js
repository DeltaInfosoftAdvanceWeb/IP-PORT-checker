import { NextResponse } from "next/server";
import IPPortConfig from "../../../../modals/ipPortConfigSchema";
import { connectToDatabase } from "../../../../../dbConfig";
import jwt from "jsonwebtoken";

export async function POST(req) {
  try {
    await connectToDatabase();

    // Get token from cookies
    const token = req.cookies.get("authToken")?.value;

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          message: "Authentication required. Please login first.",
        },
        { status: 401 }
      );
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid or expired token. Please login again.",
        },
        { status: 401 }
      );
    }

    const { configId, entryId } = await req.json();

    const userId = decoded.userId;

    if (!userId) {
      return NextResponse.json(
        { success: false, message: "Not Authorized login first" },
        { status: 400 }
      );
    }

    if (!configId || !entryId) {
      return NextResponse.json(
        { success: false, message: "ConfigId and EntryId required" },
        { status: 400 }
      );
    }

    // First, pull the entry from the entries 
    const updatedConfig = await IPPortConfig.findOneAndUpdate(
      { _id: configId },
      { $pull: { entries: { _id: entryId } } },
      { new: true }
    );

    if (!updatedConfig) {
      return NextResponse.json(
        { success: false, message: "Entry or configuration not found" },
        { status: 404 }
      );
    }

    // Check if entries array is now empty
    if (!updatedConfig.entries || updatedConfig.entries.length === 0) {
      
      await IPPortConfig.findByIdAndDelete(configId);
      
      return NextResponse.json(
        {
          success: true,
          message: "Last entry deleted. Configuration removed successfully.",
          deletedId: configId,
          configDeleted: true,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Entry deleted successfully",
        deletedId: configId,
        configDeleted: false,
        remainingEntries: updatedConfig.entries.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting configuration:", error);
    return NextResponse.json(
      {
        success: false,
        message: "An error occurred while deleting configuration",
        error: error.message,
      },
      { status: 500 }
    );
  }
}