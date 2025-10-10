import { NextResponse } from "next/server";
import { connectToDatabase } from "../../../../../dbConfig";
import IPPortConfig from "../../../../modals/ipPortConfigSchema.js";

export async function POST(req) {
  try {
    await connectToDatabase();
    const token = req.cookies.get("authToken")?.value;

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          message: "Authentication required. Please login first.",
        },
        { status: 401 }
      );
    }

    const { entries, configName, configId } = await req.json();

    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Please Enter IP/PORT for Update",
        },
        { status: 400 }
      );
    }

    if (!configName || !configId) {
      return NextResponse.json(
        {
          success: false,
          message: "ConfigName and Id both Required",
        },
        { status: 400 }
      );
    }

    const isValid = entries.every(
      (entry) =>
        entry.ip &&
        entry.port &&
        entry.ip.trim() !== "" &&
        entry.port.trim() !== ""
    );

    if (!isValid) {
      return NextResponse.json(
        { success: false, message: "Entries must have both Ip and Port" },
        { status: 400 }
      );
    }

    const portReferenceMap = {
      80: "http",
      443: "https",
      21: "ftp",
      22: "ssh",
      25: "smtp",
      110: "pop3",
      143: "imap",
      3306: "mysql",
      5432: "postgresql",
      6379: "redis",
      27017: "mongodb",
      5000: "local dev",
      8000: "dev server",
    };

    const cleanedEntries = entries.map(({ ip, port }) => {
      const trimmedPort = port.trim();
      const referPortName = portReferenceMap[trimmedPort] || "custom";
      return {
        ip: ip.trim(),
        port: trimmedPort,
        referPortName,
      };
    });

    const updateConfig = await IPPortConfig.findByIdAndUpdate(
      configId,
      {
        $set: {
          configName,
          entries: cleanedEntries,
        },
      },
      { new: true }
    );

    console.log("updateConfig", updateConfig);

    return NextResponse.json(
      {
        success: true,
        message: "Ip/Port updated successfully",
        updateConfig,
      },
      { status: 201 }
    );
  } catch (error) {
    console.log(error);
    return NextResponse.json(
      { success: false, message: "Failed to update" },
      { status: 500 }
    );
  }
}
