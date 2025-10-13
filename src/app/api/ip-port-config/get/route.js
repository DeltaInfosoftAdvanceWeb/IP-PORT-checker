import { NextResponse } from "next/server";
import IPPortConfig from "../../../../modals/ipPortConfigSchema.js";
import { connectToDatabase } from '../../../../../dbConfig'
import jwt from "jsonwebtoken";

export async function GET(req) {
  try {
    await connectToDatabase();

    const token = req.cookies.get("authToken")?.value;

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          message: "Authentication required",
        },
        { status: 401 }
      );
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    // Get all configurations for this user
    const configs = await IPPortConfig.find({}).sort({ createdAt: -1 });

    return NextResponse.json(
      {
        success: true,
        data: configs,
        count: configs.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching IP/Port configurations:", error);
    return NextResponse.json(
      {
        success: false,
        message: "An error occurred while fetching configurations",
      },
      { status: 500 }
    );
  }
}