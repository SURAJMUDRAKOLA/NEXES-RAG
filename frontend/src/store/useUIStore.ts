import { create } from 'zustand';

interface UIStore {
  sidebarExpanded:    boolean;
  insightsPanelOpen:  boolean;
  settingsOpen:       boolean;
  authModalOpen:      boolean;
  commandPaletteOpen: boolean;
  uploadDragOver:     boolean;

  setSidebarExpanded:    (v: boolean) => void;
  toggleSidebar:         () => void;
  setInsightsPanelOpen:  (v: boolean) => void;
  toggleInsightsPanel:   () => void;
  setSettingsOpen:       (v: boolean) => void;
  setAuthModalOpen:      (v: boolean) => void;
  setCommandPaletteOpen: (v: boolean) => void;
  openCommandPalette:    () => void;
  closeCommandPalette:   () => void;
  toggleCommandPalette:  () => void;
  setUploadDragOver:     (v: boolean) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  sidebarExpanded:    true,
  insightsPanelOpen:  false,
  settingsOpen:       false,
  authModalOpen:      false,
  commandPaletteOpen: false,
  uploadDragOver:     false,

  setSidebarExpanded:    (v) => set({ sidebarExpanded: v }),
  toggleSidebar:         ()  => set((s) => ({ sidebarExpanded: !s.sidebarExpanded })),
  setInsightsPanelOpen:  (v) => set({ insightsPanelOpen: v }),
  toggleInsightsPanel:   ()  => set((s) => ({ insightsPanelOpen: !s.insightsPanelOpen })),
  setSettingsOpen:       (v) => set({ settingsOpen: v }),
  setAuthModalOpen:      (v) => set({ authModalOpen: v }),
  setCommandPaletteOpen: (v) => set({ commandPaletteOpen: v }),
  openCommandPalette:    ()  => set({ commandPaletteOpen: true }),
  closeCommandPalette:   ()  => set({ commandPaletteOpen: false }),
  toggleCommandPalette:  ()  => set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),
  setUploadDragOver:     (v) => set({ uploadDragOver: v }),
}));
