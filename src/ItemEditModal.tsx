import { useEffect, useState } from "react";
import { ChevronDown, FilePlus, FolderOpen, FolderPlus, ListChecks } from "lucide-react";
import { api, pickAnyFile, pickExecutable, pickFolder } from "./api";
import { AppModal } from "./AppModal";
import { AppPickerModal } from "./AppPickerModal";
import type { BundleItem, ItemType } from "./types";
import { newItem } from "./types";
import { Button, Checkbox, Field, Input, RadioGroup } from "./ui";

const fileName = (path: string) => path.split(/[\\/]/).filter(Boolean).pop() ?? "";
const stem = (path: string) => fileName(path).replace(/\.[^.]+$/, "");

const TARGET_LABEL: Record<ItemType, string> = {
  Application: "Uygulama yolu (.exe / .lnk)",
  Url: "Web adresi",
  Folder: "Açılacak klasör yolu",
};

const TARGET_PLACEHOLDER: Record<ItemType, string> = {
  Application: "C:\\Program Files\\Uygulama\\uygulama.exe",
  Url: "https://github.com veya http://localhost:3000",
  Folder: "C:\\Users\\Ben\\Belgeler",
};

export function ItemEditModal({
  open, item, onClose, onSave, onSaveMany,
}: {
  open: boolean;
  /** Düzenlenecek öğe; yoksa yeni öğe oluşturulur. */
  item: BundleItem | null;
  onClose: () => void;
  onSave: (item: BundleItem) => void;
  /** Yeni öğe eklerken Başlat menüsünden birden fazla uygulama seçilirse hepsi tek seferde eklenir. */
  onSaveMany: (items: BundleItem[]) => void;
}) {
  const [draft, setDraft] = useState<BundleItem>(() => newItem());
  const [delayText, setDelayText] = useState("250");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const start = item ? { ...item } : newItem();
    setDraft(start);
    setDelayText(String(start.delayMs));
    setAdvanced(Boolean(start.workingDirectory) || start.delayMs !== 250);
    setError("");
  }, [open, item]);

  const set = (patch: Partial<BundleItem>) => setDraft((d) => ({ ...d, ...patch }));

  const browseTarget = async () => {
    if (draft.itemType === "Folder") {
      const folder = await pickFolder("Açılacak klasörü seçin");
      if (folder) set({ target: folder, name: draft.name || fileName(folder) });
      return;
    }
    const file = await pickExecutable();
    if (!file) return;

    if (file.toLowerCase().endsWith(".lnk")) {
      const resolved = await api.resolveShortcut(file);
      if (resolved?.targetPath) {
        set({
          target: resolved.targetPath,
          arguments: draft.arguments || resolved.arguments,
          workingDirectory: draft.workingDirectory || resolved.workingDirectory,
          name: draft.name || stem(file),
        });
        return;
      }
      set({ target: file, name: draft.name || stem(file) });
      return;
    }
    const folder = file.slice(0, Math.max(file.lastIndexOf("\\"), file.lastIndexOf("/")));
    set({
      target: file,
      workingDirectory: draft.workingDirectory || folder,
      name: draft.name || stem(file),
    });
  };

  const addArgumentPath = async (kind: "folder" | "file") => {
    const path = kind === "folder"
      ? await pickFolder("Uygulamayla birlikte açılacak klasörü seçin")
      : await pickAnyFile("Uygulamayla birlikte açılacak dosyayı seçin");
    if (!path) return;
    const quoted = `"${path}"`;
    set({ arguments: draft.arguments.trim() ? `${draft.arguments.trim()} ${quoted}` : quoted });
  };

  const browseWorkingDir = async () => {
    const folder = await pickFolder("Çalışma klasörünü seçin");
    if (folder) set({ workingDirectory: folder });
  };

  const save = () => {
    const target = draft.target.trim();
    if (!target) {
      setError("Lütfen geçerli bir uygulama yolu, klasör veya URL girin.");
      return;
    }
    const name = draft.name.trim() || (draft.itemType === "Url" ? target : stem(target)) || target;
    const parsed = Number.parseInt(delayText.trim(), 10);
    const delayMs = Number.isFinite(parsed) && parsed >= 0 ? Math.min(parsed, 15000) : 250;
    const isApp = draft.itemType === "Application";

    onSave({
      ...draft,
      name,
      target,
      delayMs,
      arguments: isApp ? draft.arguments.trim() : "",
      workingDirectory: isApp ? draft.workingDirectory.trim() : "",
    });
  };

  const isApp = draft.itemType === "Application";
  const editing = item !== null;

  return (
    <>
      <AppModal
        open={open}
        onClose={onClose}
        title={editing ? "Öğeyi düzenle" : "Öğe ekle"}
        footer={
          <>
            <Button onClick={onClose}>Vazgeç</Button>
            <Button variant="filled" onClick={save}>Kaydet</Button>
          </>
        }
      >
        <div className="ui-stack app-modal-wide">
          <RadioGroup
            aria-label="Öğe türü"
            value={draft.itemType}
            onValueChange={(value) => set({ itemType: value as ItemType })}
            options={[
              { value: "Application", label: "Uygulama" },
              { value: "Url", label: "Web adresi" },
              { value: "Folder", label: "Klasör" },
            ]}
          />

          <Field label="Ad">
            {(id) => <Input id={id} value={draft.name} placeholder="Boşsa yoldan üretilir" onValueChange={(name) => set({ name })} />}
          </Field>

          <Field label={TARGET_LABEL[draft.itemType]} error={error}>
            {(id) => (
              <div className="ui-row is-tight">
                <div className="ui-grow">
                  <Input
                    id={id}
                    value={draft.target}
                    placeholder={TARGET_PLACEHOLDER[draft.itemType]}
                    onValueChange={(target) => { set({ target }); setError(""); }}
                  />
                </div>
                {draft.itemType !== "Url" && (
                  <Button icon={<FolderOpen size={16} />} aria-label="Gözat" onClick={() => void browseTarget()} />
                )}
              </div>
            )}
          </Field>

          {isApp && (
            <>
              <div>
                <Button icon={<ListChecks size={16} />} onClick={() => setPickerOpen(true)}>
                  Başlat menüsünden seç
                </Button>
              </div>

              <Field label="Birlikte açılacak dosya veya klasör">
                {(id) => (
                  <div className="ui-row is-tight">
                    <div className="ui-grow">
                      <Input
                        id={id}
                        value={draft.arguments}
                        placeholder="İsteğe bağlı"
                        onValueChange={(args) => set({ arguments: args })}
                      />
                    </div>
                    <Button icon={<FolderPlus size={16} />} aria-label="Klasör seç" onClick={() => void addArgumentPath("folder")} />
                    <Button icon={<FilePlus size={16} />} aria-label="Dosya seç" onClick={() => void addArgumentPath("file")} />
                  </div>
                )}
              </Field>

              <Checkbox
                label="Zaten açıksa mevcut pencereyi öne getir"
                checked={draft.duplicateBehavior === "FocusOrSkip"}
                onCheckedChange={(on) => set({ duplicateBehavior: on ? "FocusOrSkip" : "AlwaysLaunch" })}
              />
            </>
          )}

          <button
            type="button"
            className="app-disclosure"
            aria-expanded={advanced}
            onClick={() => setAdvanced((v) => !v)}
          >
            <ChevronDown size={16} />
            Gelişmiş ayarlar
          </button>

          {advanced && (
            <>
              {isApp && (
                <Field label="Çalışma klasörü">
                  {(id) => (
                    <div className="ui-row is-tight">
                      <div className="ui-grow">
                        <Input id={id} value={draft.workingDirectory} placeholder="Boşsa uygulamanın klasörü" onValueChange={(workingDirectory) => set({ workingDirectory })} />
                      </div>
                      <Button icon={<FolderOpen size={16} />} aria-label="Çalışma klasörüne gözat" onClick={() => void browseWorkingDir()} />
                    </div>
                  )}
                </Field>
              )}
              <Field label="Sonraki öğeden önce bekleme (ms)">
                {(id) => (
                  <div className="ui-w-sm">
                    <Input id={id} inputMode="numeric" value={delayText} onValueChange={setDelayText} />
                  </div>
                )}
              </Field>
            </>
          )}
        </div>
      </AppModal>

      <AppPickerModal
        mode="pickInstalled"
        multiple={!editing}
        confirmLabel={editing ? "Seç" : undefined}
        open={open && pickerOpen}
        onClose={() => setPickerOpen(false)}
        onConfirm={(apps) => {
          setPickerOpen(false);
          if (apps.length > 1) {
            onSaveMany(apps.map((app) => newItem({
              name: app.name,
              target: app.executablePath,
              arguments: app.arguments,
              workingDirectory: app.workingDirectory,
              delayMs: draft.delayMs,
            })));
            return;
          }
          const chosen = apps[0];
          if (chosen) {
            set({
              name: chosen.name,
              target: chosen.executablePath,
              arguments: chosen.arguments || draft.arguments,
              workingDirectory: chosen.workingDirectory || draft.workingDirectory,
            });
            if (chosen.workingDirectory) setAdvanced(true);
          }
        }}
      />
    </>
  );
}
