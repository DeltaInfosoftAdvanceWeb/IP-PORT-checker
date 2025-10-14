import { NextResponse } from "next/server";
import net from "net";
import IPPortConfig from "@/modals/ipPortConfigSchema";
import { connectToDatabase } from "../../../../../dbConfig";
import IPPortCheckedLog from "@/modals/checkedLogSchema";

// --- Check a single port ---
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

// --- Generate comment for log ---
function generateComment(status, isManual = false) {
  const prefix = isManual ? "[Manual] " : "[Auto] ";
  if (status === "online") return prefix + "Active / Running";
  if (status === "offline") return prefix + "Server went offline / unreachable";
  if (status === "timeout") return prefix + "Connection timed out";
  if (status === "checking") return prefix + "Checking status...";
  return prefix + "Status unknown";
}

// --- Core checking logic ---
async function performStatusCheck(isManual = false) {
  await connectToDatabase();

  const configs = await IPPortConfig.find({});
  if (!configs || configs.length === 0) {
    return { success: false, message: "No configurations found" };
  }

  const allEntries = configs.flatMap((config) =>
    config.entries.map((entry) => ({
      configId: config._id,
      entryId: entry._id,
      ip: entry.ip,
      port: entry.port,
      referPortName: entry.referPortName || "custom",
    }))
  );

  const results = await Promise.all(
    allEntries.map(async (entry) => {
      const { ip, port, configId, entryId, referPortName } = entry;
      try {
        const result = await checkPort(ip, parseInt(port));

        // --- Update IPPortConfig entry status ---
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
          configId,
          entryId,
          ip,
          port,
          status: result.status,
          responseTime: result.responseTime,
          checkedAt: new Date(),
          referPortName,
          comment: generateComment(result.status, isManual),
        };
      } catch (error) {
        console.error(`Error checking ${ip}:${port}`, error.message);
        return {
          configId,
          entryId,
          ip,
          port,
          status: "error",
          responseTime: null,
          checkedAt: new Date(),
          referPortName,
          comment: isManual ? "[Manual] Error while checking" : "[Auto] Error while checking",
        };
      }
    })
  );

  // Save logs per entry
  for (const log of results) {
    await IPPortCheckedLog.findOneAndUpdate(
      { entryId: log.entryId },
      {
        $setOnInsert: {
          ip: log.ip,
          port: log.port,
          referPortName: log.referPortName,
        },
        $push: {
          logs: {
            status: log.status,
            responseTime: log.responseTime,
            checkedAt: log.checkedAt,
            comment: log.comment,
          },
        },
      },
      { upsert: true, new: true }
    );
  }

  return {
    success: true,
    results,
    message: isManual ? "Manual status check completed" : "Automatic status check completed",
  };
}

// --- POST: Manual check ---
export async function POST() {
  try {
    const result = await performStatusCheck(true);
    return NextResponse.json(result, { status: result.success ? 200 : 404 });
  } catch (error) {
    console.error("Error in manual status-check API:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to check status",
        error: error.message,
      },
      { status: 500 }
    );
  }
}

// --- GET: Can be used for manual trigger or health check ---
export async function GET() {
  try {
    const result = await performStatusCheck(true);
    return NextResponse.json(result, { status: result.success ? 200 : 404 });
  } catch (error) {
    console.error("Error in GET status-check API:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to check status",
        error: error.message,
      },
      { status: 500 }
    );
  }
}