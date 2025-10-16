import { connectToDatabase } from "../../../../../dbConfig";
import Client from "@/modals/clientSchema";
import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";

export async function POST(req) {
  try {
    await connectToDatabase();

    // Get JWT from cookies
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

    // Verify JWT
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

    // Get all clients for the user, sorted by creation date
    const clients = await Client.find({ userId }).sort({ createdAt: 1 });

    return NextResponse.json({
      success: true,
      data: clients,
      count: clients.length,
    });
  } catch (error) {
    console.error("Error fetching clients:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch clients" },
      { status: 500 }
    );
  }
}
