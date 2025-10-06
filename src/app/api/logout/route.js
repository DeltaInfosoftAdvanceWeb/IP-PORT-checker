import { NextResponse } from "next/server";

export async function GET() {
  try {
    const response = NextResponse.json(
      {
        message: "Logout successful",
        status: 200,
        user: {},
      },
      { status: 200 }
    );

    response.cookies.set("authToken", "", {
      //   httpOnly: true,
      // secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 24 * 7,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Error in logout process:", error);
    return NextResponse.json(
      {
        message: "An error occurred during logout.",
        status: 500,
      },
      { status: 500 }
    );
  }
}
