// import RequestedUser from "../../../modals/requestedUserSchema";
import nodemailer from "nodemailer";
import UserData from "../../../modals/userSchema";
import { connectToDatabase } from "../../../../dbConfig";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export async function POST(req) {
  try {
    await connectToDatabase();

    const { username, email, password } = await req.json();

    if (!username || !email || !password) {
      return NextResponse.json(
        { message: "All fields are required." },
        { status: 400 }
      );
    }

    const existingUser = await UserData.findOne({ email });

    if (existingUser) {
      return NextResponse.json(
        { success: false, message: "User is already exists with same email" },
        { status: 400 }
      );
    }

    const hashPass = await bcrypt.hash(password, 12);

    const newUser = await UserData.create({
      username,
      email,
      password: hashPass,
    });

    await newUser.save();

    return NextResponse.json(
      {
        success: true,
        message: "User Registered Successfully.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { message: "Server error during signup. Please try again later." },
      { status: 500 }
    );
  }
}

