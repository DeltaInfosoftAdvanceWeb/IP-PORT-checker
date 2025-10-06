// app/api/ip-port-config/[id]/route.js
import { NextResponse } from "next/server";
import IPPortConfig from "../../../../../modals/ipPortConfigSchema";
import { connectToDatabase } from "../../../../../../dbConfig";
import jwt from "jsonwebtoken";

export async function DELETE(req, { params }) {
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

    const userId = decoded.userId;
    const configId = params.id;

    // Find the configuration
    const config = await IPPortConfig.findById(configId);

    if (!config) {
      return NextResponse.json(
        {
          success: false,
          message: "Configuration not found",
        },
        { status: 404 }
      );
    }

    // Check if the configuration belongs to the logged-in user
    if (config.userId.toString() !== userId) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized. You can only delete your own configurations.",
        },
        { status: 403 }
      );
    }

    // Delete the configuration
    await IPPortConfig.findByIdAndDelete(configId);

    return NextResponse.json(
      {
        success: true,
        message: "Configuration deleted successfully",
        deletedId: configId,
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