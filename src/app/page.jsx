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
} from "lucide-react";
import { Popconfirm, Spin, Select, Input, Collapse } from "antd";
import { QuestionCircleOutlined } from "@ant-design/icons";
import useIPPortStore from "@/store/useIPPortStore";
import IPPortForm from "@/components/IPPortForm";

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
  } = useIPPortStore();

  const [editingEntry, setEditingEntry] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const formatDateTime = (date) =>
    date
      ? new Date(date).toLocaleString("en-US", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      : "-";

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
      online:
        "bg-gradient-to-br from-green-50 to-emerald-50 border-green-300",
      offline:
        "bg-gradient-to-br from-red-50 to-rose-50 border-red-300",
      timeout:
        "bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-300",
      checking:
        "bg-gradient-to-br from-blue-50 to-sky-50 border-blue-300",
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
          <p className="text-xs text-gray-500">
            {entry.referPortName || "-"}
          </p>
        </div>
      </div>
    ),
    children: (
      <div className="space-y-3 pt-2">
        {entry.responseTime && (
          <Info
            label="Response Time"
            value={`${entry.responseTime}ms`}
          />
        )}
        <Info
          label="Last Checked"
          value={formatDateTime(entry.checkedAt)}
        />

        {entry?.emails?.length > 0 && (
          <Info label="Emails" value={entry.emails.join(", ")} />
        )}

        {/* Actions */}
        <div className="grid grid-cols-3 gap-2 mt-4">
          <button
            onClick={() =>
              handleEditClick(entry.configId, entry._id)
            }
            className="flex items-center gap-1 px-2 justify-center py-2 rounded-xl border text-amber-600 border-amber-300 bg-amber-50 hover:bg-amber-100 hover:shadow-md transition-all"
          >
            <Edit className="w-4 h-4" />
            <span className="text-sm">Edit</span>
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
            icon={
              <QuestionCircleOutlined style={{ color: "red" }} />
            }
          >
            <button className="flex items-center gap-1 px-2 justify-center py-2 rounded-xl border text-red-600 border-red-300 bg-red-50 hover:bg-red-100 hover:shadow-md transition-all">
              <Trash2 className="w-4 h-4" />
              <span className="text-sm">Delete</span>
            </button>
          </Popconfirm>

          <button
            onClick={() => sendEmail(entry._id)}
            disabled={isLoading}
            className="flex items-center gap-1 px-2  justify-center py-2 rounded-xl border text-[#1ca5b3] border-[#1ca5b3]/40 bg-[#e6f7f8] hover:bg-[#d0f1f3] hover:shadow-md transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Mail className="w-4 h-4" />
            <span className="text-sm">Email</span>
          </button>
        </div>
      </div>
    ),
    className: `border-2 border-b rounded-xl ${getStatusBgGradient(entry.status)} mb-3`,
    style: {
      borderRadius: "12px",
      overflow: "hidden",
      border:`2px solid ${getBorderColor(entry.status)}`
    },
  }));

  return (
    <div className="min-h-screen bg-white">
      {isLoading && (
        <div className="fixed inset-0 flex justify-center items-center bg-black/20 backdrop-blur-sm z-50">
          <Spin size="large" indicator={<LoaderCircle className="animate-spin" color="#1ca5b3"/>} />
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
              <p className="text-blue-100 text-sm ml-14">
                Real-time IP & Port Monitoring with manual checks
              </p>
            </div>

            <button
              onClick={checkAllStatus}
              disabled={isChecking || entries.length === 0}
              className="flex items-center gap-2 px-6 py-3 bg-white/20 hover:bg-white/30 text-white rounded-xl border border-white/30 font-medium"
            >
              <RefreshCw
                className={`w-5 h-5 ${isChecking ? "animate-spin" : ""}`}
              />
              <span>Check Now</span>
            </button>
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
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Monitored Endpoints ({filteredEntries.length})
          </h2>

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
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {collapseItems.map((item) => (
                <Collapse
                  key={item.key}
                  items={[item]}
                  bordered={false}
                  className="bg-transparent"
                  expandIconPosition="end"
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