"use client";
import React, { useEffect, useState } from "react";
import { Header } from "@/components/Header.jsx";
import {
  Trash2,
  RefreshCw,
  Mail,
  Edit,
  Server,
  Wifi,
  WifiOff,
  Timer,
  Search,
  LoaderCircle,
  LayoutGrid,
  Table,
  BarChart3,
  Database,
} from "lucide-react";
import { Popconfirm, Spin, Select, Input, Collapse } from "antd";
import { ExceptionOutlined, QuestionCircleOutlined } from "@ant-design/icons";
import useIPPortStore from "@/store/useIPPortStore";
import IPPortForm from "@/components/IPPortForm";
import toast from "react-hot-toast";
import ReportModal from "@/components/ReportModal";
import ChartModal from "@/components/ChartModal";
import BackupLogsModal from "@/components/BackupLogsModal";
const { Option } = Select;

const Home = () => {
  const {
    entries,
    isChecking,
    isLoading,
    fetchConfigurations,
    deleteConfiguration,
    checkAllStatus,
    getTotalStats,
    sendEmail,
    isModalOpen,
    openModal,
    openEdit,
    generateReport,
  } = useIPPortStore();

  const [editingEntry, setEditingEntry] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportEntry, setReportEntry] = useState(null);
  const [expandedKeys, setExpandedKeys] = useState([]);
  const [viewMode, setViewMode] = useState("grid"); // "grid" or "table"
  const [chartModalVisible, setChartModalVisible] = useState(false);
  const [backupLogsModalVisible, setBackupLogsModalVisible] = useState(false);

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

  const getStatusColor = (status) =>
    ({
      online: "text-green-600",
      offline: "text-red-600",
      timeout: "text-amber-600",
      checking: "text-blue-600",
    }[status] || "text-gray-500");

  const getBorderColor = (status) =>
    ({
      online: "green",
      offline: "red",
      timeout: "yellow",
      checking: "blue",
    }[status] || "gray");

  const getStatusBgGradient = (status) =>
    ({
      online: "bg-gradient-to-br from-green-50 to-emerald-50 border-green-300",
      offline: "bg-gradient-to-br from-red-50 to-rose-50 border-red-300",
      timeout: "bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-300",
      checking: "bg-gradient-to-br from-blue-50 to-sky-50 border-blue-300",
    }[status] || "bg-gradient-to-br from-gray-50 to-slate-50 border-gray-300");

  const getStatusIcon = (status) =>
    ({
      online: <Wifi className="w-4 h-4" />,
      offline: <WifiOff className="w-4 h-4" />,
      timeout: <Timer className="w-4 h-4" />,
      checking: <RefreshCw className="w-4 h-4 animate-spin" />,
    }[status] || <Server className="w-4 h-4" />);

  const handleEditClick = (configId, entryId) => {
    setEditingEntry({ configId, entryId });
    openEdit();
    openModal();
  };

  useEffect(() => {
    fetchConfigurations();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchConfigurations(true);
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const stats = getTotalStats();

  const handleReportClick = (entry) => {
    setReportEntry(entry);
    setReportModalVisible(true);
  };

  const handleGenerateReport = async (from, to) => {
    try {
      const response = await generateReport(reportEntry, from, to);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ip_port_logs_${reportEntry._id}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      toast.error(err.message);
    }
  };

  const handleExpandAll = () => {
    const allKeys = filteredEntries.map((entry) => entry._id);
    setExpandedKeys(allKeys);
  };

  const handleCollapseAll = () => {
    setExpandedKeys([]);
  };

  const filteredEntries = entries
    .flatMap((config) =>
      config.entries.map((entry) => ({
        ...entry,
        configId: config._id,
      }))
    )
    .filter((entry) => {
      const matchesSearch =
        entry.ip?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.port?.toString().includes(searchTerm) ||
        entry.referPortName?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus =
        statusFilter === "all" || entry.status === statusFilter;

      return matchesSearch && matchesStatus;
    });

  // Prepare collapse items
  const collapseItems = filteredEntries.map((entry) => ({
    key: entry._id,
    label: (
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full">
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${getStatusColor(
            entry.status
          )} bg-white/80 border-2 border-current/20 flex-shrink-0`}
        >
          {getStatusIcon(entry.status)}
          <span className="font-bold uppercase text-xs">
            {entry.status || "unknown"}
          </span>
        </div>

        <div className="flex-1">
          <p className="font-mono text-gray-900 font-semibold text-sm">
            {entry.ip}:{entry.port}
          </p>
          <p className="text-xs text-gray-500">{entry.referPortName || "-"}</p>
        </div>
      </div>
    ),
    children: (
      <div className="space-y-3 pt-2">
        {entry.responseTime && (
          <Info label="Response Time" value={`${entry.responseTime}ms`} />
        )}
        <Info label="Last Checked" value={formatDateTime(entry.checkedAt)} />

        {entry?.emails?.length > 0 && (
          <Info label="Emails" value={entry.emails.join(", ")} />
        )}

        {/* Actions */}
        <div className="grid grid-cols-4 gap-2 mt-4">
          <button
            onClick={() => handleEditClick(entry.configId, entry._id)}
            className="flex items-center gap-1 px-2 justify-center py-2 rounded-xl border text-amber-600 border-amber-300 bg-amber-50 hover:bg-amber-100 hover:shadow-md transition-all"
          >
            <Edit className="w-4 h-4" />
            <span className="text-sm hidden lg:block">Edit</span>
          </button>

          <Popconfirm
            title="Delete Configuration"
            description="Are you sure you want to delete this endpoint?"
            onConfirm={() => deleteConfiguration(entry.configId, entry._id)}
            okText="Delete"
            okType="danger"
            cancelText="Cancel"
            icon={<QuestionCircleOutlined style={{ color: "red" }} />}
          >
            <button className="flex items-center gap-1 px-2 justify-center py-2 rounded-xl border text-red-600 border-red-300 bg-red-50 hover:bg-red-100 hover:shadow-md transition-all">
              <Trash2 className="w-4 h-4" />
              <span className="text-sm hidden lg:block">Delete</span>
            </button>
          </Popconfirm>

          <button
            onClick={() => sendEmail(entry._id)}
            disabled={isLoading}
            className="flex items-center gap-1 px-2  justify-center py-2 rounded-xl border text-[#1ca5b3] border-[#1ca5b3]/40 bg-[#e6f7f8] hover:bg-[#d0f1f3] hover:shadow-md transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Mail className="w-4 h-4" />
            <span className="text-sm hidden lg:block">Email</span>
          </button>
          <button
            onClick={() => handleReportClick(entry)}
            disabled={isLoading}
            className="flex items-center gap-1 px-2 justify-center py-2 rounded-xl border text-green-400 border-green-400 bg-green-50 hover:bg-green-100 hover:shadow-md transition-all"
          >
            <ExceptionOutlined className="w-4 h-4" />
            <span className="text-sm hidden lg:block">Report</span>
          </button>

          {reportModalVisible && reportEntry && (
            <ReportModal
              visible={reportModalVisible}
              entry={reportEntry}
              onClose={() => setReportModalVisible(false)}
              onGenerate={handleGenerateReport}
            />
          )}
        </div>
      </div>
    ),
    className: `border-2 border-b rounded-xl ${getStatusBgGradient(
      entry.status
    )} mb-3`,
    style: {
      borderRadius: "12px",
      overflow: "hidden",
      border: `2px solid ${getBorderColor(entry.status)}`,
    },
  }));

  return (
    <div className="min-h-screen bg-white">
      {isLoading && (
        <div className="fixed inset-0 flex justify-center items-center bg-black/20 backdrop-blur-sm z-50">
          <Spin
            size="large"
            indicator={
              <LoaderCircle className="animate-spin" color="#1ca5b3" />
            }
          />
        </div>
      )}

      <div className="container mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 max-w-8xl">
        <Header />

        {/* Header Section */}
        <div className="mt-6 mb-6 bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-[#1ca5b3] to-[#0e7c87] p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-white/20 p-2 rounded-lg">
                  <Server className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-3xl font-bold text-white">
                  IP & Port Monitor
                </h1>
              </div>
             
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setChartModalVisible(true)}
                className="flex items-center gap-2 px-6 py-3 bg-white/20 hover:bg-white/30 text-white rounded-xl border border-white/30 font-medium"
              >
                <BarChart3 className="w-5 h-5" />
                <span>View Charts</span>
              </button>
              <button
                onClick={() => setBackupLogsModalVisible(true)}
                className="flex items-center gap-2 px-6 py-3 bg-white/20 hover:bg-white/30 text-white rounded-xl border border-white/30 font-medium"
              >
                <Database className="w-5 h-5" />
                <span>Backup Logs</span>
              </button>
              <button
                onClick={checkAllStatus}
                disabled={isChecking || entries.length === 0}
                className="flex items-center gap-2 px-6 py-3 bg-white/20 hover:bg-white/30 text-white rounded-xl border border-white/30 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw
                  className={`w-5 h-5 ${isChecking ? "animate-spin" : ""}`}
                />
                <span>Check Now</span>
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid items-center grid-cols-1 lg:grid-cols-2 md:grid-cols-2 gap-4 p-6 bg-gray-50">
            {[
              {
                label: "Online",
                value: stats.online,
                icon: <Wifi />,
                color: "from-green-500 to-emerald-600",
              },
              {
                label: "Offline",
                value: stats.offline,
                icon: <WifiOff />,
                color: "from-red-500 to-rose-600",
              },
            ].map((s) => (
              <div
                key={s.label}
                className={`bg-gradient-to-br ${s.color} rounded-2xl p-6 shadow-lg hover:-translate-y-1 transition-all`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="bg-white/20 p-2 rounded-lg text-white">
                    {s.icon}
                  </div>
                  <span className="text-white/90 font-semibold">{s.label}</span>
                </div>
                <p className="text-4xl font-bold text-white">{s.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 items-center mb-6">
          <Input
            placeholder="Search by IP, Port, or Refer Port Name"
            prefix={<Search className="w-4 h-4 text-gray-400" />}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full sm:w-1/2 rounded-xl"
          />
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            className="w-full sm:w-1/3 rounded-xl"
          >
            <Option value="all">All Statuses</Option>
            <Option value="online">Online</Option>
            <Option value="offline">Offline</Option>
          </Select>
        </div>

        {/* Expandable Endpoint List with Grid */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <h2 className="text-2xl font-bold text-gray-900">
              Monitored Endpoints ({filteredEntries.length})
            </h2>
            {filteredEntries.length > 0 && (
              <div className="flex gap-2">
                {/* View Mode Toggle */}
                <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                  <button
                    onClick={() => setViewMode("grid")}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition-all ${
                      viewMode === "grid"
                        ? "bg-white text-[#1ca5b3] shadow-md"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    <LayoutGrid className="w-4 h-4" />
                    <span className="text-sm hidden sm:inline">Grid</span>
                  </button>
                  <button
                    onClick={() => setViewMode("table")}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition-all ${
                      viewMode === "table"
                        ? "bg-white text-[#1ca5b3] shadow-md"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    <Table className="w-4 h-4" />
                    <span className="text-sm hidden sm:inline">Table</span>
                  </button>
                </div>

                {/* Expand/Collapse buttons - only show in grid view */}
                {viewMode === "grid" && (
                  <>
                    <button
                      onClick={handleExpandAll}
                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#1ca5b3] to-[#0e7c87] hover:from-[#0e7c87] hover:to-[#1ca5b3] text-white rounded-xl font-medium shadow-md hover:shadow-lg transition-all"
                    >
                      <span className="text-sm">Expand All</span>
                    </button>
                    <button
                      onClick={handleCollapseAll}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium shadow-md hover:shadow-lg transition-all"
                    >
                      <span className="text-sm">Collapse All</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {filteredEntries.length === 0 ? (
            <div className="text-center py-16">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full mb-4">
                <Server className="w-10 h-10 text-gray-400" />
              </div>
              <p className="text-lg text-gray-500 font-medium">
                No endpoints found
              </p>
              <p className="text-sm text-gray-400 mt-2">
                Try changing filters or adding a new configuration
              </p>
            </div>
          ) : viewMode === "table" ? (
            /* Table View */
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gradient-to-r from-[#1ca5b3] to-[#0e7c87] text-white">
                    <th className="px-4 py-3 text-left text-sm font-semibold rounded-tl-xl">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">
                      IP Address
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">
                      Port
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">
                      Refer Port Name
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">
                      Response Time
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">
                      Last Checked
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">
                      Emails
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-semibold rounded-tr-xl">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.map((entry, index) => (
                    <tr
                      key={entry._id}
                      className={`border-b border-gray-200 hover:bg-gray-50 transition-colors ${
                        index % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${getStatusColor(
                            entry.status
                          )} bg-white border-2 border-current/20 w-fit`}
                        >
                          {getStatusIcon(entry.status)}
                          <span className="font-bold uppercase text-xs">
                            {entry.status || "unknown"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-sm text-gray-900">
                        {entry.ip}
                      </td>
                      <td className="px-4 py-3 font-mono text-sm text-gray-900">
                        {entry.port}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {entry.referPortName || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {entry.responseTime ? `${entry.responseTime}ms` : "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {formatDateTime(entry.checkedAt)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                        {entry?.emails?.length > 0
                          ? entry.emails.join(", ")
                          : "-"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleEditClick(entry.configId, entry._id)}
                            className="p-2 rounded-lg border text-amber-600 border-amber-300 bg-amber-50 hover:bg-amber-100 transition-all"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <Popconfirm
                            title="Delete Configuration"
                            description="Are you sure you want to delete this endpoint?"
                            onConfirm={() =>
                              deleteConfiguration(entry.configId, entry._id)
                            }
                            okText="Delete"
                            okType="danger"
                            cancelText="Cancel"
                            icon={<QuestionCircleOutlined style={{ color: "red" }} />}
                          >
                            <button
                              className="p-2 rounded-lg border text-red-600 border-red-300 bg-red-50 hover:bg-red-100 transition-all"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </Popconfirm>
                          <button
                            onClick={() => sendEmail(entry._id)}
                            disabled={isLoading}
                            className="p-2 rounded-lg border text-[#1ca5b3] border-[#1ca5b3]/40 bg-[#e6f7f8] hover:bg-[#d0f1f3] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                            title="Send Email"
                          >
                            <Mail className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleReportClick(entry)}
                            disabled={isLoading}
                            className="p-2 rounded-lg border text-green-400 border-green-400 bg-green-50 hover:bg-green-100 transition-all"
                            title="Generate Report"
                          >
                            <ExceptionOutlined className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            /* Grid View */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {collapseItems.map((item) => (
                <Collapse
                  key={item.key}
                  items={[item]}
                  bordered={false}
                  className="bg-transparent"
                  expandIconPosition="end"
                  activeKey={expandedKeys.includes(item.key) ? [item.key] : []}
                  onChange={(keys) => {
                    if (keys.length > 0) {
                      setExpandedKeys([...expandedKeys, item.key]);
                    } else {
                      setExpandedKeys(expandedKeys.filter((k) => k !== item.key));
                    }
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {isModalOpen && editingEntry && (
        <IPPortForm
          configId={editingEntry.configId}
          entryId={editingEntry.entryId}
        />
      )}

      {chartModalVisible && (
        <ChartModal
          visible={chartModalVisible}
          onClose={() => setChartModalVisible(false)}
        />
      )}

      {backupLogsModalVisible && (
        <BackupLogsModal
          visible={backupLogsModalVisible}
          onClose={() => setBackupLogsModalVisible(false)}
        />
      )}
    </div>
  );
};

const Info = ({ label, value }) => (
  <div className="bg-white/60 rounded-lg px-3 py-2">
    <span className="text-xs font-medium text-gray-500 block mb-1">
      {label}
    </span>
    <span className="text-sm font-mono font-bold text-gray-900 break-all">
      {value}
    </span>
  </div>
);

export default Home;
