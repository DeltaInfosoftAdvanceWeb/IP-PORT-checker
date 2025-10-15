import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const { accessCode } = await req.json();

    if (!accessCode) {
      return NextResponse.json(
        { success: false, message: "Access code is required." },
        { status: 400 }
      );
    }

    // Verify access code against the hardcoded value in environment variable
    const VALID_ACCESS_CODE = process.env.SIGNUP_ACCESS_CODE;

    if (accessCode === VALID_ACCESS_CODE) {
      return NextResponse.json(
        {
          success: true,
          message: "Access code verified successfully.",
        },
        { status: 200 }
      );
    } else {
      return NextResponse.json(
        { success: false, message: "Invalid access code." },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error("Access code verification error:", error);
    return NextResponse.json(
      { success: false, message: "Server error during verification. Please try again later." },
      { status: 500 }
    );
  }
}
