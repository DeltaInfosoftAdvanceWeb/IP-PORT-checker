import { create } from "zustand";
import axios from "axios";
import toast from "react-hot-toast";

const useIPPortStore = create((set, get) => ({
  // State
  entries: [],
  isChecking: false,
  isModalOpen: false,
  isLoading: false,

  // Modal Actions
  openModal: () => set({ isModalOpen: true }),
  closeModal: () => set({ isModalOpen: false }),

  // Fetch all IP/Port configurations for current user
  fetchConfigurations: async () => {
    set({ isLoading: true });

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
      toast.error("Failed to fetch configurations");
    } finally {
      set({ isLoading: false });
    }
  },

  // Add new configuration
  addConfiguration: async (configData) => {
    set({ isLoading: true });
    try {
      const response = await axios.post("/api/ip-port-config/add", configData);
      if (response.data.success) {
        toast.success("Configuration saved successfully!");
        await get().fetchConfigurations();
        get().closeModal();
        return { success: true };
      } else {
        toast.error(response.data.message || "Failed to save configuration");
        return { success: false };
      }
    } catch (error) {
      console.error("Failed to save configuration:", error);
      toast.error("An error occurred while saving");
      return { success: false };
    } finally {
      set({ isLoading: false });
    }
  },

  // Delete configuration
  deleteConfiguration: async (configId) => {
    set({ isLoading: true });

    try {
      const response = await axios.delete(
        `/api/ip-port-config/delete/${configId}`
      );
      if (response.data.success) {
        set((state) => ({
          entries: state.entries.filter((config) => config._id !== configId),
        }));
        await get().checkAllStatus();
        toast.success("Configuration deleted successfully!");
      } else {
        toast.error(response.data.message || "Failed to delete configuration");
      }
    } catch (error) {
      console.error("Error deleting configuration:", error);
      toast.error("An error occurred while deleting");
    } finally {
      set({ isLoading: false });
    }
  },

  // Check status for a single entry
  checkSingleStatus: async (configId, entryIndex, entry) => {
    set((state) => ({
      entries: state.entries.map((config) =>
        config._id === configId
          ? {
              ...config,
              entries: config.entries.map((e, idx) =>
                idx === entryIndex ? { ...e, status: "checking" } : e
              ),
            }
          : config
      ),
    }));

    try {
      const response = await axios.post("/api/ip-port-config/check-status", {
        entries: [{ ...entry, configId }],
      });

      if (response.data.success && response.data.results.length > 0) {
        const result = response.data.results[0];
        set((state) => ({
          entries: state.entries.map((config) =>
            config._id === configId
              ? {
                  ...config,
                  entries: config.entries.map((e, idx) =>
                    idx === entryIndex
                      ? {
                          ...e,
                          status: result.status,
                          responseTime: result.responseTime,
                          checkedAt: new Date(),
                        }
                      : e
                  ),
                }
              : config
          ),
        }));
      }
    } catch (error) {
      console.error("Error checking status:", error);
      set((state) => ({
        entries: state.entries.map((config) =>
          config._id === configId
            ? {
                ...config,
                entries: config.entries.map((e, idx) =>
                  idx === entryIndex
                    ? { ...e, status: "offline", checkedAt: new Date() }
                    : e
                ),
              }
            : config
        ),
      }));
    }
  },

  // Check status for all entries in all configs
  checkAllStatus: async () => {
    const { entries } = get();
    if (entries.length === 0) return;

    set({ isChecking: true });

    // Mark all as checking
    set((state) => ({
      entries: state.entries.map((config) => ({
        ...config,
        entries: config.entries.map((e) => ({ ...e, status: "checking" })),
      })),
    }));

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

      if (response.data.success) {
        let resultIndex = 0;
        set((state) => ({
          entries: state.entries.map((config) => ({
            ...config,
            entries: config.entries.map((entry) => {
              const result = response.data.results[resultIndex++];
              return {
                ...entry,
                status: result.status,
                responseTime: result.responseTime,
                checkedAt: new Date(),
              };
            }),
          })),
        }));
        toast.success("Status check completed");
      }
    } catch (error) {
      console.error("Error checking all status:", error);
      toast.error("Failed to check status");
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

  sendEmail: async () => {
    set({ isLoading: true });
    try {
      const response = await axios.post("/api/sendEmail", { sendMail: true });
      if (response.data.success) {
        toast.success("Email send successfully!");
        return { success: true };
      } else {
        toast.error(response.data.message || "Failed to send Email");
        return { success: false };
      }
    } catch (error) {
      console.error("Error sending Email:", error);
      toast.error("An error occurred while sending Email");
    } finally {
      set({ isLoading: false });
    }
  },

  getById: async (configId) => {
    set({ isLoading: true });

    try {
      const response = await axios.post("/api/ip-port-config/getById", {
        configId,
      });
      if (response.data.success) {
        toast.success("config fetched successfully!");
        return { success: true, IpConfigData: response.data.IpConfigData };
      } else {
        toast.error(response.data.message || "Failed to fetch config");
        return { success: false };
      }
    } catch (error) {
      console.error("Error fetching config:", error);
      toast.error("An error occurred while fetching config");
    } finally {
      set({ isLoading: false });
    }
  },

  updateConfiguration: async (configData) => {
    set({ isLoading: true });

    try {
      const response = await axios.post(
        "/api/ip-port-config/update",
        configData
      );
      if (response.data.success) {
        toast.success("config updated successfully!");

        return response
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

  // Total stats
  getTotalStats: () => {
    const { entries } = get();
    const all = entries.flatMap((c) => c.entries || []);
    return {
      total: all.length,
      online: all.filter((e) => e.status === "online").length,
      offline: all.filter((e) => e.status === "offline").length,
      checking: all.filter((e) => e.status === "checking").length,
    };
  },
}));

export default useIPPortStore;
