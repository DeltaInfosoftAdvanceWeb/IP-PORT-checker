"use client";

import { Plus, X } from "lucide-react";
import React, { useState } from "react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import useIPPortStore from "@/store/useIPPortStore";
import { Label } from "./ui/label";

const IPPortForm = () => {
  const { closeModal, addConfiguration, isLoading,checkAllStatus } = useIPPortStore();
  const [entries, setEntries] = useState([{ id: "1", ip: "", port: "" }]);
  const [configName,setConfigName] = useState("")
  const [nextId, setNextId] = useState(2);

  const addEntry = () => {
    setEntries([...entries, { id: nextId, ip: "", port: "" }]);
    setNextId(nextId + 1);
  };

  const removeEntry = (id) => {
    if (entries.length > 1) {
      setEntries(entries.filter((ent) => ent.id !== id));
    }
  };

  const updateEntry = (id, field, value) => {
    setEntries(
      entries.map((entry) =>
        entry.id === id ? { ...entry, [field]: value } : entry
      )
    );
  };

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
            newEntries.push({ id: nextId + index - 1, ip, port });
          } else {
            newEntries.push({
              id: nextId + index - 1,
              ip: "",
              port: trimmedLine,
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

  const handleSubmit = async () => {
    const result = await addConfiguration({
      entries: entries.map(({ ip, port }) => ({ ip, port })),
      configName
    });

    if (result.success) {
      setEntries([{ id: "1", ip: "", port: "" }]);
      setNextId(2);
      checkAllStatus()
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/20 z-50 p-4 overflow-y-auto">
      <div className="bg-gray-50 p-4 sm:p-6 rounded-md w-full max-w-2xl lg:max-w-4xl my-4">
        <div className="mx-auto">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
            <div className="flex items-center justify-center mb-4 sm:mb-6">
              <div>
                <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 text-center">
                  IP & PORT Configuration
                </h1>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <Label>Config Name:</Label>
                <Input type="text" onChange={(e)=> setConfigName(e.target.value)} value={configName} className="rounded outline-none w-full" />
              </div>
              <div className="hidden sm:grid grid-cols-12 gap-3 text-xs font-medium text-gray-500 uppercase tracking-wide pb-2">
                <div className="col-span-5">IP Address</div>
                <div className="col-span-5">Port</div>
                <div className="col-span-2"></div>
              </div>
              {entries.map((ent, i) => (
                <div
                  key={ent.id}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-3 items-center group"
                >
                  <div className="sm:col-span-5">
                    <label className="block sm:hidden text-xs font-medium text-gray-500 mb-1">
                      IP Address
                    </label>
                    <Input
                      type="text"
                      value={ent.ip}
                      onChange={(e) =>
                        updateEntry(ent.id, "ip", e.target.value)
                      }
                      onPaste={(e) => handlePaste(e, ent.id, "ip")}
                      placeholder="192.168.1.1 or paste multiple"
                      className="rounded outline-none w-full"
                    />
                  </div>
                  <div className="sm:col-span-5">
                    <label className="block sm:hidden text-xs font-medium text-gray-500 mb-1">
                      Port
                    </label>
                    <Input
                      type="text"
                      value={ent.port}
                      onChange={(e) =>
                        updateEntry(ent.id, "port", e.target.value)
                      }
                      placeholder="3000 or paste multiple"
                      onPaste={(e) => handlePaste(e, ent.id, "port")}
                      className="rounded outline-none w-full"
                    />
                  </div>
                  <div className="sm:col-span-2 flex justify-end sm:justify-end">
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
                      <span className="sm:hidden ml-2">Remove</span>
                    </Button>
                  </div>
                </div>
              ))}
              <Button
                type="button"
                onClick={addEntry}
                className="bg-transparent text-black flex w-full hover:bg-gray-50 border-dashed border rounded-md"
              >
                <Plus size={16} />
                <span className="ml-2">Add Entry</span>
              </Button>

              <div className="pt-4 sm:pt-6 border-t border-gray-200 mt-4 sm:mt-6 flex flex-col sm:flex-row items-center gap-3 sm:gap-4 justify-between">
                <Button
                  onClick={closeModal}
                  className="w-full bg-transparent text-black hover:bg-gray-100"
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? "Saving..." : "Save Configuration"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IPPortForm;