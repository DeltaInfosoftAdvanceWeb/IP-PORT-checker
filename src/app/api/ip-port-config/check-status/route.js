import { NextResponse } from "next/server";
import net from "net";
import sendEmail from "@/lib/sendEmail.js";
import jwt from "jsonwebtoken";

const sendEmailToUser = async (token, results) => {
  if (token) {
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    let { email, username } = decodedToken;

    const message = `
Hi ${username || "User"},

You requested an IP PORT configure list. Here is your requested info:

| IP Address     | Port  | Checked At           | Request Time         | Status      |
|----------------|-------|--------------------|--------------------|------------|
${results
  .map(
    (r) =>
      `${r.ip}\t${r.port}\t${r.checkedAt}\t${new Date().toISOString()}\t${
        r.status
      }`
  )
  .join("\n")}

If you didn't request this, please ignore this email.

Best regards,
DeltaInfoSoft
`;

    const formatDateTime = (date) => {
      const d = new Date(date);
      const pad = (n) => n.toString().padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
        d.getDate()
      )} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    };

    const requestedTime = new Date();

    const htmlMessage = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #333;">IP PORT Config Info</h2>
  <p>Hi ${username || "User"},</p>
  <p>You requested an IP PORT configure list at <strong>${formatDateTime(
    requestedTime
  )}</strong>. Here is your requested info:</p>

  <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
    <thead>
      <tr>
        <th style="border: 1px solid #ddd; padding: 8px;">IP Address</th>
        <th style="border: 1px solid #ddd; padding: 8px;">Port</th>
        <th style="border: 1px solid #ddd; padding: 8px;">Checked At</th>
        <th style="border: 1px solid #ddd; padding: 8px;">Status</th>
      </tr>
    </thead>
    <tbody>
      ${results
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
              <td style="border: 1px solid #ddd; padding: 8px;">${formatDateTime(
                r.checkedAt
              )}</td>
              <td style="border: 1px solid #ddd; padding: 8px; color:${color}; font-weight: bold;">${
            r.status
          }</td>
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
      sendEmail({
        email,
        subject: "IP PORT Config Info.",
        message,
        html: htmlMessage,
      });
    } catch (error) {
      console.log(error);
    }
  }
};


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
    const token = await req.cookies.get("authToken")?.value;
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

    // sendEmailToUser(token, results);

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
