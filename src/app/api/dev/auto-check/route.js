import { NextResponse } from "next/server";
import net from "net";
import mongoose from "mongoose";
import IPPortConfig from "../../../../modals/ipPortConfigSchema.js";
import IPPortCheckedLog from "../../../../modals/checkedLogSchema.js";
import sendEmail from "../../../../lib/sendEmail.js";

// --- Check single port ---
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

// --- Format date/time ---
function formatDateTime(date) {
  const d = new Date(date);
  const pad = (n) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// --- Generate comment ---
function generateComment(status) {
  const prefix = "[AutoCheck] ";
  if (status === "online") return prefix + "Active / Running";
  if (status === "offline") return prefix + "Server is offline / unreachable";
  if (status === "timeout") return prefix + "Connection timed out";
  return prefix + "Status unknown";
}

// --- Send alert email for offline/timeout ---
async function sendOfflineAlertEmail(entry, logData) {
  const { ip, port, referPortName, emails } = entry;
  if (!emails?.length) return;

  const lastLogs = logData?.logs?.slice(-5) || [];
  const latestStatus = lastLogs?.[lastLogs.length - 1]?.status || "unknown";
  const alertType = latestStatus === "timeout" ? "⚠️ Connection Timeout" : "🔴 Server Offline";
  const alertColor = latestStatus === "timeout" ? "#fbbf24" : "#d9534f";
  const requestedTime = new Date();

  const htmlMessage = `
    <div style="font-family: Arial, sans-serif; max-width:700px;margin:0 auto;">
      <h2 style="color:${alertColor};">${alertType}</h2>
      <p>IP: <strong>${ip}</strong><br>
         Port: <strong>${port}</strong><br>
         Refer Port: <strong>${referPortName || "custom"}</strong><br>
         Checked At: ${formatDateTime(requestedTime)}</p>
      <h4>Recent Logs:</h4>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr>
            <th style="border:1px solid #ddd;padding:8px;">Checked At</th>
            <th style="border:1px solid #ddd;padding:8px;">Status</th>
            <th style="border:1px solid #ddd;padding:8px;">Response (ms)</th>
            <th style="border:1px solid #ddd;padding:8px;">Comment</th>
          </tr>
        </thead>
        <tbody>
          ${lastLogs
            .map(
              (r) => `<tr>
                <td style="border:1px solid #ddd;padding:8px;">${formatDateTime(r.checkedAt)}</td>
                <td style="border:1px solid #ddd;padding:8px;color:${
                  r.status === "offline" ? "red" : r.status === "timeout" ? "#d97706" : "green"
                }; font-weight:bold;">${r.status}</td>
                <td style="border:1px solid #ddd;padding:8px;">${r.responseTime || "-"}</td>
                <td style="border:1px solid #ddd;padding:8px;">${r.comment}</td>
              </tr>`
            )
            .join("")}
        </tbody>
      </table>
      <p>Please check the server immediately.</p>
      <hr style="margin:20px 0;border:none;border-top:1px solid #eee;">
      <p style="color:#666;font-size:12px;">Monitoring System</p>
    </div>
  `;

  const textMessage = `
${alertType}:

IP: ${ip}
Port: ${port}
Refer Port: ${referPortName || "custom"}
Checked At: ${formatDateTime(requestedTime)}

Recent Logs:
${lastLogs
  .map(
    (r) =>
      `- ${formatDateTime(r.checkedAt)} | ${r.status} | ${r.responseTime || "-"}ms | ${r.comment}`
  )
  .join("\n")}

Please check the server immediately.
`;

  for (const email of emails) {
    try {
      await sendEmail({
        email,
        subject: `${alertType} - ${ip}:${port}`,
        message: textMessage,
        html: htmlMessage,
      });
      console.log(`📧 Alert sent to ${email} for ${ip}:${port} (${latestStatus})`);
    } catch (err) {
      console.error(`❌ Failed to send email to ${email}:`, err.message);
    }
  }
}

// --- Main Auto Check Function ---
export async function GET() {
  console.log("\n🔄 Starting Auto Check:", new Date().toLocaleString());

  try {
    if (mongoose.connection.readyState !== 1) {
      console.warn("⚠️ MongoDB not connected. Ensure DB connection before running.");
    }

    const configs = await IPPortConfig.find({}).lean();
    if (!configs.length) {
      console.warn("⚠️ No configurations found");
      return NextResponse.json({ success: false, message: "No configurations found" });
    }

    const allEntries = configs.flatMap((c) =>
      c.entries.map((e) => ({
        configId: c._id,
        entryId: e._id,
        ip: e.ip,
        port: e.port,
        referPortName: e.referPortName,
        emails: e.emails,
      }))
    );

    const results = await Promise.all(
      allEntries.map(async (entry) => {
        const { ip, port, entryId, configId } = entry;
        try {
          const result = await checkPort(ip, parseInt(port));
          const comment = generateComment(result.status);

          // Update config entry
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

          // Update logs
          const logData = await IPPortCheckedLog.findOneAndUpdate(
            { entryId },
            {
              $setOnInsert: { ip, port, referPortName: entry.referPortName || "custom" },
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

          // Send alert only if offline/timeout
          if (["offline", "timeout"].includes(result.status)) {
            await sendOfflineAlertEmail(entry, logData);
          }

          return { ...entry, ...result };
        } catch (err) {
          console.error(`❌ Error checking ${ip}:${port} ->`, err.message);
          return { ...entry, status: "error" };
        }
      })
    );

    const summary = {
      online: results.filter((r) => r.status === "online").length,
      offline: results.filter((r) => r.status === "offline").length,
      timeout: results.filter((r) => r.status === "timeout").length,
    };

    console.log("📊 Auto Check Summary:", summary);
    console.log("=".repeat(60));

    return NextResponse.json({
      success: true,
      message: "Auto check completed",
      totalChecked: results.length,
      summary,
    });
  } catch (error) {
    console.error("❌ Error during auto check:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error", error: error.message },
      { status: 500 }
    );
  }
}
