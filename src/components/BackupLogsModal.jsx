"use client";
import React, { useState, useEffect } from "react";
import { Modal, Select, Input, Spin, Button } from "antd";
import { Calendar, LoaderCircle, Database, Search } from "lucide-react";
import toast from "react-hot-toast";

const { Option } = Select;

const BackupLogsModal = ({ visible, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [backupLogs, setBackupLogs] = useState([]);
  const [clientFilter, setClientFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);

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

  const fetchBackupLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (clientFilter !== "all") params.append("clientName", clientFilter);
      if (projectFilter !== "all") params.append("projectName", projectFilter);

      const response = await fetch(
        `/api/backup-schedule/get?${params.toString()}`
      );
      const result = await response.json();

      if (result.success) {
        setBackupLogs(result.data);

        // Extract unique clients and projects
        const uniqueClients = [
          ...new Set(result.data.map((log) => log.clientName)),
        ];
        const uniqueProjects = [
          ...new Set(result.data.map((log) => log.projectName)),
        ];

        setClients(uniqueClients);
        setProjects(uniqueProjects);

        toast.success(`Loaded ${result.count} backup schedules`);
      } else {
        toast.error(result.message || "Failed to fetch backup logs");
      }
    } catch (error) {
      console.error("Error fetching backup logs:", error);
      toast.error("Failed to fetch backup logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      fetchBackupLogs();
    }
  }, [visible, clientFilter, projectFilter]);

  const filteredLogs = backupLogs.filter((log) => {
    const matchesSearch =
      log.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.projectName?.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesSearch;
  });

  const calculateDuration = (startTime, endTime) => {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const durationMs = end - start;
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  return (
    <Modal
      title={
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-[#1ca5b3]" />
          <span>Backup Schedules</span>
        </div>
      }
      open={visible}
      onCancel={onClose}
      width={1200}
      footer={null}
      className="backup-logs-modal"
    >
      <div className="space-y-4">
        {/* Filters */}
        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search
              </label>
              <Input
                placeholder="Search by client or project"
                prefix={<Search className="w-4 h-4 text-gray-400" />}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-xl"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Client
              </label>
              <Select
                value={clientFilter}
                onChange={setClientFilter}
                className="w-full"
              >
                <Option value="all">All Clients</Option>
                {clients.map((client) => (
                  <Option key={client} value={client}>
                    {client}
                  </Option>
                ))}
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Project
              </label>
              <Select
                value={projectFilter}
                onChange={setProjectFilter}
                className="w-full"
              >
                <Option value="all">All Projects</Option>
                {projects.map((project) => (
                  <Option key={project} value={project}>
                    {project}
                  </Option>
                ))}
              </Select>
            </div>
          </div>

          <div className="mt-4 flex justify-between items-center">
            <div className="text-sm text-gray-600">
              Total Schedules:{" "}
              <span className="font-bold">{filteredLogs.length}</span>
            </div>
            <Button
              onClick={fetchBackupLogs}
              loading={loading}
              type="primary"
              className="bg-[#1ca5b3]"
            >
              Refresh Data
            </Button>
          </div>
        </div>

        {/* Backup Logs Table */}
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <Spin
              size="large"
              indicator={
                <LoaderCircle className="animate-spin" color="#1ca5b3" />
              }
            />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-20">
            <Database className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-lg text-gray-500 font-medium">
              No backup schedules found
            </p>
            <p className="text-sm text-gray-400 mt-2">
              Try changing filters or add a new schedule
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gradient-to-r from-[#1ca5b3] to-[#0e7c87] text-white">
                  <th className="px-4 py-3 text-left text-sm font-semibold rounded-tl-xl">
                    Client Name
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">
                    Project Name
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">
                    Backup Start Time
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">
                    Backup End Time
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">
                    Duration
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold rounded-tr-xl">
                    Created At
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log, index) => (
                  <tr
                    key={log._id}
                    className={`border-b border-gray-200 hover:bg-gray-50 transition-colors ${
                      index % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                    }`}
                  >
                    <td className="px-4 py-3 font-semibold text-gray-900">
                      {log.clientName}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {log.projectName}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-green-600" />
                        {formatDateTime(log.backupStartTime)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-red-600" />
                        {formatDateTime(log.backupEndTime)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-[#1ca5b3]">
                      {calculateDuration(
                        log.backupStartTime,
                        log.backupEndTime
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatDateTime(log.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default BackupLogsModal;
