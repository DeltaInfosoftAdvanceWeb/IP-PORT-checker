import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

const sendEmail = async (options) => {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: false,
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    const mailOptions = {
      from: `${process.env.EMAIL_FROM_NAME}<${process.env.EMAIL_FROM}>`,
      to: options.email,
      subject: options.subject,
      text: options.message,
      html: options.html,
    };

    await transporter.sendMail(mailOptions);

    return NextResponse.json(
      { success: true, message: "Email sent" },
      { status: 200 }
    );
  } catch (error) {
    console.log(error);
    return NextResponse.json(
      { success: false, message: "send mail error" },
      { status: 500 }
    );
  }
};

export default sendEmail;
