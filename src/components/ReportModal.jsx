"use client";

import { X, FileSpreadsheet } from "lucide-react";
import { useState } from "react";
import { toast } from "react-hot-toast";
import dayjs from "dayjs";
import { Button } from "./ui/button";
import { DatePicker } from "antd";

const { RangePicker } = DatePicker;

const quickOptions = [
  { label: "Last 10 days", days: 10 },
  { label: "Last 15 days", days: 15 },
  { label: "Last 1 month", months: 1 },
  { label: "Last 2 months", months: 2 },
  { label: "Last 3 months", months: 3 },
  { label: "Last 6 months", months: 6 },
];

const ReportModal = ({ visible, onClose, entry, onGenerate }) => {
  const [range, setRange] = useState([null, null]);

  const handleGenerate = () => {
    const [from, to] = range;
    if (!from || !to) {
      toast.error("Please select a valid date range");
      return;
    }

    const firstLogDate = entry.logs?.[0]?.checkedAt
      ? dayjs(entry.logs[0].checkedAt)
      : null;
    const now = dayjs();

    if (firstLogDate && from.isBefore(firstLogDate)) {
      toast.error(
        `Start date cannot be before first log: ${firstLogDate.format(
          "YYYY-MM-DD"
        )}`
      );
      return;
    }

    if (to.isAfter(now)) {
      toast.error("End date cannot be in the future");
      return;
    }

    onGenerate(from.toISOString(), to.toISOString());
    onClose();
  };

  const applyQuickRange = (option) => {
    const end = dayjs();
    let start;
    if (option.days) {
      start = end.subtract(option.days, "day");
    } else if (option.months) {
      start = end.subtract(option.months, "month");
    }
    setRange([start, end]);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-8 border border-gray-200 flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#1ca5b3] to-[#0e7c87] p-6 rounded-t-2xl flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 backdrop-blur-sm p-3 rounded-xl">
              <FileSpreadsheet className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Generate Report</h2>
              <p className="text-white/80 text-sm mt-1">
                Logs for {entry.ip}:{entry.port}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white hover:bg-white/20 p-2 rounded-lg transition-all"
          >
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex-1 space-y-4">
          <p className="text-gray-700 font-medium">Select the date range:</p>

          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <RangePicker
              value={range}
              onChange={(dates) => setRange(dates)}
              showTime
              disabledDate={(current) =>
                current && current > dayjs().endOf("day")
              }
              className="w-full rounded-lg border-gray-300 focus:border-[#1ca5b3] focus:ring-2 focus:ring-[#1ca5b3]/20"
            />
          </div>

          {/* Quick select buttons */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 mb-2">
            {quickOptions.map((opt) => (
              <Button
                key={opt.label}
                onClick={() => applyQuickRange(opt)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm px-3 py-1 rounded-md"
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50 rounded-b-2xl flex justify-end gap-3 flex-shrink-0">
          <Button
            onClick={onClose}
            className="bg-white border-2 border-gray-300 text-gray-700 hover:bg-gray-50 px-6 py-2 font-medium"
          >
            Cancel
          </Button>
          <Button
            onClick={handleGenerate}
            className="bg-gradient-to-r from-[#1ca5b3] to-[#0e7c87] hover:from-[#0e7c87] hover:to-[#1ca5b3] text-white px-6 py-2 font-medium shadow-lg shadow-[#1ca5b3]/30"
          >
            Generate Report
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ReportModal;
