"use client";

import { useState, useEffect, useRef } from "react";
import { Play, Pause, RefreshCw, Activity } from "lucide-react";
import useIPPortStore from "@/store/useIPPortStore";
import axios from "axios";

export default function DevAutoChecker() {
  const [isRunning, setIsRunning] = useState(false);
  const [lastCheck, setLastCheck] = useState(null);
  const [nextCheck, setNextCheck] = useState(null);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({ online: 0, offline: 0, timeout: 0, error: 0 });
  const intervalRef = useRef(null);
  const countdownRef = useRef(null);
  const {fetchConfigurations} = useIPPortStore()

  useEffect(()=>{
    fetchConfigurations()
  },[lastCheck])
  // Perform check
  const performCheck = async () => {
    const timestamp = new Date().toLocaleTimeString();
    
    try {
      setLogs(prev => [...prev, { time: timestamp, message: "🔄 Starting check...", type: "info" }]);
      
      const {data} = await axios.get("/api/dev/auto-check");

      if (data.success) {
        setStats(data.summary || { online: 0, offline: 0, timeout: 0, error: 0 });
        setLogs(prev => [
          ...prev,
          { 
            time: timestamp, 
            message: `✅ Check completed: ${data.checked} entries (${data.duration})`, 
            type: "success" 
          }
        ]);
      } else {
        setLogs(prev => [...prev, { time: timestamp, message: `❌ Check failed: ${data.message}`, type: "error" }]);
      }

      setLastCheck(new Date());
      setNextCheck(new Date(Date.now() + 60000)); // 1 minutes
    } catch (error) {
      setLogs(prev => [...prev, { time: timestamp, message: `❌ Network error: ${error.message}`, type: "error" }]);
    }
  };

  // Start auto-checking
  const startAutoCheck = () => {
    if (isRunning) return;
    
    setIsRunning(true);
    setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), message: "▶️  Auto-check started (every 1 minutes)", type: "info" }]);
    
    // Immediate first check
    performCheck();
    
    // Set interval for subsequent checks
    intervalRef.current = setInterval(() => {
      performCheck();
    }, 60000); // 1 minutes

    // Countdown timer
    countdownRef.current = setInterval(() => {
      if (nextCheck) {
        const now = new Date();
        if (now >= nextCheck) {
          setNextCheck(new Date(Date.now() + 60000));
        }
      }
    }, 1000);
  };

  // Stop auto-checking
  const stopAutoCheck = () => {
    if (!isRunning) return;
    
    setIsRunning(false);
    setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), message: "⏸️  Auto-check stopped", type: "info" }]);
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    
    setNextCheck(null);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  // Calculate countdown
  const getCountdown = () => {
    if (!nextCheck || !isRunning) return null;
    const seconds = Math.max(0, Math.floor((nextCheck - new Date()) / 1000));
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const countdown = getCountdown();

  return (
    <div className="border rounded-lg p-6 bg-white shadow-sm">
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
              <Pause className="w-4 h-4" />
              Stop
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Start
            </>
          )}
        </button>
      </div>

      {/* Status Info */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="bg-green-50 p-3 rounded-lg">
          <div className="text-xs text-gray-600">Online</div>
          <div className="text-2xl font-bold text-green-600">{stats.online}</div>
        </div>
        <div className="bg-red-50 p-3 rounded-lg">
          <div className="text-xs text-gray-600">Offline</div>
          <div className="text-2xl font-bold text-red-600">{stats.offline}</div>
        </div>
        <div className="bg-yellow-50 p-3 rounded-lg">
          <div className="text-xs text-gray-600">Timeout</div>
          <div className="text-2xl font-bold text-yellow-600">{stats.timeout}</div>
        </div>
        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="text-xs text-gray-600">Error</div>
          <div className="text-2xl font-bold text-gray-600">{stats.error}</div>
        </div>
      </div>

      {/* Timer Info */}
      {isRunning && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-700">Next check in:</span>
            <span className="font-mono font-bold text-blue-600 text-lg">{countdown}</span>
          </div>
          {lastCheck && (
            <div className="text-xs text-gray-500 mt-1">
              Last checked: {lastCheck.toLocaleTimeString()}
            </div>
          )}
        </div>
      )}

      {/* Logs */}
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
          <div className="space-y-1">
            {logs.slice(-20).map((log, i) => (
              <div 
                key={i} 
                className={`${
                  log.type === "error" ? "text-red-400" : 
                  log.type === "success" ? "text-green-400" : 
                  "text-gray-300"
                }`}
              >
                <span className="text-gray-500">[{log.time}]</span> {log.message}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 text-xs text-gray-500 bg-yellow-50 border border-yellow-200 rounded p-2">
        ⚠️ <strong>Development Mode:</strong> This runs checks every 1 minutes while this page is open. 
        In production, Vercel Cron will handle automatic checks.
      </div>
    </div>
  );
}