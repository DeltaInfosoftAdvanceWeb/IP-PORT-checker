import { NextResponse } from "next/server";
import IPPortConfig from "../../../../modals/ipPortConfigSchema.js";
import { connectToDatabase } from "../../../../../dbConfig";

export async function POST(req) {
  try {
    await connectToDatabase();
    const { configId } = await req.json();
    if (!configId) {
      return NextResponse.json({
        success: false,
        message: "ConfigId required.",
      });
    }
    const IpConfigData = await IPPortConfig.findById(configId);
    if (!IpConfigData) {
      return NextResponse.json(
        { success: false, message: "No config found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, IpConfigData }, { status: 200 });
  } catch (error) {
    console.log("Update Error:", error);
    return NextResponse.json(
      { success: false, message: "Error while updating ipconfig" },
      { status: 500 }
    );
  }
}
