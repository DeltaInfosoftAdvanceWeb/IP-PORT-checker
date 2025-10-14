"use client";

import { Plus, X } from "lucide-react";
import React, { useEffect, useState } from "react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import useIPPortStore from "@/store/useIPPortStore";
import { toast } from "react-hot-toast";

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
    { id: "1", ip: "", port: "", referPortName: "", emails: "" },
  ]);
  const [nextId, setNextId] = useState(2);

  // ➕ Add new entry
  const addEntry = () => {
    setEntries([
      ...entries,
      { id: nextId, ip: "", port: "", referPortName: "", emails: "" },
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
              emails: "",
            });
          } else {
            newEntries.push({
              id: nextId + index - 1,
              ip: "",
              port: trimmedLine,
              referPortName: "",
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
    const formattedEntries = entries.map(({ ip, port, referPortName, emails }) => ({
      ip,
      port,
      referPortName,
      emails: typeof emails === "string"
        ? emails.split(/[,\n]/).map((e) => e.trim()).filter(Boolean)
        : emails,
    }));

    const result = await addConfiguration({ entries: formattedEntries });

    if (result.success) {
      toast.success("Configuration saved successfully!");
      setEntries([{ id: "1", ip: "", port: "", referPortName: "", emails: "" }]);
      setNextId(2);
      checkAllStatus();
    }
  };

  // ✏️ Update existing configuration
  const handleUpdate = async () => {
    const formattedEntries = entries.map(({ ip, port, referPortName, emails }) => ({
      ip,
      port,
      referPortName,
      emails: typeof emails === "string"
        ? emails.split(/[,\n]/).map((e) => e.trim()).filter(Boolean)
        : emails,
    }));

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
    setEntries([{ id: "1", ip: "", port: "", referPortName: "", emails: "" }]);
    setNextId(2);
    closeEdit();
    closeModal();
  };

  // 🧩 Fetch config if editing
  useEffect(() => {
    const fetchConfigData = async () => {
      if (isEditing && configId && entryId) {
        const response = await getById(configId, entryId);
        if (response.success && response.IpConfigData) {
          toast.success("IP config fetched successfully");
          setEntries([
            {
              ...response.IpConfigData,
              id: response.IpConfigData._id?.toString() || "1",
              emails: Array.isArray(response.IpConfigData.emails)
                ? response.IpConfigData.emails.join(", ")
                : response.IpConfigData.emails || "",
            },
          ]);
        }
      }
    };
    fetchConfigData();
  }, [configId, entryId, isEditing]);

  return (
    <>

      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20 p-4 overflow-y-auto">
        <div className="bg-gray-50 p-4 sm:p-6 rounded-md w-full max-w-6xl my-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 text-center mb-6">
              {isEditing ? "Edit IP & PORT Configuration" : "IP & PORT Configuration"}
            </h1>

            <div className="space-y-4">
              <div className="border rounded border-gray-200 py-6 px-3 space-y-3">
                <div className="hidden sm:grid grid-cols-12 gap-3 text-xs font-medium text-gray-500 uppercase tracking-wide pb-2">
                  <div className="col-span-3">IP Address</div>
                  <div className="col-span-2">Port</div>
                  <div className="col-span-3">Refer Port Name</div>
                  <div className="col-span-3">Emails</div>
                  <div className="col-span-1"></div>
                </div>

                {entries.map((ent) => (
                  <div
                    key={ent.id}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center"
                  >
                    <div className="sm:col-span-3">
                      <Input
                        type="text"
                        value={ent.ip}
                        onChange={(e) => updateEntry(ent.id, "ip", e.target.value)}
                        onPaste={(e) => handlePaste(e, ent.id, "ip")}
                        placeholder="192.168.1.1"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Input
                        type="text"
                        value={ent.port}
                        onChange={(e) => updateEntry(ent.id, "port", e.target.value)}
                        placeholder="3000"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <Input
                        type="text"
                        value={ent.referPortName}
                        onChange={(e) =>
                          updateEntry(ent.id, "referPortName", e.target.value)
                        }
                        placeholder="postgres"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <Input
                        type="text"
                        value={ent.emails}
                        onChange={(e) => updateEmails(ent.id, e.target.value)}
                        placeholder="email1@example.com, email2@example.com"
                      />
                    </div>
                    <div className="sm:col-span-1 flex justify-end">
                      {!isEditing && (
                        <Button
                          type="button"
                          className={`${
                            entries.length === 1
                              ? "cursor-not-allowed"
                              : "text-white bg-red-600 hover:bg-red-400"
                          } w-full sm:w-auto`}
                          disabled={entries.length === 1}
                          onClick={() => removeEntry(ent.id)}
                        >
                          <X size={18} />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {!isEditing && (
                <Button
                  type="button"
                  onClick={addEntry}
                  className="bg-transparent text-black flex w-full hover:bg-gray-50 border-dashed border rounded-md"
                >
                  <Plus size={16} />
                  <span className="ml-2">Add Entry</span>
                </Button>
              )}

              <div className="pt-4 border-t flex flex-col sm:flex-row items-center gap-3 justify-between">
                <Button
                  onClick={handleClose}
                  className="w-full bg-transparent text-black hover:bg-gray-100"
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                {!isEditing ? (
                  <Button
                    onClick={handleSubmit}
                    className="w-full"
                    disabled={isLoading}
                  >
                    {isLoading ? "Saving..." : "Save Configuration"}
                  </Button>
                ) : (
                  <Button
                    onClick={handleUpdate}
                    className="w-full"
                    disabled={isLoading}
                  >
                    {isLoading ? "Saving..." : "Update Configuration"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default IPPortForm;
