"use client";

import { useState, useEffect, useRef } from "react";
import { Play, Pause, Activity } from "lucide-react";
import useIPPortStore from "@/store/useIPPortStore";
import axios from "axios";

export default function DevAutoChecker() {
  const [isRunning, setIsRunning] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [lastCheck, setLastCheck] = useState(null);
  const [nextCheck, setNextCheck] = useState(null);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({
    online: 0,
    offline: 0,
    timeout: 0,
    error: 0,
  });

  const intervalRef = useRef(null);
  const countdownIntervalRef = useRef(null);
  const logsEndRef = useRef(null);

  const { fetchConfigurations } = useIPPortStore();

  // Scroll to latest log
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  // Fetch updated config after each check
  useEffect(() => {
    if (lastCheck) fetchConfigurations();
  }, [lastCheck, fetchConfigurations]);

  // --- Perform single auto-check ---
  const performCheck = async () => {
    const timestamp = new Date();
    setLogs((prev) => [
      ...prev,
      {
        time: timestamp.toLocaleTimeString(),
        message: "🔄 Starting auto-check...",
        type: "info",
      },
    ]);

    try {
      const { data } = await axios.get("/api/dev/auto-check");
      if (data.success) {
        setStats(
          data.summary || { online: 0, offline: 0, timeout: 0, error: 0 }
        );
        setLogs((prev) => [
          ...prev,
          {
            time: timestamp.toLocaleTimeString(),
            message: `✅ Auto-check completed`,
            type: "success",
          },
        ]);
      } else {
        setLogs((prev) => [
          ...prev,
          {
            time: timestamp.toLocaleTimeString(),
            message: `❌ Failed: ${data.message}`,
            type: "error",
          },
        ]);
      }
    } catch (err) {
      setLogs((prev) => [
        ...prev,
        {
          time: timestamp.toLocaleTimeString(),
          message: `❌ Network error: ${err.message}`,
          type: "error",
        },
      ]);
    }

    setLastCheck(new Date()); // update last check
  };
  // --- Start auto-checking ---
  const startAutoCheck = () => {
    if (isRunning) return;
    setIsRunning(true);

    performCheck(); // initial check

    // Run auto-check every minute
    intervalRef.current = setInterval(() => performCheck(), 60000);

    // Countdown interval updates every second
    countdownIntervalRef.current = setInterval(() => {
      if (!lastCheck) return;
      const now = new Date();
      const diff = 60 - Math.floor((now - lastCheck) / 1000);
      setCountdown(diff > 0 ? diff : 0);
    }, 1000);
  };

  // --- Stop auto-checking ---
  const stopAutoCheck = () => {
    if (!isRunning) return;

    setIsRunning(false);
    const stopTime = new Date().toLocaleTimeString();
    setLogs((prev) => [
      ...prev,
      { time: stopTime, message: "⏸️ Auto-check stopped", type: "info" },
    ]);

    clearInterval(intervalRef.current);
    intervalRef.current = null;

    clearInterval(countdownIntervalRef.current);
    countdownIntervalRef.current = null;

    setNextCheck(null);
  };

  // --- Countdown display ---
  const getCountdown = () => {
    if (!nextCheck || !isRunning) return null;
    const diff = Math.max(0, Math.floor((nextCheck - new Date()) / 1000));
    const mins = Math.floor(diff / 60);
    const secs = diff % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="border rounded-2xl p-6 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-blue-500" />
          <h3 className="font-semibold text-lg">Development Auto-Checker</h3>
          {isRunning && (
            <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              Active
            </span>
          )}
        </div>

        <button
          onClick={isRunning ? stopAutoCheck : startAutoCheck}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            isRunning
              ? "bg-red-500 hover:bg-red-600 text-white"
              : "bg-blue-500 hover:bg-blue-600 text-white"
          }`}
        >
          {isRunning ? (
            <>
              <Pause className="w-4 h-4" /> Stop
            </>
          ) : (
            <>
              <Play className="w-4 h-4" /> Start
            </>
          )}
        </button>
      </div>

      {/* Status Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <StatusCard label="Online" color="green" value={stats.online} />
        <StatusCard label="Offline" color="red" value={stats.offline} />
        <StatusCard label="Timeout" color="yellow" value={stats.timeout} />
        <StatusCard label="Error" color="gray" value={stats.error} />
      </div>

      {/* Next Check Timer */}
      {isRunning && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-700">Next check in:</span>
            <span className="font-mono font-bold text-blue-600 text-lg">
              {countdown !== null
                ? `${Math.floor(countdown / 60)}:${String(
                    countdown % 60
                  ).padStart(2, "0")}`
                : "--:--"}
            </span>
          </div>
          {lastCheck && (
            <div className="text-xs text-gray-500 mt-1">
              Last checked: {lastCheck.toLocaleTimeString()}
            </div>
          )}
        </div>
      )}

      {/* Logs Console */}
      <div className="bg-gray-900 text-gray-100 rounded-lg p-4 font-mono text-xs max-h-64 overflow-y-auto">
        <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-700">
          <span className="text-gray-400">Console Logs</span>
          {logs.length > 0 && (
            <button
              onClick={() => setLogs([])}
              className="text-gray-400 hover:text-white text-xs"
            >
              Clear
            </button>
          )}
        </div>
        {logs.length === 0 ? (
          <div className="text-gray-500 text-center py-8">
            No logs yet. Start auto-checking to see activity.
          </div>
        ) : (
          logs.slice(-20).map((log, i) => (
            <div
              key={i}
              className={
                log.type === "error"
                  ? "text-red-400"
                  : log.type === "success"
                  ? "text-green-400"
                  : "text-gray-300"
              }
            >
              <span className="text-gray-500">[{log.time}]</span> {log.message}
            </div>
          ))
        )}
        <div ref={logsEndRef} />
      </div>

      {/* Footer */}
      <div className="mt-4 text-xs text-gray-500 bg-yellow-50 border border-yellow-200 rounded p-2">
        ⚠️ <strong>Development Mode:</strong> Checks run every 1 minute while
        this page is open. In production, use a Vercel Cron Job to trigger{" "}
        <code className="mx-1 text-blue-600">
          /api/ip-port-config/auto-check
        </code>
        .
      </div>
    </div>
  );
}

// --- Status Card Subcomponent ---
function StatusCard({ label, color, value }) {
  const colorMap = {
    green: "text-green-600 bg-green-50",
    red: "text-red-600 bg-red-50",
    yellow: "text-yellow-600 bg-yellow-50",
    gray: "text-gray-600 bg-gray-50",
  };
  return (
    <div className={`${colorMap[color]} p-3 rounded-lg`}>
      <div className="text-xs text-gray-600">{label}</div>
      <div className={`text-2xl font-bold ${colorMap[color].split(" ")[0]}`}>
        {value}
      </div>
    </div>
  );
}
