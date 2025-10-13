import { NextResponse } from "next/server";
import IPPortConfig from "../../../../modals/ipPortConfigSchema.js";
import { connectToDatabase } from "../../../../../dbConfig";
import jwt from "jsonwebtoken";

export async function POST(req) {
  try {
    await connectToDatabase();

    // Get token from cookies or headers
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

    // Verify token and extract user ID
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

    // Parse request body
    const { entries } = await req.json();

    // Validate entries
    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "At least one IP/Port entry is required",
        },
        { status: 400 }
      );
    }

    // Validate each entry has ip and port
    const isValid = entries.every(
      (entry) =>
        entry.ip &&
        entry.port &&
        entry.referPortName &&
        entry.referPortName.trim() !== "" &&
        entry.ip.trim() !== "" &&
        entry.port.trim() !== ""
    );

    if (!isValid) {
      return NextResponse.json(
        {
          success: false,
          message: "All entries must have both IP address and port",
        },
        { status: 400 }
      );
    }

    // const portReferenceMap = {
    //   80: "http",
    //   443: "https",
    //   21: "ftp",
    //   22: "ssh",
    //   25: "smtp",
    //   110: "pop3",
    //   143: "imap",
    //   3306: "mysql",
    //   5432: "postgresql",
    //   6379: "redis",
    //   27017: "mongodb",
    //   5000: "local dev",
    //   8000: "dev server",
    // };

    // Clean and enrich entries
    // const cleanedEntries = entries.map(({ ip, port }) => {
    //   const trimmedPort = port.trim();
    //   const referPortName = portReferenceMap[trimmedPort] || "custom";
    //   return {
    //     ip: ip.trim(),
    //     port: trimmedPort,
    //     referPortName,
    //   };
    // });

    // Create new IP/Port configuration
    const newConfig = new IPPortConfig({
      userId,
      entries,
    });

    await newConfig.save();

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
        message: "An error occurred while saving configuration",
        error: error.message,
      },
      { status: 500 }
    );
  }
}
