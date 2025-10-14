import { NextResponse } from "next/server";
import net from "net";
import IPPortConfig from "../../../../../modals/ipPortConfigSchema.js";
import { connectToDatabase } from "../../../../../../dbConfig.ts";
import IPPortCheckedLog from "../../../../../modals/checkedLogSchema.js";
import sendEmail from "../../../../../lib/sendEmail.js"; // make sure this exists

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
function generateComment(status) {
  const prefix = "[Auto-Cron] ";
  if (status === "online") return prefix + "Active / Running";
  if (status === "offline") return prefix + "Server went offline / unreachable";
  if (status === "timeout") return prefix + "Connection timed out";
  return prefix + "Status unknown";
}

// --- Helper: format date/time ---
function formatDateTime(date) {
  const d = new Date(date);
  const pad = (n) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// --- Send Email when server is offline ---
async function sendOfflineEmail(entry, logData) {
  const { ip, port, referPortName, emails } = entry;
  if (!emails || emails.length === 0) return;

  const lastLogs = logData.logs.slice(-5);
  const now = new Date();

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
      <h2 style="color: #d9534f;">⚠️ Server Offline Alert</h2>
      <p>The server below was detected as <strong style="color:red;">OFFLINE</strong> during the latest automatic check:</p>
      <p><strong>IP:</strong> ${ip}<br>
         <strong>Port:</strong> ${port}<br>
         <strong>Refer Port:</strong> ${referPortName || "custom"}<br>
         <strong>Checked At:</strong> ${formatDateTime(now)}</p>
      <h4>Recent Logs:</h4>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr>
            <th style="border: 1px solid #ddd; padding: 8px;">Checked At</th>
            <th style="border: 1px solid #ddd; padding: 8px;">Status</th>
            <th style="border: 1px solid #ddd; padding: 8px;">Response (ms)</th>
            <th style="border: 1px solid #ddd; padding: 8px;">Comment</th>
          </tr>
        </thead>
        <tbody>
          ${lastLogs
            .map(
              (log) => `
            <tr>
              <td style="border: 1px solid #ddd; padding: 8px;">${formatDateTime(
                log.checkedAt
              )}</td>
              <td style="border: 1px solid #ddd; padding: 8px; color:${
                log.status === "offline" ? "red" : "green"
              };">${log.status}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${log.responseTime || "-"}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${log.comment}</td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>
      <p style="margin-top: 20px;">Please check the server immediately.</p>
      <hr style="margin: 20px 0;">
      <p style="color: #777; font-size: 12px;">Grundfos Pick-Pack Monitoring System</p>
    </div>
  `;

  const message = `
Server Offline Alert

IP: ${ip}
Port: ${port}
Refer Port: ${referPortName || "custom"}
Checked At: ${formatDateTime(now)}

Recent Logs:
${lastLogs
  .map(
    (r) =>
      `- ${formatDateTime(r.checkedAt)} | ${r.status} | ${r.responseTime || "-"}ms | ${r.comment}`
  )
  .join("\n")}
`;

  for (const email of emails) {
    try {
      await sendEmail({
        email,
        subject: `⚠️ Server Offline - ${ip}:${port}`,
        message,
        html,
      });
      console.log(`📧 Sent offline alert to ${email} for ${ip}:${port}`);
    } catch (err) {
      console.error(`❌ Failed to send email to ${email}:`, err.message);
    }
  }
}

// --- Main GET (Triggered by CRON) ---
export async function GET(request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();
    const configs = await IPPortConfig.find({});
    if (!configs.length)
      return NextResponse.json({ success: false, message: "No configurations found" });

    const allEntries = configs.flatMap((config) =>
      config.entries.map((entry) => ({
        configId: config._id,
        entryId: entry._id,
        ip: entry.ip,
        port: entry.port,
        referPortName: entry.referPortName || "custom",
        emails: entry.emails,
      }))
    );

    const results = await Promise.all(
      allEntries.map(async (entry) => {
        const { ip, port, configId, entryId, referPortName } = entry;
        try {
          const result = await checkPort(ip, parseInt(port));
          const comment = generateComment(result.status);

          // Update main config
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

          // Save log
          await IPPortCheckedLog.findOneAndUpdate(
            { entryId },
            {
              $setOnInsert: { ip, port, referPortName },
              $push: {
                logs: {
                  status: result.status,
                  responseTime: result.responseTime,
                  checkedAt: new Date(),
                  comment,
                },
              },
            },
            { upsert: true, new: true }
          );

          // Send email if offline
          if (result.status === "offline") {
            const logData = await IPPortCheckedLog.findOne({ entryId });
            await sendOfflineEmail(entry, logData);
          }

          return { ...entry, ...result };
        } catch (err) {
          console.error(`❌ Error checking ${ip}:${port}:`, err.message);
          return { ...entry, status: "error" };
        }
      })
    );

    const summary = {
      online: results.filter((r) => r.status === "online").length,
      offline: results.filter((r) => r.status === "offline").length,
      timeout: results.filter((r) => r.status === "timeout").length,
    };

    console.log(`[CRON] Checked ${results.length} entries`);
    console.log("Summary:", summary);

    return NextResponse.json({
      success: true,
      summary,
      checked: results.length,
      timestamp: new Date().toISOString(),
      message: "Cron auto-check completed with email alerts",
    });
  } catch (error) {
    console.error("Error in CRON check:", error);
    return NextResponse.json(
      { success: false, message: "CRON error", error: error.message },
      { status: 500 }
    );
  }
}
