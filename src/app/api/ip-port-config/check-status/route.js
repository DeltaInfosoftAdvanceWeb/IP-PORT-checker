// app/api/ip-port-config/check-status/route.js
import { NextResponse } from "next/server";
import net from "net";
import IPPortConfig from "@/modals/ipPortConfigSchema";
import { connectToDatabase } from "../../../../../dbConfig";
import IPPortCheckedLog from "@/modals/checkedLogSchema";
import jwt from "jsonwebtoken";
import axios from "axios";

function checkPort(ip, port, timeout = 3000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let status = "offline";
    let responseTime = null;
    const startTime = Date.now();

    socket.setTimeout(timeout);

    socket.on("connect", () => {
      responseTime = Date.now() - startTime;
      status = "online";
      socket.destroy();
    });

    socket.on("timeout", () => {
      status = "timeout";
      socket.destroy();
    });

    socket.on("error", () => {
      status = "offline";
    });

    socket.on("close", () => {
      resolve({ status, responseTime });
    });

    socket.connect(port, ip);
  });
}

export async function POST(req) {
  try {
    // Verify authentication
    const token = req.cookies.get("authToken")?.value;
    if (!token) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return NextResponse.json(
        { success: false, message: "Invalid or expired token." },
        { status: 401 }
      );
    }

    const userId = decoded.userId;
    const body = await req.json();
    const { entries, sendEmailNotification = false } = body; // Add email flag

    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json(
        { success: false, message: "No entries provided" },
        { status: 400 }
      );
    }

    await connectToDatabase();

    console.log(
      `🔍 Checking status for ${entries.length} ${
        entries.length === 1 ? "entry" : "entries"
      }...`
    );

    // Check all entries in parallel
    const checkPromises = entries.map(async (entry) => {
      const { ip, port, configId, _id: entryId } = entry;

      if (!ip || !port) {
        return {
          ip,
          port,
          status: "invalid",
          responseTime: null,
        };
      }

      try {
        const result = await checkPort(ip, parseInt(port));

        // Update the entry in database if configId and entryId are provided
        if (configId && entryId) {
          await IPPortConfig.updateOne(
            { _id: configId, "entries._id": entryId },
            {
              $set: {
                "entries.$.status": result.status,
                "entries.$.responseTime": result.responseTime,
                "entries.$.checkedAt": new Date(),
              },
            }
          );
        }

        console.log(
          `  ✓ ${ip}:${port} - ${result.status} ${
            result.responseTime ? `(${result.responseTime}ms)` : ""
          }`
        );

        return {
          ip,
          port,
          status: result.status,
          responseTime: result.responseTime,
          checkedAt: new Date(),
          referPortName: entry.referPortName || "N/A",
        };
      } catch (error) {
        console.error(`  ✗ ${ip}:${port} - error:`, error.message);

        // Update with error status if configId and entryId are provided
        if (configId && entryId) {
          await IPPortConfig.updateOne(
            { _id: configId, "entries._id": entryId },
            {
              $set: {
                "entries.$.status": "error",
                "entries.$.responseTime": null,
                "entries.$.checkedAt": new Date(),
              },
            }
          );
        }

        return {
          ip,
          port,
          status: "error",
          responseTime: null,
          checkedAt: new Date(),
          referPortName: entry.referPortName || "N/A",
        };
      }
    });

    const results = await Promise.all(checkPromises);

    await IPPortCheckedLog.findOneAndUpdate(
      { userId },
      {
        $set: {
          logs: results.map((r) => ({
            ip: r.ip,
            port: r.port,
            referPortName: r.referPortName,
            status: r.status,
            responseTime: r.responseTime,
            checkedAt: r.checkedAt,
          })),
          updatedAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );

    const summary = {
      total: results.length,
      online: results.filter((r) => r.status === "online").length,
      offline: results.filter((r) => r.status === "offline").length,
      timeout: results.filter((r) => r.status === "timeout").length,
      error: results.filter((r) => r.status === "error").length,
    };

    console.log(
      `Summary: ${summary.online} online, ${summary.offline} offline, ${summary.timeout} timeout, ${summary.error} error`
    );

    // // Send email if requested
    if (sendEmailNotification) {
      try {
        // Call your email API endpoint
        const emailResponse = await axios(
          `${
            process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
          }/api/sendEmail`,
          {
            results,
            summary,
          }
        );

        if (!emailResponse.ok) {
          console.error("Failed to send email notification");
        } else {
          console.log("✉️ Email notification sent successfully");
        }
      } catch (emailError) {
        console.error("Error sending email:", emailError);
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: "Status check completed",
        results,
        summary,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(" Error in check-status API:", error);
    return NextResponse.json(
      {
        success: false,
        message: "An error occurred while checking status",
        error: error.message,
      },
      { status: 500 }
    );
  }
}
