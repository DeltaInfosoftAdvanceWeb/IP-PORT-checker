import { NextResponse } from "next/server";
import IPPortCheckedLog from "../../../modals/checkedLogSchema.js";
import jwt from "jsonwebtoken";
import sendEmail from "../../../lib/sendEmail.js";

const formatDateTime = (date, withTime = true) => {
  if (!date) return "-"

  try {
    const dateObj = new Date(date)
    const options = {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
    }

    if (withTime) {
      options.hour = "2-digit"
      options.minute = "2-digit"
      options.hour12 = false
    }

    const formatted = dateObj.toLocaleString("en-GB", options)
    return formatted.replace(",", "").replace(/\s/g, " ")
  } catch (error) {
    console.error("Error formatting date:", error)
    return "Date error"
  }
};

const sendEmailToUser = async (token, logs) => {
  if (!token)
    return NextResponse.json({ success: false, message: "Token missing" });

  const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
  const { email, username } = decodedToken;

  // Flatten all logs (since each document has logs array)
  const allResults = logs.flatMap((doc) => doc.logs);

  const requestedTime = new Date();

  // Combine all IP:Port (referPortName) in one line
  const combinedLine = allResults
    .map((r) => `${r.ip}:${r.port} (${r.referPortName || "custom"})`)
    .join(", ");

  const message = `
Hi ${username || "User"},

You requested an IP PORT configuration report on ${formatDateTime(
    requestedTime
  )}.

Here’s your configuration summary:

| IP Address | Port | Refer Port | Checked At | Status |
|-------------|------|-------------|-------------|---------|
${allResults
      .map(
        (r) =>
          `${r.ip}\t${r.port}\t${r.referPortName || "custom"}\t${formatDateTime(
            r.checkedAt
          )}\t${r.status}`
      )
      .join("\n")}

Summary: ${combinedLine}

Best regards,
DeltaInfoSoft
`;

  const htmlMessage = `
<div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
  <h2 style="color: #333;">IP PORT Configuration Report</h2>
  <p>Hi ${username || "User"},</p>
  <p>You requested an IP PORT configuration list at <strong>${formatDateTime(
    requestedTime
  )}</strong>. Here is your requested information:</p>

  <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
    <thead>
      <tr>
        <th style="border: 1px solid #ddd; padding: 8px;">IP Address</th>
        <th style="border: 1px solid #ddd; padding: 8px;">Port</th>
        <th style="border: 1px solid #ddd; padding: 8px;">Refer Port</th>
        <th style="border: 1px solid #ddd; padding: 8px;">Checked At</th>
        <th style="border: 1px solid #ddd; padding: 8px;">Status</th>
      </tr>
    </thead>
    <tbody>
      ${allResults
      .map((r) => {
        let color;
        switch (r.status) {
          case "online":
            color = "green";
            break;
          case "offline":
            color = "red";
            break;
          case "timeout":
            color = "orange";
            break;
          case "checking":
            color = "blue";
            break;
          default:
            color = "gray";
        }
        return `
            <tr>
              <td style="border: 1px solid #ddd; padding: 8px;">${r.ip}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${r.port}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${r.referPortName || "custom"
          }</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${formatDateTime(
            r.checkedAt
          )}</td>
              <td style="border: 1px solid #ddd; padding: 8px; color:${color}; font-weight: bold;">
                ${r.status}
              </td>
            </tr>
          `;
      })
      .join("")}
    </tbody>
  </table>

 
  <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
  <p style="color: #666; font-size: 12px;">Best regards,<br>DeltaInfoSoft</p>
</div>
`;

  try {
    await sendEmail({
      email,
      subject: "IP PORT Configuration Report",
      message,
      html: htmlMessage,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error sending email:", error);
    return NextResponse.json({ success: false, error: error.message });
  }
};

export async function POST(req) {
  try {
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
    const { sendMail } = await req.json();

    const IPPortCheckedLogs = await IPPortCheckedLog.find({ userId });
    if (!IPPortCheckedLogs || IPPortCheckedLogs.length === 0) {
      return NextResponse.json(
        { success: false, message: "No logs found." },
        { status: 404 }
      );
    }

    if (sendMail === true) {
      await sendEmailToUser(token, IPPortCheckedLogs);
      return NextResponse.json(
        { success: true, message: "Email sent successfully." },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { success: true, message: "Email sent successfully." },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in sendEmail route:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
