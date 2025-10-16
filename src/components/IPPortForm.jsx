"use client";

import { Plus, X, Server, Upload, FileSpreadsheet, Info, UserPlus, FileDown } from "lucide-react";
import React, { useEffect, useState, useRef } from "react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import useIPPortStore from "@/store/useIPPortStore";
import { toast } from "react-hot-toast";
import axios from "axios";
import { Select, Modal } from "antd";
import * as XLSX from "xlsx";

const { Option } = Select;

const IPPortForm = ({ configId, entryId }) => {
  const {
    closeModal,
    addConfiguration,
    isLoading,
    checkAllStatus,
    fetchConfigurations,
    getById,
    updateConfiguration,
    closeEdit,
    isEditing,
  } = useIPPortStore();

  // 🧩 Default entry now keeps emails as string, not array
  const [entries, setEntries] = useState([
    { id: "1", ip: "", port: "", referPortName: "", clientName: "", emails: "" },
  ]);
  const [nextId, setNextId] = useState(2);
  const [bulkInput, setBulkInput] = useState("");
  const [showBulkInput, setShowBulkInput] = useState(false);
  const [clients, setClients] = useState([]);
  const [isAddClientModalOpen, setIsAddClientModalOpen] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const fileInputRef = useRef(null);

  // 🏢 Fetch clients on mount
  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const response = await axios.post("/api/clients/get", {});
      if (response.data.success) {
        setClients(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching clients:", error);
    }
  };

  const handleAddNewClient = async () => {
    if (!newClientName.trim()) {
      toast.error("Client name cannot be empty");
      return;
    }

    try {
      const response = await axios.post("/api/clients/add", {
        name: newClientName.trim(),
      });

      if (response.data.success) {
        toast.success("Client added successfully!");
        setClients([...clients, response.data.data]);
        setNewClientName("");
        setIsAddClientModalOpen(false);
      }
    } catch (error) {
      console.error("Error adding client:", error);
      if (error.response?.status === 409) {
        toast.error("Client already exists");
      } else {
        toast.error(error.response?.data?.message || "Failed to add client");
      }
    }
  };

  // Auto-create client if doesn't exist
  const ensureClientExists = async (clientName) => {
    if (!clientName || !clientName.trim()) return;

    const existingClient = clients.find(c => c.name === clientName.trim());
    if (existingClient) return;

    try {
      const response = await axios.post("/api/clients/add", {
        name: clientName.trim(),
      });

      if (response.data.success) {
        setClients([...clients, response.data.data]);
      }
    } catch (error) {
      // Ignore 409 (already exists) error
      if (error.response?.status !== 409) {
        console.error("Error creating client:", error);
      }
    }
  };

  // Handle Excel Import
  const handleExcelImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        if (jsonData.length === 0) {
          toast.error("Excel file is empty");
          return;
        }

        toast.loading("Processing Excel data...");

        const newEntries = [];
        let currentId = nextId;
        const uniqueClients = new Set();

        // Process each row
        for (const row of jsonData) {
          const ip = row.IP || row.ip || "";
          const port = row.Port || row.PORT || row.port || "";
          const referPortName = row["Reference Name"] || row["Refer Port Name"] || row.referPortName || row.reference_name || "";
          const clientName = row["Client Name"] || row.clientName || row.client_name || "";
          const emailsStr = row.Emails || row.emails || row.EMAIL || "";

          // Parse emails
          let emails = "";
          if (emailsStr) {
            if (typeof emailsStr === "string") {
              emails = emailsStr;
            } else {
              emails = String(emailsStr);
            }
          }

          if (ip && port) {
            newEntries.push({
              id: currentId++,
              ip: String(ip).trim(),
              port: String(port).trim(),
              referPortName: String(referPortName).trim(),
              clientName: String(clientName).trim(),
              emails: emails,
            });

            // Track unique clients
            if (clientName && clientName.trim()) {
              uniqueClients.add(clientName.trim());
            }
          }
        }

        // Auto-create clients that don't exist
        for (const clientName of uniqueClients) {
          await ensureClientExists(clientName);
        }

        if (newEntries.length > 0) {
          setEntries(newEntries);
          setNextId(currentId);
          toast.dismiss();
          toast.success(`Successfully imported ${newEntries.length} configurations!`);
        } else {
          toast.dismiss();
          toast.error("No valid entries found in Excel file");
        }

        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      } catch (error) {
        console.error("Error parsing Excel:", error);
        toast.dismiss();
        toast.error("Failed to parse Excel file. Please check the format.");
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // Download Excel Template
  const downloadExcelTemplate = () => {
    const template = [
      {
        IP: "192.168.1.1",
        Port: "3000",
        "Reference Name": "postgres",
        "Client Name": "Waterman",
        Emails: "admin@example.com, user@example.com",
      },
      {
        IP: "192.168.1.2",
        Port: "8080",
        "Reference Name": "api-server",
        "Client Name": "Desire",
        Emails: "dev@example.com",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "IP-Port Configs");

    // Auto-width columns
    const colWidths = [
      { wch: 15 }, // IP
      { wch: 8 },  // Port
      { wch: 20 }, // Reference Name
      { wch: 20 }, // Client Name
      { wch: 40 }, // Emails
    ];
    ws["!cols"] = colWidths;

    XLSX.writeFile(wb, "IP-Port-Config-Template.xlsx");
    toast.success("Template downloaded!");
  };

  // ➕ Add new entry
  const addEntry = () => {
    setEntries([
      ...entries,
      { id: nextId, ip: "", port: "", referPortName: "", clientName: "", emails: "" },
    ]);
    setNextId(nextId + 1);
  };

  // ❌ Remove entry
  const removeEntry = (id) => {
    if (entries.length > 1) {
      setEntries(entries.filter((ent) => ent.id !== id));
    }
  };

  // ✏️ Update entry field
  const updateEntry = (id, field, value) => {
    setEntries(
      entries.map((entry) =>
        entry.id === id ? { ...entry, [field]: value } : entry
      )
    );
  };

  // 🧠 Keep email as raw text — only split during submit
  const updateEmails = (id, value) => {
    updateEntry(id, "emails", value);
  };

  // 📋 Process bulk input
  const processBulkInput = () => {
    if (!bulkInput.trim()) {
      toast.error("Please enter configuration data");
      return;
    }

    const lines = bulkInput.split("\n").filter((line) => line.trim());
    const newEntries = [];
    let currentId = nextId;

    lines.forEach((line) => {
      const trimmedLine = line.trim();

      // Support formats: IP:PORT, IP PORT, or just IP
      let ip = "";
      let port = "";
      let referPortName = "";
      let clientName = "";
      let emails = "";

      if (trimmedLine.includes(",")) {
        // CSV format: IP, PORT, NAME, CLIENT, EMAILS
        const parts = trimmedLine.split(",").map((s) => s.trim());
        ip = parts[0] || "";
        port = parts[1] || "";
        referPortName = parts[2] || "";
        clientName = parts[3] || "";
        emails = parts[4] || "";
      } else if (trimmedLine.includes(":")) {
        // IP:PORT format
        const [ipPart, portPart] = trimmedLine.split(":").map((s) => s.trim());
        ip = ipPart;
        port = portPart;
      } else if (trimmedLine.includes(" ")) {
        // IP PORT format
        const parts = trimmedLine.split(/\s+/);
        ip = parts[0] || "";
        port = parts[1] || "";
      } else {
        // Just IP
        ip = trimmedLine;
      }

      if (ip) {
        newEntries.push({
          id: currentId++,
          ip,
          port,
          referPortName,
          clientName,
          emails,
        });
      }
    });

    if (newEntries.length > 0) {
      setEntries(newEntries);
      setNextId(currentId);
      setBulkInput("");
      setShowBulkInput(false);
      toast.success(`${newEntries.length} configuration(s) added`);
    } else {
      toast.error("No valid configurations found");
    }
  };

  // 📋 Handle paste of multiple IPs or ports
  const handlePaste = (e, id, field) => {
    const pastedText = e.clipboardData.getData("text");
    const lines = pastedText.split("\n").filter((line) => line.trim());

    if (lines.length > 1) {
      e.preventDefault();

      const newEntries = [];
      const currentIndex = entries.findIndex((entry) => entry.id === id);

      lines.forEach((line, index) => {
        const trimmedLine = line.trim();
        if (index === 0) {
          if (field === "ip") {
            const [ip, port] = trimmedLine.includes(":")
              ? trimmedLine.split(":").map((s) => s.trim())
              : [trimmedLine, ""];
            newEntries.push({
              ...entries[currentIndex],
              ip,
              port: port || entries[currentIndex].port,
            });
          } else {
            newEntries.push({ ...entries[currentIndex], [field]: trimmedLine });
          }
        } else {
          if (field === "ip") {
            const [ip, port] = trimmedLine.includes(":")
              ? trimmedLine.split(":").map((s) => s.trim())
              : [trimmedLine, ""];
            newEntries.push({
              id: nextId + index - 1,
              ip,
              port,
              referPortName: "",
              clientName: "",
              emails: "",
            });
          } else {
            newEntries.push({
              id: nextId + index - 1,
              ip: "",
              port: trimmedLine,
              referPortName: "",
              clientName: "",
              emails: "",
            });
          }
        }
      });

      const updatedEntries = [
        ...entries.slice(0, currentIndex),
        ...newEntries,
        ...entries.slice(currentIndex + 1),
      ];

      setEntries(updatedEntries);
      setNextId(nextId + lines.length);
    }
  };

  // 💾 Submit new configuration
  const handleSubmit = async () => {
    const formattedEntries = entries.map(
      ({ ip, port, referPortName, clientName, emails }) => ({
        ip,
        port,
        referPortName,
        clientName,
        emails:
          typeof emails === "string"
            ? emails
                .split(/[,\n]/)
                .map((e) => e.trim())
                .filter(Boolean)
            : emails,
      })
    );

    const result = await addConfiguration({ entries: formattedEntries });

    if (result.success) {
      toast.success("Configuration saved successfully!");
      setEntries([
        { id: "1", ip: "", port: "", referPortName: "", clientName: "", emails: "" },
      ]);
      setNextId(2);
      checkAllStatus();
    }
  };

  // ✏️ Update existing configuration
  const handleUpdate = async () => {
    const formattedEntries = entries.map(
      ({ ip, port, referPortName, clientName, emails }) => ({
        ip,
        port,
        referPortName,
        clientName,
        emails:
          typeof emails === "string"
            ? emails
                .split(/[,\n]/)
                .map((e) => e.trim())
                .filter(Boolean)
            : emails,
      })
    );

    try {
      const { data } = await updateConfiguration({
        entries: formattedEntries,
        configId,
        entryId,
      });

      if (data.success) {
        toast.success(data.message);
        fetchConfigurations();
        checkAllStatus();
        handleClose();
      }
    } catch (error) {
      console.error("Error updating configuration:", error);
    }
  };

  // 🧹 Close modal
  const handleClose = () => {
    setEntries([{ id: "1", ip: "", port: "", referPortName: "", clientName: "", emails: "" }]);
    setNextId(2);
    closeEdit();
    closeModal();
  };

  // 🧩 Fetch config if editing
  useEffect(() => {
    const fetchConfigData = async () => {
      if (isEditing && configId && entryId) {
        const response = await getById(configId, entryId);
        if (response.success && response.entry) {
          toast.success("IP config fetched successfully");
          setEntries([
            {
              ...response.entry,
              id: response.entry._id?.toString() || "1",
              clientName: response.entry.clientName || "",
              emails: Array.isArray(response.entry.emails)
                ? response.entry.emails.join(", ")
                : response.entry.emails || "",
            },
          ]);
        }
      }
    };
    fetchConfigData();
  }, [configId, entryId, isEditing]);

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl my-8 border border-gray-200 max-h-[90vh] flex flex-col">
          {/* Professional Header */}
          <div className="bg-gradient-to-r from-[#1ca5b3] to-[#0e7c87] p-6 rounded-t-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 backdrop-blur-sm p-3 rounded-xl">
                  <Server className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">
                    {isEditing
                      ? "Edit Configuration"
                      : "IP & PORT Configuration"}
                  </h1>
                  <p className="text-white/80 text-sm mt-1">
                    Configure your server endpoints and monitoring settings
                  </p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="text-white/80 hover:text-white hover:bg-white/20 p-2 rounded-lg transition-all"
              >
                <X size={24} />
              </button>
            </div>
          </div>

          {/* Scrollable Content Area */}
          <div className="p-6 space-y-6 overflow-y-auto flex-1">
            {/* Bulk Input Section */}
            {!isEditing && (
              <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-5 border-2 border-dashed border-[#1ca5b3]">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-[#1ca5b3] p-2 rounded-lg">
                      <FileSpreadsheet className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800">
                        Bulk Import
                      </h3>
                      <p className="text-sm text-gray-600">
                        Add multiple configurations at once
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    onClick={() => setShowBulkInput(!showBulkInput)}
                    className="bg-[#1ca5b3] hover:bg-[#0e7c87] text-white text-sm"
                  >
                    {showBulkInput ? "Hide" : "Show"} Bulk Input
                  </Button>
                </div>

                {showBulkInput && (
                  <div className="space-y-3">
                    <div className="bg-white/70 backdrop-blur-sm rounded-lg p-3 border border-[#1ca5b3]/30">
                      <div className="flex items-start gap-2 text-xs text-gray-700">
                        <Info className="h-4 w-4 text-[#1ca5b3] mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-medium mb-1">Supported Formats:</p>
                          <ul className="space-y-1 list-disc list-inside ml-2">
                            <li>
                              <span className="font-mono bg-gray-100 px-1 rounded">
                                192.168.1.1:3000
                              </span>{" "}
                              - IP with port
                            </li>
                            <li>
                              <span className="font-mono bg-gray-100 px-1 rounded">
                                192.168.1.1 3000
                              </span>{" "}
                              - IP and port separated by space
                            </li>
                            <li>
                              <span className="font-mono bg-gray-100 px-1 rounded">
                                192.168.1.1
                              </span>{" "}
                              - IP only
                            </li>
                            <li>
                              <span className="font-mono bg-gray-100 px-1 rounded">
                                192.168.1.1, 3000, postgres, admin@example.com
                              </span>{" "}
                              - Full CSV format
                            </li>
                          </ul>
                          <p className="mt-2 text-gray-600">
                            Enter one configuration per line
                          </p>
                        </div>
                      </div>
                    </div>

                    <textarea
                      value={bulkInput}
                      onChange={(e) => setBulkInput(e.target.value)}
                      placeholder="Paste your configurations here (one per line)&#10;Example:&#10;192.168.1.1:3000&#10;192.168.1.2, 8080, postgres, admin@example.com&#10;192.168.1.3 5432"
                      className="w-full h-32 p-3 border-2 border-gray-300 rounded-lg focus:border-[#1ca5b3] focus:ring-2 focus:ring-[#1ca5b3]/20 outline-none font-mono text-sm resize-none"
                    />

                    <div className="flex gap-2">
                      <Button
                        type="button"
                        onClick={processBulkInput}
                        className="flex-1 bg-[#1ca5b3] hover:bg-[#0e7c87] text-white"
                      >
                        <Upload size={16} />
                        <span className="ml-2">Import Configurations</span>
                      </Button>
                      <Button
                        type="button"
                        onClick={() => {
                          setBulkInput("");
                          setShowBulkInput(false);
                        }}
                        className="bg-gray-200 hover:bg-gray-300 text-gray-700"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Individual Entries Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-800 text-lg">
                  Configuration Entries
                </h3>
                <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                  {entries.length} {entries.length === 1 ? "entry" : "entries"}
                </span>
              </div>

              <div className="border rounded-xl border-gray-200 py-6 px-3 space-y-3 bg-gray-50 max-h-[400px] overflow-y-auto">
                <div className="hidden sm:grid grid-cols-12 gap-3 text-xs font-medium text-gray-500 uppercase tracking-wide pb-2">
                  <div className="col-span-2">IP Address</div>
                  <div className="col-span-2">Port</div>
                  <div className="col-span-2">Refer Port Name</div>
                  <div className="col-span-2">Client Name</div>
                  <div className="col-span-3">Emails</div>
                  <div className="col-span-1"></div>
                </div>

                {entries.map((ent, index) => (
                  <div
                    key={ent.id}
                    className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 hover:border-[#1ca5b3] transition-all"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <div className="bg-[#1ca5b3] text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
                        {index + 1}
                      </div>
                      <span className="text-xs text-gray-500 font-medium">
                        Configuration Entry
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                      <div className="sm:col-span-2">
                        <label className="text-xs font-medium text-gray-600 mb-1 block sm:hidden">
                          IP Address
                        </label>
                        <Input
                          type="text"
                          value={ent.ip}
                          onChange={(e) =>
                            updateEntry(ent.id, "ip", e.target.value)
                          }
                          onPaste={(e) => handlePaste(e, ent.id, "ip")}
                          placeholder="192.168.1.1"
                          className="border-gray-300 focus:border-[#1ca5b3] focus:ring-[#1ca5b3]"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-xs font-medium text-gray-600 mb-1 block sm:hidden">
                          Port
                        </label>
                        <Input
                          type="text"
                          value={ent.port}
                          onChange={(e) =>
                            updateEntry(ent.id, "port", e.target.value)
                          }
                          placeholder="3000"
                          className="border-gray-300 focus:border-[#1ca5b3] focus:ring-[#1ca5b3]"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-xs font-medium text-gray-600 mb-1 block sm:hidden">
                          Refer Port Name
                        </label>
                        <Input
                          type="text"
                          value={ent.referPortName}
                          onChange={(e) =>
                            updateEntry(ent.id, "referPortName", e.target.value)
                          }
                          placeholder="postgres"
                          className="border-gray-300 focus:border-[#1ca5b3] focus:ring-[#1ca5b3]"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-xs font-medium text-gray-600 mb-1 block sm:hidden">
                          Client Name
                        </label>
                        <Select
                          showSearch
                          value={ent.clientName || undefined}
                          placeholder="Select or search client"
                          onChange={(value) => updateEntry(ent.id, "clientName", value)}
                          className="w-full"
                          style={{ height: '40px' }}
                          filterOption={(input, option) =>
                            (option?.children ?? '').toLowerCase().includes(input.toLowerCase())
                          }
                          dropdownRender={(menu) => (
                            <>
                              {menu}
                              <div className="border-t border-gray-200 p-2">
                                <Button
                                  type="button"
                                  onClick={() => setIsAddClientModalOpen(true)}
                                  className="w-full flex items-center justify-center gap-2 bg-[#1ca5b3] hover:bg-[#0e7c87] text-white"
                                >
                                  <UserPlus size={16} />
                                  Add New Client
                                </Button>
                              </div>
                            </>
                          )}
                        >
                          {clients.map((client) => (
                            <Option key={client._id} value={client.name}>
                              {client.name}
                            </Option>
                          ))}
                        </Select>
                      </div>
                      <div className="sm:col-span-3">
                        <label className="text-xs font-medium text-gray-600 mb-1 block sm:hidden">
                          Emails
                        </label>
                        <Input
                          type="text"
                          value={ent.emails}
                          onChange={(e) => updateEmails(ent.id, e.target.value)}
                          placeholder="email1@example.com, email2@example.com"
                          className="border-gray-300 focus:border-[#1ca5b3] focus:ring-[#1ca5b3]"
                        />
                      </div>
                      <div className="sm:col-span-1 flex justify-end">
                        {!isEditing && (
                          <Button
                            type="button"
                            className={`${
                              entries.length === 1
                                ? "cursor-not-allowed bg-gray-300 hover:bg-gray-300"
                                : "text-white bg-red-500 hover:bg-red-600"
                            } w-full sm:w-auto transition-all`}
                            disabled={entries.length === 1}
                            onClick={() => removeEntry(ent.id)}
                          >
                            <X size={18} />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {!isEditing && (
                <Button
                  type="button"
                  onClick={addEntry}
                  className="bg-gray-100 mt-2 text-[#1ca5b3] hover:bg-gray-200 flex w-full justify-center items-center border-2 border-dashed border-[#1ca5b3] rounded-lg py-3 font-medium transition-all"
                >
                  <Plus size={18} />
                  <span className="ml-2">Add Another Entry</span>
                </Button>
              )}
            </div>
          </div>

          {/* Fixed Action Buttons Footer */}
          <div className="p-6 border-t-2 border-gray-200 bg-gray-50 rounded-b-2xl flex flex-col sm:flex-row items-center gap-3 justify-end flex-shrink-0">
            <Button
              onClick={handleClose}
              className="w-full sm:w-auto bg-white border-2 border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 px-8 py-2.5 font-medium"
              disabled={isLoading}
            >
              Cancel
            </Button>
            {!isEditing ? (
              <Button
                onClick={handleSubmit}
                className="w-full sm:w-auto bg-gradient-to-r from-[#1ca5b3] to-[#0e7c87] hover:from-[#0e7c87] hover:to-[#1ca5b3] text-white px-8 py-2.5 font-medium shadow-lg shadow-[#1ca5b3]/30 transition-all"
                disabled={isLoading}
              >
                {isLoading ? "Saving..." : "Save Configuration"}
              </Button>
            ) : (
              <Button
                onClick={handleUpdate}
                className="w-full sm:w-auto bg-gradient-to-r from-[#1ca5b3] to-[#0e7c87] hover:from-[#0e7c87] hover:to-[#1ca5b3] text-white px-8 py-2.5 font-medium shadow-lg shadow-[#1ca5b3]/30 transition-all"
                disabled={isLoading}
              >
                {isLoading ? "Updating..." : "Update Configuration"}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Add Client Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-[#1ca5b3]" />
            <span>Add New Client</span>
          </div>
        }
        open={isAddClientModalOpen}
        onOk={handleAddNewClient}
        onCancel={() => {
          setIsAddClientModalOpen(false);
          setNewClientName("");
        }}
        okText="Add Client"
        cancelText="Cancel"
        okButtonProps={{
          className: "bg-[#1ca5b3] hover:bg-[#0e7c87]",
        }}
      >
        <div className="py-4">
          <label className="text-sm font-medium text-gray-700 mb-2 block">
            Client Name
          </label>
          <Input
            type="text"
            value={newClientName}
            onChange={(e) => setNewClientName(e.target.value)}
            placeholder="Enter client name (e.g., Waterman, Desire)"
            className="border-gray-300 focus:border-[#1ca5b3] focus:ring-[#1ca5b3]"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleAddNewClient();
              }
            }}
          />
        </div>
      </Modal>
    </>
  );
};

export default IPPortForm;
