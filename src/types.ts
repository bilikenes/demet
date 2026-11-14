export type ItemType = "Application" | "Url" | "Folder";
export type DuplicateBehavior = "FocusOrSkip" | "AlwaysLaunch";
export type MouseTrigger =
  | "CtrlMiddleClick"
  | "AltMiddleClick"
  | "CtrlShiftRightClick"
  | "CtrlXButton1"
  | "Disabled";

export interface BundleItem {
  id: string;
  name: string;
  itemType: ItemType;
  target: string;
  arguments: string;
  workingDirectory: string;
  duplicateBehavior: DuplicateBehavior;
  delayMs: number;
  enabled: boolean;
}

export interface AppBundle {
  id: string;
  name: string;
  description: string;
  iconEmoji: string;
  hotkey: string;
  launchOnStartup: boolean;
  items: BundleItem[];
}

export interface AppConfig {
  overlayHotkey: string;
  mouseTrigger: MouseTrigger;
  minimizeToTrayOnClose: boolean;
  startMinimized: boolean;
  bundles: AppBundle[];
}

export interface DiscoveredApp {
  name: string;
  windowTitle: string;
  executablePath: string;
  arguments: string;
  workingDirectory: string;
  processId: number;
  iconSource: string;
}

export interface BundleEvent {
  kind: "launch" | "close";
  bundleName: string;
  launchedCount: number;
  focusedOrSkippedCount: number;
  closedCount: number;
  errors: string[];
}

export interface ShortcutTarget {
  targetPath: string;
  arguments: string;
  workingDirectory: string;
}

export const newId = () => crypto.randomUUID().replace(/-/g, "");

export function newItem(partial: Partial<BundleItem> = {}): BundleItem {
  return {
    id: newId(),
    name: "",
    itemType: "Application",
    target: "",
    arguments: "",
    workingDirectory: "",
    duplicateBehavior: "FocusOrSkip",
    delayMs: 250,
    enabled: true,
    ...partial,
  };
}

export function newBundle(partial: Partial<AppBundle> = {}): AppBundle {
  return {
    id: newId(),
    name: "Yeni Demet",
    description: "",
    iconEmoji: "rocket",
    hotkey: "",
    launchOnStartup: false,
    items: [],
    ...partial,
  };
}
