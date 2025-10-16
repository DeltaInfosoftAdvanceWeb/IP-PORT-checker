import { NextResponse } from "next/server";
import { connectToDatabase } from "../../../../../../dbConfig";
import IPPortCheckedLog from "../../../../../modals/checkedLogSchema";
import * as XLSX from "xlsx-js-style";

export async function GET(req) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const entryId = searchParams.get("entryId");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    if (!entryId) {
      return NextResponse.json(
        { success: false, message: "entryId is required." },
        { status: 400 }
      );
    }

    // Fetch logs for the entry
    const logDoc = await IPPortCheckedLog.findOne({ entryId });

    if (!logDoc || !logDoc.logs || logDoc.logs.length === 0) {
      return NextResponse.json(
        { success: false, message: "No logs found for this entry." },
        { status: 404 }
      );
    }

    // Filter logs by date range if provided
    let logs = logDoc.logs;
    if (from && to) {
      const fromDate = new Date(from);
      const toDate = new Date(to);

      logs = logs.filter((log) => {
        const checkedAt = new Date(log.checkedAt);
        return checkedAt >= fromDate && checkedAt <= toDate;
      });

      if (!logs.length) {
        return NextResponse.json(
          { success: false, message: "No logs found for this date range." },
          { status: 404 }
        );
      }
    }

    // Prepare data for Excel
    const rows = logs.map((log, index) => ({
      "S.No": index + 1,
      "IP": logDoc.ip,
      "Port": logDoc.port,
      "Refer Port Name": logDoc.referPortName || "-",
      "Status": log.status || "-",
      "Response Time (ms)": log.responseTime ?? "-",
      "Checked At": new Date(log.checkedAt).toLocaleString(),
    }));

    // Create workbook & worksheet
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Logs");

    // Apply background color for status cells
    const range = XLSX.utils.decode_range(worksheet["!ref"]);
    const statusColIndex = 4; // "Status" column (0-based: A=0, B=1, C=2, D=3, E=4)

    for (let R = range.s.r + 1; R <= range.e.r; ++R) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: statusColIndex });
      const cell = worksheet[cellAddress];
      if (cell && cell.v) {
        let fillColor = "FFFFFF"; // default white
        if (cell.v.toLowerCase() === "online") fillColor = "C6EFCE"; // light green
        else if (cell.v.toLowerCase() === "offline") fillColor = "FFC7CE"; // light red
        else if (cell.v.toLowerCase() === "timeout") fillColor = "FFEB9C"; // light yellow

        cell.s = {
          fill: { fgColor: { rgb: fillColor } },
          font: {
            bold: true,
            color: { rgb: "000000" },
          },
          alignment: {
            vertical: "center",
            horizontal: "center",
          },
        };
      }
    }

    // Generate Excel buffer
    const excelBuffer = XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
      cellStyles: true,
    });

    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename=logs_${entryId}.xlsx`,
      },
    });
  } catch (error) {
    console.error("Error exporting logs:", error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
