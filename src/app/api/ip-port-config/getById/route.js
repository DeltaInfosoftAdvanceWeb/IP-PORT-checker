import { NextResponse } from "next/server";
import IPPortConfig from "../../../../modals/ipPortConfigSchema.js";
import { connectToDatabase } from "../../../../../dbConfig";

export async function POST(req) {
  try {
    await connectToDatabase();
    const { configId, entryId } = await req.json();

    if (!configId || !entryId) {
      return NextResponse.json({
        success: false,
        message: "ConfigId and entryId required.",
      });
    }
    const IpConfigData = await IPPortConfig.findById(configId);
    if (!IpConfigData) {
      return NextResponse.json(
        { success: false, message: "No config found." },
        { status: 404 }
      );
    }

    const entry = IpConfigData?.entries.find(
      (e) => e._id.toString() === entryId
    );
    
    if (!entry) {
      return Response.json({ success: false, message: "Entry not found" });
    }

    return NextResponse.json(
      { success: true, IpConfigData: entry },
      { status: 200 }
    );
  } catch (error) {
    console.log("Update Error:", error);
    return NextResponse.json(
      { success: false, message: "Error while updating ipconfig" },
      { status: 500 }
    );
  }
}
