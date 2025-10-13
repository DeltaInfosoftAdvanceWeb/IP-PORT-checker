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

    const { entries, configId, entryId } = await req.json();

    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Please Enter IP/PORT for Update",
        },
        { status: 400 }
      );
    }

    if (!entryId || !configId) {
      return NextResponse.json(
        {
          success: false,
          message: "entryId and configId both Required",
        },
        { status: 400 }
      );
    }

    const isValid = entries.every(
      (entry) =>
        entry.ip &&
        entry.port &&
        entry.referPortName &&
        entry.referPortName.trim() !== "" &&
        entry.ip.trim() !== "" &&
        entry.port.trim() !== ""
    );

    if (!isValid) {
      return NextResponse.json(
        { success: false, message: "Entries must have both Ip and Port" },
        { status: 400 }
      );
    }

    const updateConfig = await IPPortConfig.findOneAndUpdate(
      { _id: configId, "entries._id": entryId },
      {
        $set: {
          "entries.$.ip": entries[0].ip,
          "entries.$.port": entries[0].port,
          "entries.$.referPortName": entries[0].referPortName,
        },
      },
      { new: true }
    );

    if (!updateConfig) {
      return NextResponse.json(
        { success: false, message: "Entry not found or failed to update" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Ip/Port updated successfully",
        updateConfig
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
