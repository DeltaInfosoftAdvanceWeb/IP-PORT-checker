import { create } from "zustand";
import axios from "axios";
import toast from "react-hot-toast";

const useIPPortStore = create((set, get) => ({
  // State
  entries: [],
  isChecking: false,
  isModalOpen: false,
  isLoading: false,
  isEditing: false,

  // Modal Actions
  openModal: () => set({ isModalOpen: true }),
  closeModal: () => set({ isModalOpen: false }),

  // Edit Mode
  openEdit: () => set({ isEditing: true }),
  closeEdit: () => set({ isEditing: false }),

  // Fetch all IP/Port configurations
  fetchConfigurations: async (silent = false) => {
    if (!silent) set({ isLoading: true });
    try {
      const { data } = await axios.get("/api/ip-port-config/get");
      if (data.success) {
        set({
          entries: data.data.filter(
            (config) =>
              Array.isArray(config.entries) && config.entries.length > 0
          ),
        });
      }
    } catch (error) {
      console.error("Error fetching configurations:", error);
      if (!silent)
        toast.error(
          error?.response?.data?.message || "Failed to fetch configurations"
        );
    } finally {
      if (!silent) set({ isLoading: false });
    }
  },

  // Add new configuration
  addConfiguration: async (configData) => {
    set({ isLoading: true });
    try {
      const response = await axios.post("/api/ip-port-config/add", configData);
      if (response.data.success) {
        await get().fetchConfigurations();
        get().closeModal();
        return { success: true };
      } else {
        toast.error(response.data.message || "Failed to save configuration");
        return { success: false };
      }
    } catch (error) {
      console.error("Failed to save configuration:", error);
      toast.error(
        error?.response?.data?.message || "An error occurred while saving"
      );
      return { success: false };
    } finally {
      set({ isLoading: false });
    }
  },

  // Delete configuration
  deleteConfiguration: async (configId, entryId) => {
    set({ isLoading: true });
    try {
      const response = await axios.post("/api/ip-port-config/delete", {
        configId,
        entryId,
      });

      if (response.data.success) {
        if (response.data.configDeleted) {
          set((state) => ({
            entries: state.entries.filter((config) => config._id !== configId),
          }));
          toast.success(response.data.message);
        } else {
          set((state) => ({
            entries: state.entries.map((config) => {
              if (config._id === configId) {
                return {
                  ...config,
                  entries: config.entries.filter(
                    (e) => e._id.toString() !== entryId.toString()
                  ),
                };
              }
              return config;
            }),
          }));
          toast.success(
            `Entry deleted successfully. ${response.data.remainingEntries} ${
              response.data.remainingEntries === 1 ? "entry" : "entries"
            } remaining.`
          );
        }
      } else {
        toast.error(response.data.message || "Failed to delete configuration");
      }
    } catch (error) {
      console.error("Error deleting configuration:", error);
      toast.error(
        error?.response?.data?.message || "An error occurred while deleting"
      );
    } finally {
      set({ isLoading: false });
    }
  },

  // --- Updated: Check status for all entries ---
  checkAllStatus: async () => {
    const { entries, isChecking } = get();

    if (isChecking) {
      console.log("Already checking all statuses, skipping...");
      return;
    }

    if (!entries || entries.length === 0) {
      toast.info("No entries to check");
      return;
    }

    set({ isChecking: true });

    try {
      const allEntries = entries.flatMap((config) =>
        config.entries.map((e) => ({
          ...e,
          configId: config._id,
        }))
      );

      const response = await axios.post("/api/ip-port-config/check-status", {
        entries: allEntries,
      });

      if (response.data.success && Array.isArray(response.data.results)) {
        const resultsMap = Object.fromEntries(
          response.data.results.map((r) => [r.entryId, r])
        );

        set((state) => ({
          entries: state.entries.map((config) => ({
            ...config,
            entries: config.entries.map((entry) => {
              const result = resultsMap[entry._id];
              return result
                ? {
                    ...entry,
                    status: result.status,
                    responseTime: result.responseTime,
                    checkedAt: new Date(),
                    comment: result.comment,
                  }
                : entry;
            }),
          })),
        }));
        toast.success("checked all status");
      } else {
        throw new Error("Invalid response format");
      }
    } catch (error) {
      console.error("Error checking all status:", error);
      toast.error(error?.response?.data?.message || "Failed to check status");
      // Mark all as offline on error
      set((state) => ({
        entries: state.entries.map((config) => ({
          ...config,
          entries: config.entries.map((e) => ({
            ...e,
            status: "offline",
            checkedAt: new Date(),
          })),
        })),
      }));
    } finally {
      set({ isChecking: false });
    }
  },

  // Send email
  sendEmail: async (entryId) => {
    set({ isLoading: true });
    try {
      const response = await axios.post("/api/sendEmail", { entryId });
      if (response.data.success) {
        toast.success("Email sent successfully!");
        return { success: true };
      } else {
        toast.error(response.data.message || "Failed to send Email");
        return { success: false };
      }
    } catch (error) {
      console.error("Error sending Email:", error);
      toast.error(
        error?.response?.data?.message ||
          "An error occurred while sending Email"
      );
    } finally {
      set({ isLoading: false });
    }
  },

  getById: async (configId, entryId) => {
    try {
      const { entries } = get();

      // Find config by configId
      const config = entries.find((cfg) => cfg._id === configId);

      if (!config) {
        toast.error("Configuration not found in store");
        return { success: false };
      }

      // If entryId provided, find specific entry
      if (entryId) {
        const entry = config.entries.find(
          (e) => e._id?.toString() === entryId?.toString()
        );
        if (!entry) {
          toast.error("Entry not found in this configuration");
          return { success: false };
        }
        console.log(entry);

        return {
          success: true,
          entry,
        };
      }

      // If no entryId, return full config
      return { success: true, IpConfigData: config };
    } catch (error) {
      console.error("Error finding config locally:", error);
      toast.error("Error reading local configuration");
      return { success: false };
    }
  },

  updateConfiguration: async (configData, entryId) => {
    set({ isLoading: true });
    try {
      const response = await axios.post(
        "/api/ip-port-config/update",
        configData,
        entryId
      );
      if (response.data.success) {
        toast.success("Config updated successfully!");
        await get().fetchConfigurations();
        return response;
      } else {
        toast.error(response.data.message || "Failed to update config");
        return { success: false };
      }
    } catch (error) {
      console.error("Error updating config:", error);
      toast.error(error?.response?.data?.message);
    } finally {
      set({ isLoading: false });
    }
  },

  generateReport: async (reportEntry, from, to) => {
    set({ isLoading: true });
    try {
      const response = await fetch(
        `/api/ip-port-config/ip-logs/export?entryId=${reportEntry._id}&from=${from}&to=${to}`
      );
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Failed to generate report.");
      }
      return response;
    } catch (error) {
      console.error("Error generating report:", error);
      toast.error(`Error: ${error.message}`);
    } finally {
      set({ isLoading: false });
    }
  },

  // Total stats (updated to only include online/offline)
  getTotalStats: () => {
    const { entries } = get();
    const all = entries.flatMap((c) => c.entries || []);
    return {
      total: all.length,
      online: all.filter((e) => e.status === "online").length,
      offline: all.filter((e) => e.status === "offline").length,
    };
  },
}));

export default useIPPortStore;
