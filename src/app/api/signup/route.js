// import RequestedUser from "../../../modals/requestedUserSchema";
import nodemailer from "nodemailer";
import UserData from "../../../modals/userSchema";
import { connectToDatabase } from "../../../../dbConfig";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

// const transporter = nodemailer.createTransport({
//     host: 'smtppro.zoho.com',
//     port: 465,
//     secure: true,
//     auth: {
//         user: 'no-reply@ierp.in',
//         pass: 'Delta@2020',
//     },
// });

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

// async function sendUserEmail(name, username, email) {
//     const mailOptions = {
//         from: "no-reply@ierp.in",
//         to: email,
//         subject: "Access Request Received - Grundfos Pick/Pack module",
//         html: getUserEmailTemplate(name, username, email),
//     }
//     await transporter.sendMail(mailOptions)
// }

// async function sendAdminEmail(name, username, email) {
//     const mailOptions = {
//         from: "no-reply@ierp.in",
//         to: "yogesh@grundfos.com",
//         subject: "New User Access Request - Grundfos Pick/Pack module",
//         html: getAdminEmailTemplate(name, username, email),
//     }
//     await transporter.sendMail(mailOptions)
// }

// // Email templates
// function getUserEmailTemplate(name, username, email) {
//   return `
//         <!DOCTYPE html>
//         <html lang="en">
//         <head>
//             <meta charset="UTF-8">
//             <meta name="viewport" content="width=device-width, initial-scale=1.0">
//             <title>Access Request Status</title>
//             <style>
//                 body {
//                     font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
//                     line-height: 1.6;
//                     color: #333;
//                     max-width: 600px;
//                     margin: 0 auto;
//                     padding: 20px;
//                     background-color: #f4f4f4;
//                 }
//                 .container {
//                     background-color: white;
//                     border-radius: 8px;
//                     box-shadow: 0 4px 6px rgba(0,0,0,0.1);
//                     padding: 30px;
//                 }
//                 h2 {
//                     color: #2c3e50;
//                     border-bottom: 2px solid #3498db;
//                     padding-bottom: 10px;
//                     margin-bottom: 20px;
//                 }
//                 .details {
//                     background-color: #f9f9f9;
//                     border-left: 4px solid #3498db;
//                     padding: 15px;
//                     margin: 20px 0;
//                 }
//                 .footer {
//                     font-size: 6px;
//                     color: #7f8c8d;
//                     text-align: center;
//                     margin-top: 20px;
//                 }
//             </style>
//         </head>
//         <body>
//             <div class="container">
//                 <h2>Hello ${name}</h2>
//                 <p>We have received your request to access the portal. Your request is currently under review.</p>

//                 <div class="details">
//                     <strong>Request Details:</strong>
//                     <p><strong>Employee ID:</strong> ${username}</p>
//                     <p><strong>Email:</strong> ${email}</p>
//                 </div>

//                 <p>You will be notified once your request is processed and a decision has been made.</p>

//                 <div class="footer">
//                     *This is a system-generated email. Please do not reply.*
//                 </div>
//             </div>
//         </body>
//         </html>
//     `;
// }

// function getAdminEmailTemplate(name, username, email) {
//   return `
//        <!DOCTYPE html>
//         <html lang="en">
//         <head>
//             <meta charset="UTF-8">
//             <meta name="viewport" content="width=device-width, initial-scale=1.0">
//             <title>New User Access Request</title>
//             <style>
//                 body {
//                     font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
//                     line-height: 1.6;
//                     color: #333;
//                     max-width: 600px;
//                     margin: 0 auto;
//                     padding: 20px;
//                     background-color: #f4f4f4;
//                 }
//                 .container {
//                     background-color: white;
//                     border-radius: 8px;
//                     box-shadow: 0 4px 6px rgba(0,0,0,0.1);
//                     padding: 30px;
//                 }
//                 h2 {
//                     color: #e74c3c;
//                     border-bottom: 2px solid #e74c3c;
//                     padding-bottom: 10px;
//                     margin-bottom: 20px;
//                 }
//                 .details {
//                     background-color: #f9f9f9;
//                     border-left: 4px solid #e74c3c;
//                     padding: 15px;
//                     margin: 20px 0;
//                 }
//                 .action-button {
//                     display: block;
//                     width: 200px;
//                     margin: 20px auto;
//                     padding: 12px 20px;
//                     background-color: #3498db;
//                     color: white;
//                     text-align: center;
//                     text-decoration: none;
//                     border-radius: 5px;
//                     transition: background-color 0.3s ease;
//                 }
//                 .action-button:hover {
//                     background-color: #2980b9;
//                 }
//                 .footer {
//                     font-size: 5px;
//                     color: #7f8c8d;
//                     text-align: center;
//                     margin-top: 20px;
//                 }
//             </style>
//         </head>
//         <body>
//             <div class="container">
//                 <h2>New User Access Request</h2>

//                 <p>A new user has requested access to the portal. Please review their details:</p>

//                 <div class="details">
//                     <p><strong>Name:</strong> ${name}</p>
//                     <p><strong>Employee ID:</strong> ${username}</p>
//                     <p><strong>Email:</strong> ${email}</p>
//                 </div>

//                 <a href="https://grundfos-pick-pack.vercel.app/" target="_blank" class="action-button">
//                     Review Request
//                 </a>

//                 <div class="footer">
//                     *This is a system-generated email. Please do not reply.*
//                 </div>
//             </div>
//         </body>
//         </html>
//     `;
// }
