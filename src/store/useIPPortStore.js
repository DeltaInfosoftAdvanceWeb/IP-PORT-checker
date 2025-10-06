// store/useIPPortStore.js
import { create } from 'zustand';
import axios from 'axios';
import toast from 'react-hot-toast';

const useIPPortStore = create((set, get) => ({
  // State
  entries: [],
  isChecking: false,
  isModalOpen: false,
  isLoading: false,

  // Modal Actions
  openModal: () => set({ isModalOpen: true }),
  closeModal: () => set({ isModalOpen: false }),

  // Fetch configurations from API
  fetchConfigurations: async () => {
    try {
      const { data } = await axios.get('/api/ip-port-config/get');
      if (data.success && data.data) {
        set({
          entries: data.data.filter((d) => d.entries && d.entries.length > 0),
        });
      }
    } catch (error) {
      console.error('Error fetching configurations:', error);
      toast.error('Failed to fetch configurations');
    }
  },

  // Add new configuration
  addConfiguration: async (configData) => {
    set({ isLoading: true });
    try {
      const response = await axios.post('/api/ip-port-config/add', {
        entries: configData.entries.map(({ ip, port }) => ({ ip, port })),
        configName: configData.configName || 'My Configuration',
      });

      if (response.data.success) {
        toast.success('Configuration saved successfully!');
        await get().fetchConfigurations();
        get().closeModal();
        return { success: true };
      } else {
        toast.error(response.data.message || 'Failed to save configuration');
        return { success: false };
      }
    } catch (error) {
      console.error('Failed to save configuration:', error);
      toast.error('An error occurred while saving');
      return { success: false };
    } finally {
      set({ isLoading: false });
    }
  },

  // Delete configuration
  deleteConfiguration: async (configId) => {
    const confirmed = window.confirm(
      'Are you sure you want to delete this configuration?'
    );
    if (!confirmed) return;

    try {
      const response = await axios.delete(
        `/api/ip-port-config/delete/${configId}`
      );

      if (response.data.success) {
        set((state) => ({
          entries: state.entries.filter((entry) => entry._id !== configId),
        }));
        toast.success('Configuration deleted successfully!');
      } else {
        toast.error(response.data.message || 'Failed to delete configuration');
      }
    } catch (error) {
      console.error('Error deleting configuration:', error);
      toast.error('An error occurred while deleting');
    }
  },

  // Check status for a single entry
  checkSingleStatus: async (configId, entryIndex, entry) => {
    set((state) => ({
      entries: state.entries.map((c) =>
        c._id === configId
          ? {
              ...c,
              entries: c.entries.map((e, idx) =>
                idx === entryIndex ? { ...e, status: 'checking' } : e
              ),
            }
          : c
      ),
    }));

    try {
      const response = await axios.post('/api/ip-port-config/check-status', {
        entries: [{ ip: entry.ip, port: entry.port }],
      });

      if (response.data.success && response.data.results.length > 0) {
        const result = response.data.results[0];
        set((state) => ({
          entries: state.entries.map((c) =>
            c._id === configId
              ? {
                  ...c,
                  entries: c.entries.map((e, idx) =>
                    idx === entryIndex
                      ? {
                          ...e,
                          status: result.status,
                          lastChecked: new Date(),
                          responseTime: result.responseTime,
                        }
                      : e
                  ),
                }
              : c
          ),
        }));
      }
    } catch (error) {
      console.error('Error checking status:', error);
      set((state) => ({
        entries: state.entries.map((c) =>
          c._id === configId
            ? {
                ...c,
                entries: c.entries.map((e, idx) =>
                  idx === entryIndex
                    ? { ...e, status: 'offline', lastChecked: new Date() }
                    : e
                ),
              }
            : c
        ),
      }));
    }
  },

  // Check status for all entries
  checkAllStatus: async () => {
    const { entries } = get();
    if (entries.length === 0) return;

    set({ isChecking: true });
    set((state) => ({
      entries: state.entries.map((config) => ({
        ...config,
        entries: config.entries.map((entry) => ({
          ...entry,
          status: 'checking',
        })),
      })),
    }));

    try {
      const allEntries = entries.flatMap((config) =>
        config.entries.map((entry) => ({ ip: entry.ip, port: entry.port }))
      );

      const response = await axios.post('/api/ip-port-config/check-status', {
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
                lastChecked: new Date(),
                responseTime: result.responseTime,
              };
            }),
          })),
        }));
        toast.success('Status check completed');
      }
    } catch (error) {
      console.error('Error checking all status:', error);
      set((state) => ({
        entries: state.entries.map((config) => ({
          ...config,
          entries: config.entries.map((entry) => ({
            ...entry,
            status: 'offline',
            lastChecked: new Date(),
          })),
        })),
      }));
      toast.error('Failed to check status');
    } finally {
      set({ isChecking: false });
    }
  },

  // Get total stats
  getTotalStats: () => {
    const { entries } = get();
    const allEntries = entries.flatMap((config) => config.entries || []);
    return {
      total: allEntries.length,
      online: allEntries.filter((e) => e.status === 'online').length,
      offline: allEntries.filter((e) => e.status === 'offline').length,
      checking: allEntries.filter((e) => e.status === 'checking').length,
    };
  },

  // Authentication
  logout: async (router) => {
    try {
      const { data } = await axios.get('/api/logout');
      if (data.status === 200) {
        toast.success(data.message);
        router.push('/login');
      } else {
        toast.error(data.message);
      }
    } catch (err) {
      console.error('Logout error:', err);
      toast.error(err?.response?.data?.message || 'Logout failed');
    }
  },
}));

export default useIPPortStore;