"use client";
import React, { useState, useEffect } from "react";
import { Modal, DatePicker, Select, Button, Spin } from "antd";
import { Line, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { LoaderCircle, Calendar, TrendingUp } from "lucide-react";
import toast from "react-hot-toast";
import dayjs from "dayjs";

const { RangePicker } = DatePicker;
const { Option } = Select;

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const ChartModal = ({ visible, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [chartData, setChartData] = useState([]);
  const [dateRange, setDateRange] = useState([null, null]);
  const [preset, setPreset] = useState("all");
  const [chartType, setChartType] = useState("area");
  const [configurations, setConfigurations] = useState([]);
  const [selectedConfig, setSelectedConfig] = useState("all");
  const [dataType, setDataType] = useState("responseTime"); // "status" or "responseTime"

  const formatDateTime = (date, withTime = true) => {
    if (!date) return "-";

    try {
      const d = new Date(date);

      const options = {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
        year: "numeric",
      };

      if (withTime) {
        options.hour = "2-digit";
        options.minute = "2-digit";
        options.hour12 = false;
      }

      const formatted = d.toLocaleString("en-GB", options);
      return formatted.replace(",", "").replace(/\s/g, " ");
    } catch (error) {
      console.error("Error formatting date:", error);
      return "Date error";
    }
  };

  const fetchConfigurations = async () => {
    try {
      const response = await fetch("/api/ip-port-config/get");
      const result = await response.json();

      if (result.success) {
        // Flatten all entries from all configs
        const allEntries = result.data.flatMap((config) =>
          config.entries.map((entry) => ({
            _id: entry._id,
            ip: entry.ip,
            port: entry.port,
            referPortName: entry.referPortName,
          }))
        );
        setConfigurations(allEntries);
      }
    } catch (error) {
      console.error("Error fetching configurations:", error);
    }
  };

  const fetchLogs = async (startDate = null, endDate = null, entryId = null) => {
    setLoading(true);
    try {
      const response = await fetch("/api/ip-port-config/logs-chart", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          startDate: startDate ? startDate.toISOString() : null,
          endDate: endDate ? endDate.toISOString() : null,
          entryId: entryId || selectedConfig,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setChartData(result.data);
        toast.success(`Loaded ${result.count} log entries`);
      } else {
        toast.error(result.message || "Failed to fetch logs");
      }
    } catch (error) {
      console.error("Error fetching logs:", error);
      toast.error("Failed to fetch logs");
    } finally {
      setLoading(false);
    }
  };

  const handlePresetChange = (value) => {
    setPreset(value);
    const now = dayjs();
    let start = null;
    let end = now;

    switch (value) {
      case "today":
        start = now.startOf("day");
        break;
      case "yesterday":
        start = now.subtract(1, "day").startOf("day");
        end = now.subtract(1, "day").endOf("day");
        break;
      case "last7days":
        start = now.subtract(7, "days").startOf("day");
        break;
      case "last30days":
        start = now.subtract(30, "days").startOf("day");
        break;
      case "thisMonth":
        start = now.startOf("month");
        break;
      case "lastMonth":
        start = now.subtract(1, "month").startOf("month");
        end = now.subtract(1, "month").endOf("month");
        break;
      case "all":
      default:
        start = null;
        end = null;
        break;
    }

    if (start && end) {
      setDateRange([start, end]);
      fetchLogs(start, end);
    } else if (start) {
      setDateRange([start, now]);
      fetchLogs(start, now);
    } else {
      setDateRange([null, null]);
      fetchLogs(null, null);
    }
  };

  const handleDateRangeChange = (dates) => {
    setDateRange(dates);
    if (dates && dates[0] && dates[1]) {
      setPreset("custom");
      fetchLogs(dates[0], dates[1]);
    }
  };

  useEffect(() => {
    if (visible) {
      fetchConfigurations();
      fetchLogs();
    }
  }, [visible]);

  const handleConfigChange = (value) => {
    setSelectedConfig(value);
    fetchLogs(dateRange[0], dateRange[1], value);
  };

  // Prepare chart data
  const prepareChartData = () => {
    // Group by endpoint (ip:port)
    const groupedData = {};

    chartData.forEach((log) => {
      const key = `${log.ip}:${log.port}`;
      if (!groupedData[key]) {
        groupedData[key] = {
          label: `${log.referPortName || key}`,
          online: [],
          offline: [],
          timestamps: [],
          responseTimes: [],
        };
      }

      const timestamp = formatDateTime(log.checkedAt);
      groupedData[key].timestamps.push(timestamp);

      if (log.status === "online") {
        groupedData[key].online.push(1);
        groupedData[key].offline.push(0);
        groupedData[key].responseTimes.push(log.responseTime || 0);
      } else {
        groupedData[key].online.push(0);
        groupedData[key].offline.push(1);
        groupedData[key].responseTimes.push(0);
      }
    });

    // Get all unique timestamps
    const allTimestamps = [
      ...new Set(chartData.map((log) => formatDateTime(log.checkedAt))),
    ].sort();

    // Create datasets
    const datasets = [];
    const colors = [
      { border: "#1ca5b3", bg: "rgba(28, 165, 179, 0.1)" },
      { border: "#10b981", bg: "rgba(16, 185, 129, 0.1)" },
      { border: "#f59e0b", bg: "rgba(245, 158, 11, 0.1)" },
      { border: "#ef4444", bg: "rgba(239, 68, 68, 0.1)" },
      { border: "#8b5cf6", bg: "rgba(139, 92, 246, 0.1)" },
      { border: "#ec4899", bg: "rgba(236, 72, 153, 0.1)" },
    ];

    Object.entries(groupedData).forEach(([key, data], index) => {
      const color = colors[index % colors.length];
      datasets.push({
        label: data.label,
        data: data.online,
        borderColor: color.border,
        backgroundColor: color.bg,
        fill: true,
        tension: 0.4,
      });
    });

    return {
      labels: allTimestamps.slice(-50), // Show last 50 timestamps
      datasets: datasets.map((ds) => ({
        ...ds,
        data: ds.data.slice(-50),
      })),
    };
  };

  // Prepare area chart data with enhanced fills
  const prepareAreaChartData = () => {
    const groupedData = {};

    chartData.forEach((log) => {
      const key = `${log.ip}:${log.port}`;
      if (!groupedData[key]) {
        groupedData[key] = {
          label: `${log.referPortName || key}`,
          online: [],
          offline: [],
          timestamps: [],
          responseTimes: [],
        };
      }

      const timestamp = formatDateTime(log.checkedAt);
      groupedData[key].timestamps.push(timestamp);

      if (log.status === "online") {
        groupedData[key].online.push(1);
        groupedData[key].offline.push(0);
        groupedData[key].responseTimes.push(log.responseTime || 0);
      } else {
        groupedData[key].online.push(0);
        groupedData[key].offline.push(1);
        groupedData[key].responseTimes.push(0);
      }
    });

    const allTimestamps = [
      ...new Set(chartData.map((log) => formatDateTime(log.checkedAt))),
    ].sort();

    const datasets = [];
    const colors = [
      { border: "#1ca5b3", bg: "rgba(28, 165, 179, 0.5)" },
      { border: "#10b981", bg: "rgba(16, 185, 129, 0.5)" },
      { border: "#f59e0b", bg: "rgba(245, 158, 11, 0.5)" },
      { border: "#ef4444", bg: "rgba(239, 68, 68, 0.5)" },
      { border: "#8b5cf6", bg: "rgba(139, 92, 246, 0.5)" },
      { border: "#ec4899", bg: "rgba(236, 72, 153, 0.5)" },
    ];

    Object.entries(groupedData).forEach(([key, data], index) => {
      const color = colors[index % colors.length];
      datasets.push({
        label: data.label,
        data: data.online,
        borderColor: color.border,
        backgroundColor: color.bg,
        fill: true,
        tension: 0.4,
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 5,
      });
    });

    return {
      labels: allTimestamps.slice(-50),
      datasets: datasets.map((ds) => ({
        ...ds,
        data: ds.data.slice(-50),
      })),
    };
  };

  // Prepare response time chart data
  const prepareResponseTimeData = () => {
    const groupedData = {};

    chartData.forEach((log) => {
      const key = `${log.ip}:${log.port}`;
      if (!groupedData[key]) {
        groupedData[key] = {
          label: `${log.referPortName || key}`,
          responseTimes: [],
          timestamps: [],
          statuses: [],
        };
      }

      const timestamp = formatDateTime(log.checkedAt);
      groupedData[key].timestamps.push(timestamp);
      groupedData[key].responseTimes.push(log.responseTime || 0);
      groupedData[key].statuses.push(log.status);
    });

    const allTimestamps = [
      ...new Set(chartData.map((log) => formatDateTime(log.checkedAt))),
    ].sort();

    const datasets = [];
    const colors = [
      { border: "#1ca5b3", bg: "rgba(28, 165, 179, 0.5)" },
      { border: "#10b981", bg: "rgba(16, 185, 129, 0.5)" },
      { border: "#f59e0b", bg: "rgba(245, 158, 11, 0.5)" },
      { border: "#ef4444", bg: "rgba(239, 68, 68, 0.5)" },
      { border: "#8b5cf6", bg: "rgba(139, 92, 246, 0.5)" },
      { border: "#ec4899", bg: "rgba(236, 72, 153, 0.5)" },
    ];

    Object.entries(groupedData).forEach(([key, data], index) => {
      const color = colors[index % colors.length];

      // Create point colors array - red for offline (0 response time), normal color for online
      const pointBackgroundColors = data.responseTimes.map((rt, idx) =>
        rt === 0 || data.statuses[idx] === "offline" ? "#ef4444" : color.border
      );

      const pointBorderColors = data.responseTimes.map((rt, idx) =>
        rt === 0 || data.statuses[idx] === "offline" ? "#dc2626" : color.border
      );

      datasets.push({
        label: data.label,
        data: data.responseTimes,
        borderColor: color.border,
        backgroundColor: color.bg,
        fill: chartType === "area",
        tension: 0.4,
        borderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: pointBackgroundColors,
        pointBorderColor: pointBorderColors,
        pointBorderWidth: 2,
      });
    });

    return {
      labels: allTimestamps.slice(-50),
      datasets: datasets.map((ds) => ({
        ...ds,
        data: ds.data.slice(-50),
        pointBackgroundColor: Array.isArray(ds.pointBackgroundColor)
          ? ds.pointBackgroundColor.slice(-50)
          : ds.pointBackgroundColor,
        pointBorderColor: Array.isArray(ds.pointBorderColor)
          ? ds.pointBorderColor.slice(-50)
          : ds.pointBorderColor,
      })),
    };
  };

  // Prepare status distribution chart
  const prepareStatusChart = () => {
    const statusCount = { online: 0, offline: 0 };

    chartData.forEach((log) => {
      statusCount[log.status]++;
    });

    return {
      labels: ["Online", "Offline"],
      datasets: [
        {
          label: "Status Count",
          data: [statusCount.online, statusCount.offline],
          backgroundColor: [
            "rgba(16, 185, 129, 0.8)",
            "rgba(239, 68, 68, 0.8)",
          ],
          borderColor: ["#10b981", "#ef4444"],
          borderWidth: 2,
        },
      ],
    };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top",
      },
      title: {
        display: true,
        text: "IP/Port Status Over Time",
        font: {
          size: 16,
          weight: "bold",
        },
      },
      tooltip: {
        mode: "index",
        intersect: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 1,
        ticks: {
          stepSize: 1,
          callback: function (value) {
            return value === 1 ? "Online" : "Offline";
          },
        },
      },
      x: {
        ticks: {
          maxRotation: 45,
          minRotation: 45,
        },
      },
    },
  };

  const areaChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top",
      },
      title: {
        display: true,
        text: "IP/Port Status Over Time (Area)",
        font: {
          size: 16,
          weight: "bold",
        },
      },
      tooltip: {
        mode: "index",
        intersect: false,
      },
      filler: {
        propagate: false,
      },
    },
    interaction: {
      intersect: false,
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 1,
        ticks: {
          stepSize: 1,
          callback: function (value) {
            return value === 1 ? "Online" : "Offline";
          },
        },
      },
      x: {
        ticks: {
          maxRotation: 45,
          minRotation: 45,
        },
      },
    },
  };

  const responseTimeChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top",
      },
      title: {
        display: true,
        text: "Response Time Over Time (Red dots = Offline)",
        font: {
          size: 16,
          weight: "bold",
        },
      },
      tooltip: {
        mode: "index",
        intersect: false,
        callbacks: {
          label: function (context) {
            const value = context.parsed.y;
            const status = value === 0 ? "Offline" : "Online";
            const statusColor = value === 0 ? "🔴" : "🟢";
            return `${statusColor} ${context.dataset.label}: ${value}ms (${status})`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: "Response Time (ms)",
        },
      },
      x: {
        ticks: {
          maxRotation: 45,
          minRotation: 45,
        },
      },
    },
  };

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: true,
        text: "Status Distribution",
        font: {
          size: 16,
          weight: "bold",
        },
      },
    },
  };

  return (
    <Modal
      title={
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-[#1ca5b3]" />
          <span>Logs Chart Analytics</span>
        </div>
      }
      open={visible}
      onCancel={onClose}
      width={1200}
      footer={null}
      className="chart-modal"
    >
      <div className="space-y-4">
        {/* Filters */}
        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Configuration
              </label>
              <Select
                value={selectedConfig}
                onChange={handleConfigChange}
                className="w-full"
                showSearch
                optionFilterProp="children"
                placeholder="Select configuration"
              >
                <Option value="all">All Configurations</Option>
                {configurations.map((config) => (
                  <Option key={config._id} value={config._id}>
                    {config.referPortName || `${config.ip}:${config.port}`}
                  </Option>
                ))}
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data Type
              </label>
              <Select
                value={dataType}
                onChange={setDataType}
                className="w-full"
              >
                <Option value="status">Status (Online/Offline)</Option>
                <Option value="responseTime">Response Time</Option>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                Date Range
              </label>
              <RangePicker
                value={dateRange}
                onChange={handleDateRangeChange}
                className="w-full"
                format="DD MMM YYYY"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quick Presets
              </label>
              <Select
                value={preset}
                onChange={handlePresetChange}
                className="w-full"
              >
                <Option value="all">All Time</Option>
                <Option value="today">Today</Option>
                <Option value="yesterday">Yesterday</Option>
                <Option value="last7days">Last 7 Days</Option>
                <Option value="last30days">Last 30 Days</Option>
                <Option value="thisMonth">This Month</Option>
                <Option value="lastMonth">Last Month</Option>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Chart Type
              </label>
              <Select
                value={chartType}
                onChange={setChartType}
                className="w-full"
              >
                <Option value="line">Line Chart</Option>
                <Option value="area">Area Chart</Option>
                <Option value="bar">Bar Chart (Distribution)</Option>
              </Select>
            </div>
          </div>

          <div className="mt-4 flex justify-between items-center">
            <div className="text-sm text-gray-600">
              Total Logs: <span className="font-bold">{chartData.length}</span>
            </div>
            <Button
              onClick={() => fetchLogs(dateRange[0], dateRange[1])}
              loading={loading}
              type="primary"
              className="bg-[#1ca5b3]"
            >
              Refresh Data
            </Button>
          </div>
        </div>

        {/* Charts */}
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <Spin
              size="large"
              indicator={
                <LoaderCircle className="animate-spin" color="#1ca5b3" />
              }
            />
          </div>
        ) : chartData.length === 0 ? (
          <div className="text-center py-20">
            <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-lg text-gray-500 font-medium">No logs found</p>
            <p className="text-sm text-gray-400 mt-2">
              Try selecting a different date range
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {dataType === "responseTime" ? (
              <div className="bg-white p-6 rounded-xl border border-gray-200">
                <div style={{ height: "400px" }}>
                  <Line
                    data={prepareResponseTimeData()}
                    options={responseTimeChartOptions}
                  />
                </div>
              </div>
            ) : chartType === "line" ? (
              <div className="bg-white p-6 rounded-xl border border-gray-200">
                <div style={{ height: "400px" }}>
                  <Line data={prepareChartData()} options={chartOptions} />
                </div>
              </div>
            ) : chartType === "area" ? (
              <div className="bg-white p-6 rounded-xl border border-gray-200">
                <div style={{ height: "400px" }}>
                  <Line data={prepareAreaChartData()} options={areaChartOptions} />
                </div>
              </div>
            ) : (
              <div className="bg-white p-6 rounded-xl border border-gray-200">
                <div style={{ height: "400px" }}>
                  <Bar data={prepareStatusChart()} options={barChartOptions} />
                </div>
              </div>
            )}

            {/* Stats Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-6 text-white">
                <p className="text-sm opacity-90 mb-1">Online Checks</p>
                <p className="text-3xl font-bold">
                  {chartData.filter((log) => log.status === "online").length}
                </p>
              </div>
              <div className="bg-gradient-to-br from-red-500 to-rose-600 rounded-xl p-6 text-white">
                <p className="text-sm opacity-90 mb-1">Offline Checks</p>
                <p className="text-3xl font-bold">
                  {chartData.filter((log) => log.status === "offline").length}
                </p>
              </div>
              <div className="bg-gradient-to-br from-[#1ca5b3] to-[#0e7c87] rounded-xl p-6 text-white">
                <p className="text-sm opacity-90 mb-1">Avg Response Time</p>
                <p className="text-3xl font-bold">
                  {chartData.filter((log) => log.responseTime).length > 0
                    ? Math.round(
                        chartData
                          .filter((log) => log.responseTime)
                          .reduce((acc, log) => acc + log.responseTime, 0) /
                          chartData.filter((log) => log.responseTime).length
                      )
                    : 0}
                  ms
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default ChartModal;
