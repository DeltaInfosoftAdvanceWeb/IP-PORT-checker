"use client";
import React, { useEffect, useRef, useState } from "react";
import { Header } from "@/components/Header.jsx";
import {
  Trash2,
  RefreshCw,
  Mail,
  Edit,
  Clock,
  Server,
  Wifi,
  WifiOff,
  Timer,
} from "lucide-react";
import useIPPortStore from "@/store/useIPPortStore";
import { Popconfirm, Spin } from "antd";
import { QuestionCircleOutlined } from "@ant-design/icons";
import IPPortForm from "@/components/IPPortForm";
import { Toaster } from "react-hot-toast";

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
    isModalOpen,
    openModal,
    openEdit,
  } = useIPPortStore();

  const [editingEntry, setEditingEntry] = useState(null);
  const [timeUntilNextCheck, setTimeUntilNextCheck] = useState(null);
  let timer = 5;
  const formatTime = (date) => {
    if (!date) return "-";
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const formatCountdown = (ms) => {
    if (!ms || ms <= 0) return "Checking now...";
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}m ${seconds}s`;
  };

  // Calculate next scheduled time (every 1 minute at :00 seconds)
  const getNextCronTime = () => {
    const now = new Date();
    const nextRun = new Date(now);

    const currentMinutes = now.getMinutes();
    const next5Min = Math.ceil(currentMinutes / 5) * 5;

    nextRun.setMinutes(next5Min, 0, 0);
    if (nextRun <= now) {
      nextRun.setMinutes(nextRun.getMinutes() + 5, 0, 0);
    }

    // nextRun.setMinutes(nextRun.getMinutes() + 1, 0, 0);
    return nextRun;
  };

  useEffect(() => {
    const init = async () => {
      await fetchConfigurations();
    };
    init();
  }, []);

  const getStatusColor = (status) => {
    switch (status) {
      case "online":
        return "text-green-600";
      case "offline":
        return "text-red-600";
      case "timeout":
        return "text-amber-600";
      case "checking":
        return "text-blue-600";
      default:
        return "text-gray-500";
    }
  };

  const getStatusBgGradient = (status) => {
    switch (status) {
      case "online":
        return "bg-gradient-to-br from-green-50 to-emerald-50 border-green-300 hover:shadow-green-100";
      case "offline":
        return "bg-gradient-to-br from-red-50 to-rose-50 border-red-300 hover:shadow-red-100";
      case "timeout":
        return "bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-300 hover:shadow-amber-100";
      case "checking":
        return "bg-gradient-to-br from-blue-50 to-sky-50 border-blue-300 hover:shadow-blue-100";
      default:
        return "bg-gradient-to-br from-gray-50 to-slate-50 border-gray-300";
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "online":
        return <Wifi className="w-4 h-4" />;
      case "offline":
        return <WifiOff className="w-4 h-4" />;
      case "timeout":
        return <Timer className="w-4 h-4" />;
      case "checking":
        return <RefreshCw className="w-4 h-4 animate-spin" />;
      default:
        return <Server className="w-4 h-4" />;
    }
  };

  const handleEditClick = (configId, entryId) => {
    setEditingEntry({ configId, entryId });
    openEdit();
    openModal();
  };

  const countdownRef = useRef(null);
  const autoCheckRef = useRef(null);

  // Countdown timer that syncs with 1-minute intervals
  useEffect(() => {
    if (entries.length === 0) {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
      setTimeUntilNextCheck(null);
      return;
    }

    // Update countdown every second
    const updateCountdown = () => {
      const nextCron = getNextCronTime();
      const timeLeft = nextCron.getTime() - Date.now();
      setTimeUntilNextCheck(Math.max(0, timeLeft));
    };

    updateCountdown();
    countdownRef.current = setInterval(updateCountdown, 1000);

    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    };
  }, [entries.length]);

  // Auto-check every 1 minute and send email
  useEffect(() => {
    if (entries.length === 0) {
      if (autoCheckRef.current) {
        clearInterval(autoCheckRef.current);
        autoCheckRef.current = null;
      }
      return;
    }

    // Function to perform auto-check with email
    const performAutoCheck = async () => {
      console.log("🔄 Performing automatic 1-minute check with email...");

      try {
        // Check all status
        await checkAllStatus();

        // Send email after status check
        setTimeout(async () => {
          console.log("Sending automatic email notification...");
          await sendEmail();
        }, 2000); // Wait 2 seconds after check completes
      } catch (error) {
        console.error("Error in auto-check:", error);
      }
    };

    // Calculate time until next minute boundary
    const now = new Date();
    const msUntilNextMinute =
      (60 - now.getSeconds()) * 1000 - now.getMilliseconds();

    // Wait until the next minute boundary, then start interval
    const initialTimeout = setTimeout(() => {
      performAutoCheck(); // First check at minute boundary

      // Then check every 5 min
      autoCheckRef.current = setInterval(performAutoCheck, 5 * 60 * 1000); //5 * 60*1000
    }, msUntilNextMinute);

    return () => {
      clearTimeout(initialTimeout);
      if (autoCheckRef.current) {
        clearInterval(autoCheckRef.current);
        autoCheckRef.current = null;
      }
    };
  }, [entries.length, checkAllStatus, sendEmail]);

  // // Refresh data from server every 30 seconds to show latest updates
  // useEffect(() => {
  //   if (entries.length === 0) return;

  //   const refreshInterval = setInterval(() => {
  //     console.log("🔄 Refreshing data from server...");
  //     fetchConfigurations();
  //   }, 60000);

  //   return () => clearInterval(refreshInterval);
  // }, [entries.length, fetchConfigurations]);

  const stats = getTotalStats();
  const nextCronTime = getNextCronTime();

  return (
    <div className="min-h-screen bg-white">
      <Toaster position="bottom-right" />

      {isLoading && (
        <div className="fixed inset-0 flex justify-center items-center bg-black/30 backdrop-blur-sm z-50">
          <div className="bg-white rounded-2xl p-8 shadow-2xl">
            <Spin size="large" />
          </div>
        </div>
      )}

      <div className="container mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 max-w-7xl">
        <Header />

        {/* Hero Section with Stats */}
        <div className="mt-6 mb-6">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#1ca5b3] to-[#0e7c87] p-4 sm:p-6 lg:p-8">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="bg-white/20 backdrop-blur-sm p-2 rounded-lg">
                      <Server className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                    </div>
                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white">
                      IP & Port Monitor
                    </h1>
                  </div>
                  <p className="text-blue-100 text-sm sm:text-base ml-0 sm:ml-14">
                    Real-time monitoring • Automated every {timer} minute with
                    email alerts
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => sendEmail()}
                    disabled={isLoading}
                    className="flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-white hover:bg-blue-50 disabled:bg-gray-200 text-[#1ca5b3] rounded-xl transition-all shadow-lg hover:shadow-xl font-medium text-sm sm:text-base"
                  >
                    <Mail className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="hidden sm:inline">Send Email</span>
                    <span className="sm:hidden">Email</span>
                  </button>
                  <button
                    onClick={checkAllStatus}
                    disabled={isChecking || entries.length === 0}
                    className="flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-white/20 hover:bg-white/30 disabled:bg-white/10 text-white rounded-xl transition-all backdrop-blur-sm border border-white/30 font-medium text-sm sm:text-base"
                  >
                    <RefreshCw
                      className={`w-4 h-4 sm:w-5 sm:h-5 ${
                        isChecking ? "animate-spin" : ""
                      }`}
                    />
                    <span className="hidden sm:inline">Check Now</span>
                    <span className="sm:hidden">Check</span>
                  </button>
                </div>
              </div>

              {/* Server Auto-Check Countdown */}
              {entries.length > 0 && timeUntilNextCheck !== null && (
                <div className="mt-4 sm:mt-6">
                  <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 sm:p-4 border border-white/20">
                    <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-center">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-white animate-pulse" />
                        <div>
                          <p className="text-xs sm:text-sm text-blue-100 font-medium">
                            Next Auto-Check & Email (Every {timer} Min)
                          </p>
                          <p className="text-lg sm:text-xl lg:text-2xl font-bold text-white tabular-nums">
                            {formatCountdown(timeUntilNextCheck)}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col sm:ml-auto">
                        <p className="text-xs text-blue-100">
                          Scheduled at:{" "}
                          <span className="font-semibold text-white">
                            {formatTime(nextCronTime)}
                          </span>
                        </p>
                        <p className="text-xs text-blue-100 mt-1">
                          Email sent after each check
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-3 sm:gap-4 lg:gap-6 p-4 sm:p-6 lg:p-8 bg-gray-50">
              <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl sm:rounded-2xl p-3 sm:p-4 lg:p-6 shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1">
                <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                  <div className="bg-white/20 backdrop-blur-sm p-1.5 sm:p-2 rounded-lg">
                    <Wifi className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-white" />
                  </div>
                  <span className="text-xs sm:text-sm lg:text-base font-semibold text-white/90">
                    Online
                  </span>
                </div>
                <p className="text-2xl sm:text-3xl lg:text-5xl font-bold text-white">
                  {stats.online}
                </p>
                <p className="text-xs sm:text-sm text-white/80 mt-1 sm:mt-2">
                  Active connections
                </p>
              </div>

              <div className="bg-gradient-to-br from-red-500 to-rose-600 rounded-xl sm:rounded-2xl p-3 sm:p-4 lg:p-6 shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1">
                <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                  <div className="bg-white/20 backdrop-blur-sm p-1.5 sm:p-2 rounded-lg">
                    <WifiOff className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-white" />
                  </div>
                  <span className="text-xs sm:text-sm lg:text-base font-semibold text-white/90">
                    Offline
                  </span>
                </div>
                <p className="text-2xl sm:text-3xl lg:text-5xl font-bold text-white">
                  {stats.offline}
                </p>
                <p className="text-xs sm:text-sm text-white/80 mt-1 sm:mt-2">
                  Failed connections
                </p>
              </div>

              <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl sm:rounded-2xl p-3 sm:p-4 lg:p-6 shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1">
                <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                  <div className="bg-white/20 backdrop-blur-sm p-1.5 sm:p-2 rounded-lg">
                    <Timer className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-white" />
                  </div>
                  <span className="text-xs sm:text-sm lg:text-base font-semibold text-white/90">
                    Checking
                  </span>
                </div>
                <p className="text-2xl sm:text-3xl lg:text-5xl font-bold text-white">
                  {stats.checking}
                </p>
                <p className="text-xs sm:text-sm text-white/80 mt-1 sm:mt-2">
                  In progress
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Monitored Endpoints */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
          <div className="p-4 sm:p-6 bg-gradient-to-r from-gray-50 to-slate-50 border-b border-gray-200">
            <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">
              Monitored Endpoints
            </h2>
            <p className="text-xs sm:text-sm text-gray-600 mt-1">
              {stats.total} {stats.total === 1 ? "endpoint" : "endpoints"}{" "}
              configured
            </p>
          </div>

          <div className="p-3 sm:p-6">
            {entries.length === 0 ? (
              <div className="text-center py-12 sm:py-16 lg:py-20">
                <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-gray-100 rounded-full mb-4">
                  <Server className="w-8 h-8 sm:w-10 sm:h-10 text-gray-400" />
                </div>
                <p className="text-base sm:text-lg text-gray-500 font-medium">
                  No endpoints configured yet
                </p>
                <p className="text-xs sm:text-sm text-gray-400 mt-2">
                  Add your first IP & Port configuration to start monitoring
                </p>
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {entries.map((config) =>
                  config.entries.map((entry, i) => (
                    <div
                      key={`${config._id}-${i}`}
                      className={`border-2 rounded-xl sm:rounded-2xl p-4 sm:p-5 lg:p-6 transition-all hover:shadow-lg ${getStatusBgGradient(
                        entry.status
                      )}`}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div
                            className={`flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl ${getStatusColor(
                              entry.status
                            )} bg-white/80 backdrop-blur-sm border-2 border-current/20`}
                          >
                            {getStatusIcon(entry.status)}
                            <span className="text-xs sm:text-sm font-bold uppercase tracking-wide">
                              {entry.status || "unknown"}
                            </span>
                          </div>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 lg:gap-4">
                            <div className="bg-white/60 rounded-lg px-3 py-2">
                              <span className="text-xs font-medium text-gray-500 block mb-1">
                                IP Address
                              </span>
                              <span className="text-sm sm:text-base font-mono font-bold text-gray-900 break-all">
                                {entry.ip}
                              </span>
                            </div>
                            <div className="bg-white/60 rounded-lg px-3 py-2">
                              <span className="text-xs font-medium text-gray-500 block mb-1">
                                Port
                              </span>
                              <span className="text-sm sm:text-base font-mono font-bold text-gray-900">
                                {entry.port}
                              </span>
                            </div>
                            {entry.responseTime && (
                              <div className="bg-white/60 rounded-lg px-3 py-2">
                                <span className="text-xs font-medium text-gray-500 block mb-1">
                                  Response Time
                                </span>
                                <span className="text-sm sm:text-base font-mono font-bold text-gray-900">
                                  {entry.responseTime}ms
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="mt-3 flex flex-col sm:flex-row gap-2 text-xs sm:text-sm text-gray-600">
                            {entry.checkedAt || entry.lastChecked ? (
                              <span className="bg-white/60 px-3 py-1 rounded-md">
                                ⏱️ Checked:{" "}
                                {formatTime(
                                  entry.checkedAt || entry.lastChecked
                                )}
                              </span>
                            ) : null}
                            <span className="bg-white/60 px-3 py-1 rounded-md">
                              📌 {entry.referPortName}
                            </span>
                          </div>
                        </div>

                        <div className="flex lg:flex-col gap-2">
                          {/* <button
                            onClick={() =>
                              checkSingleStatus(config._id, i, entry)
                            }
                            disabled={entry.status === "checking"}
                            className="flex-1 lg:flex-none flex items-center justify-center gap-2 p-2.5 sm:p-3 text-blue-600 hover:text-blue-700 hover:bg-blue-100 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed border-2 border-transparent hover:border-blue-200"
                            title="Refresh Status"
                          >
                            <RefreshCw
                              className={`w-4 h-4 sm:w-5 sm:h-5 ${
                                entry.status === "checking"
                                  ? "animate-spin"
                                  : ""
                              }`}
                            />
                          </button> */}

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditClick(config._id, entry._id);
                            }}
                            className="flex-1 lg:flex-none flex items-center justify-center gap-2 p-2.5 sm:p-3 text-amber-600 hover:text-amber-700 hover:bg-amber-100 rounded-xl transition-all border-2 border-transparent hover:border-amber-200"
                            title="Edit Configuration"
                          >
                            <Edit className="w-4 h-4 sm:w-5 sm:h-5" />
                          </button>

                          <Popconfirm
                            title="Delete Configuration"
                            description="Are you sure you want to delete this endpoint?"
                            onConfirm={() =>
                              deleteConfiguration(config._id, entry._id)
                            }
                            okText="Delete"
                            okType="danger"
                            icon={
                              <QuestionCircleOutlined
                                style={{ color: "red" }}
                              />
                            }
                            cancelText="Cancel"
                          >
                            <button
                              className="flex-1 lg:flex-none flex items-center justify-center gap-2 p-2.5 sm:p-3 text-red-600 hover:text-red-700 hover:bg-red-100 rounded-xl transition-all border-2 border-transparent hover:border-red-200"
                              title="Delete Configuration"
                            >
                              <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
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

      {isModalOpen && editingEntry && (
        <IPPortForm
          configId={editingEntry.configId}
          entryId={editingEntry.entryId}
        />
      )}
    </div>
  );
};

export default Home;
