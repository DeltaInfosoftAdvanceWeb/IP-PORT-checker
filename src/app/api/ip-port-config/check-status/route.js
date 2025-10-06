// app/api/check-status/route.js
import { NextResponse } from "next/server";
import net from "net";

// Function to check if a port is open
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

    socket.on("error", (err) => {
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
    const { entries } = await req.json();

    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "No entries provided",
        },
        { status: 400 }
      );
    }

    // Check all IPs/Ports in parallel
    const checkPromises = entries.map(async (entry) => {
      const { ip, port } = entry;

      if (!ip || !port) {
        return {
          ip,
          port,
          status: "invalid",
          message: "Invalid IP or Port",
          responseTime: null,
        };
      }

      try {
        const result = await checkPort(ip, parseInt(port));
        return {
          ip,
          port,
          status: result.status,
          responseTime: result.responseTime,
          message:
            result.status === "online"
              ? "Connected"
              : result.status === "timeout"
              ? "Connection timeout"
              : "Connection refused",
          checkedAt: new Date().toISOString(),
        };
      } catch (error) {
        return {
          ip,
          port,
          status: "error",
          message: error.message,
          responseTime: null,
          checkedAt: new Date().toISOString(),
        };
      }
    });

    const results = await Promise.all(checkPromises);

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