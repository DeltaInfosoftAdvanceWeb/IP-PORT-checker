import { NextResponse } from "next/server";
import UserData from "../../../modals/userSchema";
import { connectToDatabase } from "../../../../dbConfig";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

export async function POST(req) {
  try {
    await connectToDatabase();

    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        {
          success: false,
          message: "Please provide both email and password",
        },
        { status: 400 }
      );
    }

    const existingUser = await UserData.findOne({ email });

    if (!existingUser) {
      return NextResponse.json(
        {
          success: false,
          message: "User not found with provided email",
        },
        { status: 404 }
      );
    }

    const isValidPass = await bcrypt.compare(password, existingUser.password);

    if (!isValidPass) {
      return NextResponse.json({
        sucess: false,
        message: "Incorrect Password",
      });
    }

    const tokenExpiry = 7 * 24 * 60 * 60 * 1000;

    const token = jwt.sign(
      {
        userId: existingUser._id,
        username: existingUser.username,
        email: existingUser.email,
      },
      process.env.JWT_SECRET,
      { expiresIn: tokenExpiry }
    );

    const response = NextResponse.json(
      {
        message: "Login successful",
        status: 200,
        authToken: token,
        user: {
          id: existingUser._id,
          username: existingUser.name,
          email: existingUser.email,
        },
      },
      { status: 200 }
    );

    response.cookies.set("authToken", token, {
      //   httpOnly: true,
      // secure: process.env.NODE_ENV === "production",
      maxAge: tokenExpiry,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Error in login process:", error);
    return NextResponse.json(
      {
        message: "An error occurred during login.",
        status: 500,
      },
      { status: 500 }
    );
  }
}
