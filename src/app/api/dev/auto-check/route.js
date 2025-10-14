import { NextResponse } from "next/server";
import net from "net";
import IPPortConfig from "../../../../modals/ipPortConfigSchema.js";
// import { connectToDatabase } from "../../../../../dbConfig.js";
import IPPortCheckedLog from "../../../../modals/checkedLogSchema.js";
import sendEmail from "../../../../lib/sendEmail.js"; // make sure this path is correct

// --- Helper: check single port ---
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

// --- Generate readable comment ---
function generateComment(status) {
  const prefix = "[AutoCheck] ";
  if (status === "online") return prefix + "Active / Running";
  if (status === "offline") return prefix + "Server is offline / unreachable";
  if (status === "timeout") return prefix + "Connection timed out";
  return prefix + "Status unknown";
}

// --- Format date and time ---
function formatDateTime(date) {
  const d = new Date(date);
  const pad = (n) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// --- Helper: send offline alert email ---
async function sendOfflineAlertEmail(entry, logData) {
  const { ip, port, referPortName, emails } = entry;
  if (!emails || emails.length === 0) return;

  const lastLogs = logData.logs.slice(-5); // send last 5 logs for context
  const requestedTime = new Date();

  const htmlMessage = `
    <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
      <h2 style="color: #d9534f;">⚠️ Server Offline Alert</h2>
      <p>Hello,</p>
      <p>The following IP:Port entry was detected as <strong style="color:red;">OFFLINE</strong> during the latest automatic check.</p>
      <p><strong>IP:</strong> ${ip}<br>
         <strong>Port:</strong> ${port}<br>
         <strong>Refer Port:</strong> ${referPortName || "custom"}<br>
         <strong>Checked At:</strong> ${formatDateTime(requestedTime)}</p>

      <h4>Recent Logs:</h4>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr>
            <th style="border: 1px solid #ddd; padding: 8px;">Checked At</th>
            <th style="border: 1px solid #ddd; padding: 8px;">Status</th>
            <th style="border: 1px solid #ddd; padding: 8px;">Response Time (ms)</th>
            <th style="border: 1px solid #ddd; padding: 8px;">Comment</th>
          </tr>
        </thead>
        <tbody>
          ${lastLogs
            .map(
              (r) => `
            <tr>
              <td style="border: 1px solid #ddd; padding: 8px;">${formatDateTime(r.checkedAt)}</td>
              <td style="border: 1px solid #ddd; padding: 8px; color:${
                r.status === "offline" ? "red" : "green"
              }; font-weight:bold;">${r.status}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${r.responseTime || "-"}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${r.comment}</td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>

      <p style="margin-top: 20px;">Please check the server immediately.</p>
      <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
      <p style="color: #666; font-size: 12px;">Best regards,<br>DeltaInfoSoft Monitoring System</p>
    </div>
  `;

  const message = `
Server Offline Alert:

IP: ${ip}
Port: ${port}
Refer Port: ${referPortName || "custom"}
Detected At: ${formatDateTime(requestedTime)}

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
        subject: `⚠️ Server Offline - ${ip}:${port}`,
        message,
        html: htmlMessage,
      });
      console.log(`📧 Alert sent to ${email} for ${ip}:${port}`);
    } catch (err) {
      console.error(`❌ Failed to send email to ${email}:`, err.message);
    }
  }
}

// --- Main GET function ---
export async function GET() {
  const startTime = new Date();
  console.log("\n" + "=".repeat(60));
  console.log(`🔄 [AUTO-CHECK] Started at: ${startTime.toLocaleString()}`);
  console.log("=".repeat(60));

  try {
    // await connectToDatabase();
    console.log("✅ Database connected");

    const configs = await IPPortConfig.find({});
    if (!configs.length) {
      console.log("⚠️ No configurations found");
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
        const { ip, port, entryId, configId, referPortName } = entry;
        try {
          const result = await checkPort(ip, parseInt(port));
          const comment = generateComment(result.status);

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

          // Send alert if offline
          if (result.status === "offline") {
            const logData = await IPPortCheckedLog.findOne({ entryId });
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

    console.log("\n📊 Summary:", summary);
    console.log("=".repeat(60) + "\n");

    return NextResponse.json({
      success: true,
      message: "Automatic check completed",
      summary,
      totalChecked: results.length,
    });
  } catch (error) {
    console.error("❌ Error in auto-check:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error", error: error.message },
      { status: 500 }
    );
  }
}
