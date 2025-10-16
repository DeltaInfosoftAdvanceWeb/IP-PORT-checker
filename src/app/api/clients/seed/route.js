import { connectToDatabase } from "../../../../../dbConfig";
import Client from "@/modals/clientSchema";
import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";

const DEFAULT_CLIENTS = ["Waterman", "Desire"];

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

    // Check if default clients already exist for this user
    const existingClients = await Client.find({ userId });

    if (existingClients.length > 0) {
      return NextResponse.json({
        success: true,
        message: "Clients already exist",
        data: existingClients,
      });
    }

    // Create default clients
    const clientPromises = DEFAULT_CLIENTS.map((name) =>
      Client.create({
        name,
        userId,
        isDefault: true,
      })
    );

    const createdClients = await Promise.all(clientPromises);

    return NextResponse.json({
      success: true,
      message: "Default clients created successfully",
      data: createdClients,
    });
  } catch (error) {
    console.error("Error seeding clients:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to seed clients" },
      { status: 500 }
    );
  }
}
