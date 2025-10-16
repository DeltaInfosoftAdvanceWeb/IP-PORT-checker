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

    // Get request body
    const { name } = await req.json();

    if (!name || !name.trim()) {
      return NextResponse.json(
        { success: false, message: "Client name is required" },
        { status: 400 }
      );
    }

    // Check if client already exists for this user
    const existingClient = await Client.findOne({
      userId,
      name: name.trim(),
    });

    if (existingClient) {
      return NextResponse.json(
        { success: false, message: "Client with this name already exists" },
        { status: 409 }
      );
    }

    // Create new client
    const newClient = await Client.create({
      name: name.trim(),
      userId,
      isDefault: false,
    });

    return NextResponse.json({
      success: true,
      message: "Client added successfully",
      data: newClient,
    });
  } catch (error) {
    console.error("Error adding client:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to add client" },
      { status: 500 }
    );
  }
}
