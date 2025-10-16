import { NextResponse } from "next/server";
import IPPortConfig from "../../../../modals/ipPortConfigSchema.js";
import { connectToDatabase } from "../../../../../dbConfig";
import jwt from "jsonwebtoken";

export async function POST(req) {
  try {
    // 1️⃣ Connect to MongoDB
    await connectToDatabase();

    // 2️⃣ Get JWT from cookies
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

    // 3️⃣ Verify JWT
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

    // 4️⃣ Parse and validate request body
    const { entries } = await req.json();

    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "At least one IP/Port entry is required",
        },
        { status: 400 }
      );
    }

    // 5️⃣ Email validation helper
    const isValidEmail = (email) =>
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

    // 6️⃣ Clean + validate each entry
    const cleanedEntries = entries.map((entry, index) => {
      const { ip, port, referPortName, emails ,clientName} = entry;

      // Required fields check
      if (!ip || !port) {
        throw new Error(`Entry ${index + 1}: IP and Port are required`);
      }
      // Clean and validate emails
      const cleanedEmails = Array.isArray(emails)
        ? emails
            .map((e) => e.trim())
            .filter((e) => e.length > 0 && isValidEmail(e))
        : typeof emails === "string"
        ? emails
            .split(/[,\n]/)
            .map((e) => e.trim())
            .filter((e) => e.length > 0 && isValidEmail(e))
        : [];

      // Optional: allow empty emails array if not required
      // if (cleanedEmails.length === 0) {
      //   throw new Error(`Entry ${index + 1}: At least one valid email is required`);
      // }

      return {
        ip: ip.trim(),
        port: port.trim(),
        referPortName: referPortName?.trim() || "custom",
        clientName:clientName,
        emails: cleanedEmails,
        status: "offline",
        checkedAt: new Date(),
      };
    });

    for (const entry of cleanedEntries) {
      const duplicate = await IPPortConfig.findOne({
        "entries.ip": entry.ip,
        "entries.port": entry.port,
      });

      if (duplicate) {
        return NextResponse.json(
          {
            success: false,
            message: `IP and Port pair ${entry.ip}:${entry.port} already exists.`,
          },
          { status: 400 }
        );
      }
    }

    // 7️⃣ Save to MongoDB
    const newConfig = new IPPortConfig({
      userId,
      entries: cleanedEntries,
    });

    await newConfig.save();

    // 8️⃣ Return success response
    return NextResponse.json(
      {
        success: true,
        message: "IP/Port configuration saved successfully",
        data: {
          configId: newConfig._id,
          userId: newConfig.userId,
          entries: newConfig.entries,
          createdAt: newConfig.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error saving IP/Port configuration:", error);
    return NextResponse.json(
      {
        success: false,
        message:
          error.message ||
          "An unexpected error occurred while saving configuration",
      },
      { status: 500 }
    );
  }
}
