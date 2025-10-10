import { NextResponse } from "next/server";
import net from "net";
import IPPortCheckedLog from "@/modals/checkedLogSchema";
import IPPortConfig from "@/modals/ipPortConfigSchema";
import jwt from "jsonwebtoken";

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
    // Extract JWT token for identifying user
    const token = req.cookies.get("authToken")?.value;
    if (!token) {
      return NextResponse.json(
        { success: false, message: "Authentication required." },
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
    const { entries } = await req.json();

    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json(
        { success: false, message: "No entries provided" },
        { status: 400 }
      );
    }

    // Check all IPs/Ports in parallel
    const checkPromises = entries.map(async (entry) => {
      const { ip, port, configId, _id: entryId, referPortName } = entry;

      if (!ip || !port) {
        return {
          ip,
          port,
          referPortName: referPortName || "custom",
          status: "invalid",
          message: "Invalid IP or Port",
          responseTime: null,
        };
      }

      try {
        const result = await checkPort(ip, parseInt(port));

        // Update nested entry inside parent config
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

        return {
          ip,
          port,
          referPortName: referPortName || "custom",
          status: result.status,
          responseTime: result.responseTime,
          message:
            result.status === "online"
              ? "Connected"
              : result.status === "timeout"
              ? "Connection timeout"
              : "Connection refused",
          checkedAt: new Date(),
        };
      } catch (error) {
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

        return {
          ip,
          port,
          referPortName: referPortName || "custom",
          status: "error",
          message: error.message,
          responseTime: null,
          checkedAt: new Date(),
        };
      }
    });

    const results = await Promise.all(checkPromises);

    //  Upsert user-specific log document (only one per user)
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

    return NextResponse.json(
      {
        success: true,
        results,
        totalChecked: results.length,
        online: results.filter((r) => r.status === "online").length,
        offline: results.filter((r) => r.status === "offline").length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error checking IP/Port status:", error);
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
