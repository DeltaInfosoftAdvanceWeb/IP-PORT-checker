"use client";
import React, { useEffect, useState } from "react";
import { Header } from "@/components/Header.jsx";
import { Trash2, RefreshCw, Circle, Mail, Edit } from "lucide-react";
import useIPPortStore from "@/store/useIPPortStore";
import { Popconfirm, Spin } from "antd";
import { QuestionCircleOutlined } from "@ant-design/icons";
import IPPortForm from "@/components/IPPortForm";


const Home = () => {
  const {
    entries,
    isChecking,
    fetchConfigurations,
    deleteConfiguration,
    checkSingleStatus,
    checkAllStatus,
    getTotalStats,
    sendEmail,
    isLoading,
  } = useIPPortStore();

  const [isEditing,setIsEditing] = useState(false);


  //  Format time utility
  const formatTime = (date) => {
    if (!date) return "-";
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  useEffect(() => {
    const init = async () => {
      await fetchConfigurations();
      if (entries.length > 0) {
        checkAllStatus();
      }
    };
    init();
  }, []);

  const getStatusColor = (status) => {
    switch (status) {
      case "online":
        return "text-green-500";
      case "offline":
        return "text-red-500";
      case "timeout":
        return "text-yellow-500";
      case "checking":
        return "text-yellow-500";
      default:
        return "text-gray-500";
    }
  };

  const getStatusBg = (status) => {
    switch (status) {
      case "online":
        return "bg-green-50 border-green-200";
      case "offline":
        return "bg-red-50 border-red-200";
      case "timeout":
        return "bg-yellow-50 border-yellow-200";
      case "checking":
        return "bg-yellow-50 border-yellow-200";
      default:
        return "bg-gray-50 border-gray-200";
    }
  };

  const stats = getTotalStats();

  return (
    <div className="min-h-screen bg-white p-2 sm:p-4 md:mx-8 md:my-1 px-6 md:px-16 lg:px-20">
      {isLoading && (
        <div className="fixed inset-0 flex justify-center items-center bg-black bg-opacity-20 z-50 pointer-events-none">
          <Spin size="large" />
        </div>
      )}

      <Header />
      <div className="min-h-[calc(100vh-120px)] bg-gradient-to-b from-[#1ca5b3]/30 to-white rounded-md p-3 sm:p-6 overflow-auto">
        <div className="bg-white rounded-lg shadow-lg min-h-[600px]">
          {/* Header Section */}
          <div className="p-3 sm:p-6 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
              <div>
                <h2 className="text-xl sm:text-2xl font-semibold text-gray-900">
                  IP & Port Monitor
                </h2>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">
                  {stats.total} {stats.total === 1 ? "entry" : "entries"}{" "}
                  configured
                </p>
              </div>
              <div className="w-full sm:w-auto flex gap-2">
                <button
                  onClick={() => sendEmail()}
                  disabled={isLoading}
                  className="flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded transition-colors text-sm"
                >
                  <Mail size={16} />
                  Send Email
                </button>
                <button
                  onClick={checkAllStatus}
                  disabled={isChecking || entries.length === 0}
                  className="flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2 bg-[#1ca5b3] hover:bg-[#107f8c] disabled:bg-[#1ca5b3] text-white rounded transition-colors text-sm"
                >
                  <RefreshCw
                    size={16}
                    className={isChecking ? "animate-spin" : ""}
                  />
                  Check All
                </button>
              </div>
            </div>
          </div>

          {/* Stats Section */}
          <div className="p-3 sm:p-6 border-b border-gray-200 grid grid-cols-3 gap-2 sm:gap-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-2 sm:p-4">
              <div className="flex items-center gap-1 sm:gap-2">
                <Circle className="fill-green-500 text-green-500" size={10} />
                <span className="text-xs sm:text-sm font-medium text-gray-600">
                  Online
                </span>
              </div>
              <p className="text-lg sm:text-2xl font-bold text-gray-900 mt-1 sm:mt-2">
                {stats.online}
              </p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-2 sm:p-4">
              <div className="flex items-center gap-1 sm:gap-2">
                <Circle className="fill-red-500 text-red-500" size={10} />
                <span className="text-xs sm:text-sm font-medium text-gray-600">
                  Offline
                </span>
              </div>
              <p className="text-lg sm:text-2xl font-bold text-gray-900 mt-1 sm:mt-2">
                {stats.offline}
              </p>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 sm:p-4">
              <div className="flex items-center gap-1 sm:gap-2">
                <Circle className="fill-yellow-500 text-yellow-500" size={10} />
                <span className="text-xs sm:text-sm font-medium text-gray-600">
                  Checking
                </span>
              </div>
              <p className="text-lg sm:text-2xl font-bold text-gray-900 mt-1 sm:mt-2">
                {stats.checking}
              </p>
            </div>
          </div>

          {/* List Section */}
          <div className="p-3 sm:p-6">
            {entries.length === 0 ? (
              <div className="text-center py-8 sm:py-12">
                <p className="text-sm sm:text-base text-gray-500">
                  No entries yet. Add your first IP & Port configuration.
                </p>
              </div>
            ) : (
              <div className="space-y-2 sm:space-y-3">
                {entries.map((config) =>
                  config.entries.map((entry, i) => (
                    <div
                      key={`${config._id}-${i}`}
                      className={`border rounded-lg p-3 sm:p-4 transition-all ${getStatusBg(
                        entry.status
                      )}`}
                    >
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 flex-1 w-full">
                          <div className="flex items-center gap-2">
                            <Circle
                              className={`${getStatusColor(entry.status)} ${
                                entry.status === "checking"
                                  ? "animate-pulse"
                                  : ""
                              }`}
                              size={12}
                              fill="currentColor"
                            />
                            <span
                              className={`text-xs font-semibold uppercase ${getStatusColor(
                                entry.status
                              )}`}
                            >
                              {entry.status || "unknown"}
                            </span>
                          </div>

                          <div className="flex-1 w-full">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                              <div className="flex items-center flex-wrap gap-1">
                                <span className="text-xs sm:text-sm text-gray-500">
                                  IP:
                                </span>
                                <span className="text-xs sm:text-sm font-mono font-semibold text-gray-900 break-all">
                                  {entry.ip}
                                </span>
                              </div>
                              <div className="flex items-center flex-wrap gap-1">
                                <span className="text-xs sm:text-sm text-gray-500">
                                  Port:
                                </span>
                                <span className="text-xs sm:text-sm font-mono font-semibold text-gray-900">
                                  {entry.port}
                                </span>
                              </div>
                              {entry.responseTime && (
                                <div className="flex items-center flex-wrap gap-1">
                                  <span className="text-xs sm:text-sm text-gray-500">
                                    Response:
                                  </span>
                                  <span className="text-xs sm:text-sm font-mono font-semibold text-gray-900">
                                    {entry.responseTime}ms
                                  </span>
                                </div>
                              )}
                            </div>

                            {/*  Checked At field */}
                            {entry.checkedAt || entry.lastChecked ? (
                              <p className="text-xs text-gray-500 mt-1">
                                Checked At:{" "}
                                {formatTime(
                                  entry.checkedAt || entry.lastChecked
                                )}
                              </p>
                            ) : null}
                            <p className="text-xs text-gray-500 mt-1">
                              Config Name: {config.configName}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              Port refer to : {entry.referPortName}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                          <button
                            onClick={() =>
                              checkSingleStatus(config._id, i, entry)
                            }
                            disabled={entry.status === "checking"}
                            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors disabled:opacity-50"
                          >
                            <RefreshCw
                              size={16}
                              className={
                                entry.status === "checking"
                                  ? "animate-spin"
                                  : ""
                              }
                            />
                          </button>

                          <button
                            onClick={() => setIsEditing(true)}
                            className="p-2 text-gray-600 hover:text-yellow-600 hover:bg-yellow-50 rounded-md transition-colors"
                          >
                            <Edit size={16} />
                          </button>
                              {
                                isEditing && <IPPortForm configId={config._id} isEditing={isEditing} setIsEditing={setIsEditing} />
                              }
                          <Popconfirm
                            title="Delete Config"
                            description="Are you sure to delete this config?"
                            onConfirm={() => deleteConfiguration(config._id)}
                            okText="Delete"
                            icon={
                              <QuestionCircleOutlined
                                style={{ color: "red" }}
                              />
                            }
                            cancelText="Cencel"
                          >
                            <button className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors">
                              <Trash2 size={16} />
                            </button>
                          </Popconfirm>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
