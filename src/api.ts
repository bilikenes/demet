// Rust arka ucuna açılan tek kapı. Tarayıcıda (Tauri dışında) geliştirme yapılırken
// örnek verilerle çalışan bir sahte arka uç kullanılır.

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import type {
  AppConfig, BundleEvent, DiscoveredApp, ShortcutTarget,
} from "./types";
import { newBundle, newItem } from "./types";

const inTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

// ---------------------------------------------------------------- sahte arka uç

let mockConfig: AppConfig = {
  overlayHotkey: "Ctrl+Alt+Space",
  mouseTrigger: "CtrlMiddleClick",
  minimizeToTrayOnClose: true,
  startMinimized: false,
  bundles: [
    newBundle({
      name: "Günlük Başlangıç",
      description: "Sabah bilgisayarı açtığında hızlıca başlatılacak temel araçlar",
      iconEmoji: "sun",
      hotkey: "Ctrl+Alt+1",
      items: [
        newItem({ name: "Not Defteri", target: "notepad.exe", delayMs: 200 }),
        newItem({ name: "Belgelerim Klasörü", itemType: "Folder", target: "C:\\Users\\Ornek\\Documents", delayMs: 200 }),
        newItem({ name: "GitHub", itemType: "Url", target: "https://github.com", delayMs: 200 }),
      ],
    }),
    newBundle({
      name: "Kod Yazma",
      description: "Editör, terminal ve proje klasörü",
      iconEmoji: "code",
      hotkey: "Ctrl+Alt+2",
      launchOnStartup: true,
      items: [
        newItem({ name: "Visual Studio Code", target: "C:\\Program Files\\Microsoft VS Code\\Code.exe", arguments: "\"C:\\Projeler\\demet\"" }),
        newItem({ name: "Windows Terminal", target: "wt.exe", duplicateBehavior: "AlwaysLaunch", enabled: false }),
      ],
    }),
  ],
};

const mockApps: DiscoveredApp[] = [
  "Google Chrome", "Visual Studio Code", "Spotify", "Discord", "Slack", "Notion", "Figma",
  "Adobe Photoshop", "Adobe Illustrator", "Android Studio", "Anydesk", "Arc", "Audacity", "Blender",
  "Calculator", "Docker Desktop", "Excel", "Firefox", "GitHub Desktop", "IntelliJ IDEA", "Obsidian",
  "OBS Studio", "Postman", "PowerPoint", "Steam", "Telegram", "Terminal", "VLC", "WhatsApp", "Word",
  "Zoom", "7-Zip", "Notepad", "Paint", "Edge", "Teams", "Outlook", "OneNote", "Git Bash", "Wireshark",
].map((name, i) => ({
  name,
  windowTitle: `${name} penceresi`,
  executablePath: `C:\\Program Files\\${name}\\${name.replace(/ /g, "")}.exe`,
  arguments: "",
  workingDirectory: `C:\\Program Files\\${name}`,
  processId: 1000 + i,
  iconSource: "",
}));

const mock = {
  get_config: async () => structuredClone(mockConfig),
  save_config: async ({ config }: { config: AppConfig }) => {
    mockConfig = structuredClone(config);
    return [] as string[];
  },
  launch_bundle: async () => undefined,
  close_bundle: async () => undefined,
  get_open_apps: async () => mockApps,
  get_installed_apps: async () => mockApps,
  get_icon: async () => null,
  get_favicon: async () =>
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><circle cx='16' cy='16' r='15' fill='royalblue'/><path d='M9 17l5 5 9-12' stroke='white' stroke-width='3' fill='none'/></svg>",
    ),
  resolve_shortcut: async () => null,
  is_startup_enabled: async () => false,
  set_startup_enabled: async () => true,
  set_triggers_paused: async () => undefined,
  path_exists: async () => true,
  app_ready: async () => undefined,
  open_dashboard: async () => undefined,
  hide_overlay: async () => undefined,
} as const;

type Command = keyof typeof mock;

function call<T>(cmd: Command, args?: Record<string, unknown>): Promise<T> {
  if (inTauri) return invoke<T>(cmd, args);
  return (mock[cmd] as (a?: unknown) => Promise<unknown>)(args) as Promise<T>;
}

// ---------------------------------------------------------------- komutlar

export const api = {
  getConfig: () => call<AppConfig>("get_config"),
  /** Kaydedilemeyen kısayollar için uyarı metinleri döner. */
  saveConfig: (config: AppConfig) => call<string[]>("save_config", { config }),
  launchBundle: (bundleId: string) => call<void>("launch_bundle", { bundleId }),
  closeBundle: (bundleId: string) => call<void>("close_bundle", { bundleId }),
  getOpenApps: () => call<DiscoveredApp[]>("get_open_apps"),
  getInstalledApps: (forceRefresh = false) =>
    call<DiscoveredApp[]>("get_installed_apps", { forceRefresh }),
  getIcon: (path: string) => call<string | null>("get_icon", { path }),
  /** Web sitesinin favicon'u (data URL); bulunamazsa null. */
  getFavicon: (url: string) => call<string | null>("get_favicon", { url }),
  resolveShortcut: (path: string) => call<ShortcutTarget | null>("resolve_shortcut", { path }),
  isStartupEnabled: () => call<boolean>("is_startup_enabled"),
  setStartupEnabled: (enable: boolean) => call<boolean>("set_startup_enabled", { enable }),
  setTriggersPaused: (paused: boolean) => call<void>("set_triggers_paused", { paused }),
  appReady: () => call<void>("app_ready"),
  openDashboard: () => call<void>("open_dashboard"),
  hideOverlay: () => call<void>("hide_overlay"),
};

// ---------------------------------------------------------------- olaylar

export async function onEvent<T>(name: string, handler: (payload: T) => void): Promise<() => void> {
  if (!inTauri) return () => {};
  return listen<T>(name, (event) => handler(event.payload));
}

export const onBundleResult = (h: (e: BundleEvent) => void) => onEvent<BundleEvent>("bundle-result", h);
export const onBundleStarted = (h: (e: { bundleName: string }) => void) =>
  onEvent<{ bundleName: string }>("bundle-started", h);
export const onOverlayShow = (h: () => void) => onEvent<null>("overlay-show", h);

// ---------------------------------------------------------------- dosya seçiciler

export async function pickFolder(title: string): Promise<string | null> {
  if (!inTauri) return null;
  const result = await open({ directory: true, multiple: false, title });
  return typeof result === "string" ? result : null;
}

export async function pickExecutable(): Promise<string | null> {
  if (!inTauri) return null;
  const result = await open({
    multiple: false,
    title: "Uygulama seçin",
    filters: [
      { name: "Uygulamalar", extensions: ["exe", "lnk", "bat", "cmd"] },
      { name: "Tüm dosyalar", extensions: ["*"] },
    ],
  });
  return typeof result === "string" ? result : null;
}

export async function pickAnyFile(title: string): Promise<string | null> {
  if (!inTauri) return null;
  const result = await open({ multiple: false, title });
  return typeof result === "string" ? result : null;
}

export async function setWindowTheme(mode: "light" | "dark") {
  if (!inTauri) return;
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().setTheme(mode);
  } catch {
    /* başlık çubuğu teması isteğe bağlı */
  }
}
