import { NextResponse } from "next/server";
import { connectToDatabase } from "../../../../../dbConfig";
import IPPortConfig from "../../../../modals/ipPortConfigSchema.js";
import jwt from "jsonwebtoken";
import IPPortCheckedLog from "@/modals/checkedLogSchema";

export async function POST(req) {
  try {
    // 1️⃣ Connect DB
    await connectToDatabase();

    // 2️⃣ Verify token
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

    // 3️⃣ Parse body
    const { entries, configId, entryId } = await req.json();

    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json(
        { success: false, message: "Please provide IP/PORT data to update." },
        { status: 400 }
      );
    }

    if (!configId || !entryId) {
      return NextResponse.json(
        { success: false, message: "configId and entryId are required." },
        { status: 400 }
      );
    }

    // 4️⃣ Basic field validation
    const entry = entries[0];
    if (
      !entry.ip ||
      !entry.port ||
      !entry.referPortName ||
      entry.ip.trim() === "" ||
      entry.port.trim() === "" ||
      entry.referPortName.trim() === ""
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "IP, Port, and Refer Port Name are required.",
        },
        { status: 400 }
      );
    }

    // 5️⃣ Email validation helper
    const isValidEmail = (email) =>
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

    // 6️⃣ Clean and validate emails
    let cleanedEmails = [];
    if (Array.isArray(entry.emails)) {
      cleanedEmails = entry.emails
        .map((e) => e.trim())
        .filter((e) => e.length > 0 && isValidEmail(e));
    } else if (typeof entry.emails === "string") {
      cleanedEmails = entry.emails
        .split(/[,\n]/)
        .map((e) => e.trim())
        .filter((e) => e.length > 0 && isValidEmail(e));
    }

    if (cleanedEmails.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: `At least one valid email is required for ${entry.ip}:${entry.port}.`,
        },
        { status: 400 }
      );
    }

    // 7️⃣ Update document
    const updateConfig = await IPPortConfig.findOneAndUpdate(
      { _id: configId, "entries._id": entryId },
      {
        $set: {
          "entries.$.ip": entry.ip.trim(),
          "entries.$.port": entry.port.trim(),
          "entries.$.referPortName": entry.referPortName.trim(),
          "entries.$.emails": cleanedEmails,
          "entries.$.checkedAt": new Date(),
        },
      },
      { new: true }
    );

    if (!updateConfig) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Entry not found or update failed. Please verify configId and entryId.",
        },
        { status: 404 }
      );
    }
    // --- Update log document if it exists ---
    const logDoc = await IPPortCheckedLog.findOne({ entryId });
    if (logDoc) {
      logDoc.ip = entry.ip.trim();
      logDoc.port = entry.port.trim();
      logDoc.referPortName = entry.referPortName.trim();
      await logDoc.save();
    }
    // 8️⃣ Return success response
    return NextResponse.json(
      {
        success: true,
        message: "IP/Port configuration updated successfully.",
        data: updateConfig,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating IP/Port configuration:", error);
    return NextResponse.json(
      {
        success: false,
        message:
          error.message ||
          "An unexpected error occurred while updating configuration.",
      },
      { status: 500 }
    );
  }
}
