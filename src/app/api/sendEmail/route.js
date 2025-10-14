import { NextResponse } from "next/server";
import IPPortConfig from "../../../modals/ipPortConfigSchema.js";
import IPPortCheckedLog from "../../../modals/checkedLogSchema.js";
import sendEmail from "../../../lib/sendEmail.js";

const formatDateTime = (date) => {
  const d = new Date(date);
  const pad = (n) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

export async function POST(req) {
  try {
    const { entryId } = await req.json();

    if (!entryId) {
      return NextResponse.json(
        { success: false, message: "entryId is required" },
        { status: 400 }
      );
    }

    // 1️⃣ Get entry details (with emails)
    const config = await IPPortConfig.findOne({ "entries._id": entryId });
    if (!config) {
      return NextResponse.json(
        { success: false, message: "No entry found for this ID" },
        { status: 404 }
      );
    }

    const entry = config.entries.find((e) => e._id.toString() === entryId);
    if (!entry) {
      return NextResponse.json(
        { success: false, message: "Entry not found" },
        { status: 404 }
      );
    }

    if (!entry.emails || entry.emails.length === 0) {
      return NextResponse.json(
        { success: false, message: "No emails found for this entry" },
        { status: 400 }
      );
    }

    // 2️⃣ Get all logs for this entry
    const logData = await IPPortCheckedLog.findOne({ entryId });
    if (!logData || !logData.logs.length) {
      return NextResponse.json(
        { success: false, message: "No logs found for this entry" },
        { status: 404 }
      );
    }

    const requestedTime = new Date();

    // 3️⃣ Prepare email content
    const textMessage = `
Hi,

Here’s the log report for your IP PORT entry ${entry.ip}:${entry.port} (${entry.referPortName || "custom"}) 
generated on ${formatDateTime(requestedTime)}.

| Checked At | Status | Response Time | Comment |
|-------------|---------|----------------|-----------|
${logData.logs
  .map(
    (r) =>
      `${formatDateTime(r.checkedAt)}\t${r.status}\t${r.responseTime || "-"}ms\t${r.comment}`
  )
  .join("\n")}

Best regards,
DeltaInfoSoft
`;

    const htmlMessage = `
<div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
  <h2 style="color: #333;">IP PORT Log Report</h2>
  <p>Here’s the log report for your entry:</p>
  <p><strong>IP:</strong> ${entry.ip}<br>
     <strong>Port:</strong> ${entry.port}<br>
     <strong>Refer Port:</strong> ${entry.referPortName || "custom"}<br>
     <strong>Generated:</strong> ${formatDateTime(requestedTime)}</p>

  <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
    <thead>
      <tr>
        <th style="border: 1px solid #ddd; padding: 8px;">Checked At</th>
        <th style="border: 1px solid #ddd; padding: 8px;">Status</th>
        <th style="border: 1px solid #ddd; padding: 8px;">Response Time (ms)</th>
        <th style="border: 1px solid #ddd; padding: 8px;">Comment</th>
      </tr>
    </thead>
    <tbody>
      ${logData.logs
        .map((r) => {
          let color =
            r.status === "online"
              ? "green"
              : r.status === "offline"
              ? "red"
              : r.status === "timeout"
              ? "orange"
              : "gray";
          return `
          <tr>
            <td style="border: 1px solid #ddd; padding: 8px;">${formatDateTime(
              r.checkedAt
            )}</td>
            <td style="border: 1px solid #ddd; padding: 8px; color:${color}; font-weight: bold;">
              ${r.status}
            </td>
            <td style="border: 1px solid #ddd; padding: 8px;">${
              r.responseTime || "-"
            }</td>
            <td style="border: 1px solid #ddd; padding: 8px;">${r.comment}</td>
          </tr>`;
        })
        .join("")}
    </tbody>
  </table>

  <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
  <p style="color: #666; font-size: 12px;">Best regards,<br>DeltaInfoSoft</p>
</div>
`;

    // 4️⃣ Send email to all associated emails
    for (const email of entry.emails) {
      await sendEmail({
        email,
        subject: `IP PORT Log Report - ${entry.ip}:${entry.port}`,
        message: textMessage,
        html: htmlMessage,
      });
    }

    return NextResponse.json(
      { success: true, message: "Emails sent successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error sending entry log email:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error", error: error.message },
      { status: 500 }
    );
  }
}
