import { useEffect, useState } from "react";
import {
  AppWindow, ArrowDown, ArrowUp, FolderOpen, Globe, ListChecks, MonitorUp, Pencil, Play, Plus,
  Power, Trash2,
} from "lucide-react";
import { api } from "./api";
import { AppModal } from "./AppModal";
import { AppPickerModal, type PickerMode } from "./AppPickerModal";
import { AppTile } from "./AppIcon";
import { BundleGlyph } from "./BundleGlyph";
import { HotkeyField } from "./HotkeyField";
import { IconField } from "./IconField";
import { ItemEditModal } from "./ItemEditModal";
import type { AppBundle, BundleItem, DiscoveredApp } from "./types";
import { newItem } from "./types";
import {
  Badge, Button, Card, EmptyState, Field, Input, Menu, Switch, Textarea, Tooltip, useToast,
} from "./ui";
import { useConfig } from "./useConfig";
import { useFlip } from "./useFlip";

const TYPE_LABEL = { Application: "Uygulama", Url: "Web", Folder: "Klasör" } as const;

function itemIcon(item: BundleItem) {
  if (item.itemType === "Url") return <Globe size={18} />;
  if (item.itemType === "Folder") return <FolderOpen size={18} />;
  return <AppWindow size={18} />;
}

function itemDetail(item: BundleItem) {
  return item.arguments ? `${item.target}  [${item.arguments}]` : item.target;
}

function itemBehavior(item: BundleItem) {
  if (item.itemType !== "Application") return "Doğrudan aç";
  return item.duplicateBehavior === "FocusOrSkip" ? "Açıksa öne getir" : "Yeni pencere aç";
}

const appToItem = (app: DiscoveredApp): BundleItem =>
  newItem({
    name: app.name,
    target: app.executablePath,
    arguments: app.arguments,
    workingDirectory: app.workingDirectory,
  });

/**
 * Yazarken kaydeden metin alanı. `fallback` verilirse alan boş bırakılıp odak çıkınca
 * o değere döner (ör. demet adı boş olamaz).
 */
function DraftText({
  id, value, fallback, multiline, onCommit,
}: {
  id: string;
  value: string;
  fallback?: string;
  multiline?: boolean;
  onCommit: (text: string) => void;
}) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);

  const change = (next: string) => {
    setText(next);
    if (fallback === undefined || next.trim()) onCommit(next);
  };
  const restoreIfEmpty = () => {
    if (fallback !== undefined && !text.trim()) {
      setText(fallback);
      onCommit(fallback);
    }
  };

  return multiline ? (
    <Textarea id={id} rows={3} value={text} onChange={(e) => change(e.target.value)} onBlur={restoreIfEmpty} />
  ) : (
    <Input id={id} value={text} onValueChange={change} onBlur={restoreIfEmpty} />
  );
}

export function BundleView({ bundle, onDeleted }: { bundle: AppBundle; onDeleted: () => void }) {
  const { updateBundle, update } = useConfig();
  const toast = useToast();
  const flip = useFlip(bundle.items.map((i) => i.id).join());

  const [editing, setEditing] = useState<BundleItem | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [picker, setPicker] = useState<PickerMode | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const patch = (change: Partial<AppBundle>, debounce = false) =>
    updateBundle(bundle.id, (b) => Object.assign(b, change), { debounce });

  const mutateItems = (mutate: (items: BundleItem[]) => void) =>
    updateBundle(bundle.id, (b) => mutate(b.items));

  const openEditor = (item: BundleItem | null) => {
    setEditing(item);
    setEditorOpen(true);
  };

  const move = (index: number, delta: number) => {
    flip.capture();
    mutateItems((items) => {
      const target = index + delta;
      if (target < 0 || target >= items.length) return;
      const [moved] = items.splice(index, 1);
      items.splice(target, 0, moved);
    });
  };

  const enabledCount = bundle.items.filter((i) => i.enabled).length;

  return (
    <div className="ui-stack is-loose">
      <div className="ui-row is-between">
        <div className="ui-row app-heading">
          <span className="app-tile is-lg" aria-hidden="true">
            <BundleGlyph value={bundle.iconEmoji} size={32} />
          </span>
          <div>
            <h1 className="ui-title">{bundle.name}</h1>
            <p className="ui-muted">{bundle.description || "Açıklama yok"}</p>
          </div>
        </div>
        <div className="ui-row">
          <Button
            variant="filled"
            icon={<Play size={18} />}
            disabled={enabledCount === 0}
            onClick={() => void api.launchBundle(bundle.id)}
          >
            Başlat
          </Button>
          <Button
            icon={<Power size={18} />}
            disabled={enabledCount === 0}
            onClick={() => void api.closeBundle(bundle.id)}
          >
            Uygulamaları kapat
          </Button>
          <Menu
            aria-label="Demet işlemleri"
            align="end"
            items={[{ label: "Demeti sil", icon: <Trash2 size={16} />, destructive: true, onSelect: () => setConfirmDelete(true) }]}
          />
        </div>
      </div>

      <div className="ui-grid cols-2">
        <Card title="Genel" description="Demetin adı ve görünümü">
          <div className="ui-stack">
            <div className="ui-row app-meta-row">
              <Field label="İkon">
                {() => (
                  <IconField value={bundle.iconEmoji} onChange={(iconEmoji) => patch({ iconEmoji })} />
                )}
              </Field>
              <div className="ui-grow">
                <Field label="Demet adı">
                  {(id) => (
                    <DraftText id={id} value={bundle.name} fallback={bundle.name} onCommit={(name) => patch({ name }, true)} />
                  )}
                </Field>
              </div>
            </div>
            <Field label="Açıklama">
              {(id) => (
                <DraftText id={id} multiline value={bundle.description} onCommit={(description) => patch({ description }, true)} />
              )}
            </Field>
          </div>
        </Card>

        <Card title="Tetikleme" description="Demeti nasıl başlatacağın">
          <div className="ui-stack">
            <Field label="Doğrudan kısayol" hint="Kutuya tıkla ve tuşlara bas. Silmek için Backspace.">
              {() => (
                <HotkeyField
                  label="Demet kısayolu"
                  value={bundle.hotkey}
                  onChange={(hotkey) => patch({ hotkey })}
                />
              )}
            </Field>
            <div className="ui-setting">
              <div className="ui-setting-label">
                Uygulama açılınca otomatik çalıştır
                <small>Bilgisayar başlangıcında bu demet kendiliğinden başlar.</small>
              </div>
              <Switch
                aria-label="Uygulama açılınca otomatik çalıştır"
                checked={bundle.launchOnStartup}
                onCheckedChange={(launchOnStartup) => patch({ launchOnStartup })}
              />
            </div>
          </div>
        </Card>
      </div>

      <Card
        title="Demet içeriği"
        description="Öğeler yukarıdan aşağıya sırayla çalıştırılır."
        actions={
          <Menu
            aria-label="Öğe ekle"
            align="end"
            icon={<Plus size={18} />}
            items={[
              { label: "Elle ekle", icon: <Pencil size={16} />, onSelect: () => openEditor(null) },
              { label: "Başlat menüsünden", icon: <ListChecks size={16} />, onSelect: () => setPicker("pickInstalled") },
              { label: "Açık uygulamalardan", icon: <MonitorUp size={16} />, onSelect: () => setPicker("addOpen") },
            ]}
          />
        }
      >
        {bundle.items.length === 0 ? (
          <EmptyState
            icon={<ListChecks size={26} />}
            title="Bu demette henüz öğe yok"
            description="Uygulama, web adresi, klasör veya şu an açık olan pencereleri ekleyebilirsin."
            action={<Button icon={<Plus size={18} />} onClick={() => openEditor(null)}>Öğe ekle</Button>}
          />
        ) : (
          <div role="list">
            {bundle.items.map((item, index) => (
              <div
                key={item.id}
                ref={flip.register(item.id)}
                role="listitem"
                className="app-item"
                data-off={!item.enabled}
                onDoubleClick={() => openEditor(item)}
              >
                <AppTile
                  path={item.itemType === "Application" ? item.target : undefined}
                  siteUrl={item.itemType === "Url" ? item.target : undefined}
                  fallback={itemIcon(item)}
                />
                <div className="app-item-main">
                  <div className="ui-row is-tight">
                    <span className="app-item-name">{item.name}</span>
                    <Badge tone="neutral">{TYPE_LABEL[item.itemType]}</Badge>
                  </div>
                  <div className="ui-muted app-item-detail" title={itemDetail(item)}>{itemDetail(item)}</div>
                  <div className="ui-muted">{itemBehavior(item)} · {item.delayMs} ms</div>
                </div>
                <Tooltip content={item.enabled ? "Devre dışı bırak" : "Etkinleştir"}>
                  <Switch
                    aria-label={`${item.name} etkin`}
                    checked={item.enabled}
                    onCheckedChange={(enabled) => mutateItems((items) => { items[index].enabled = enabled; })}
                  />
                </Tooltip>
                <Menu
                  aria-label={`${item.name} işlemleri`}
                  align="end"
                  items={[
                    { label: "Düzenle", icon: <Pencil size={16} />, onSelect: () => openEditor(item) },
                    { label: "Yukarı taşı", icon: <ArrowUp size={16} />, disabled: index === 0, onSelect: () => move(index, -1) },
                    { label: "Aşağı taşı", icon: <ArrowDown size={16} />, disabled: index === bundle.items.length - 1, onSelect: () => move(index, 1) },
                    "separator",
                    {
                      label: "Demetten kaldır",
                      icon: <Trash2 size={16} />,
                      destructive: true,
                      onSelect: () => {
                        mutateItems((items) => { items.splice(index, 1); });
                        toast({ tone: "info", title: "Öğe kaldırıldı", text: item.name });
                      },
                    },
                  ]}
                />
              </div>
            ))}
          </div>
        )}
      </Card>

      <ItemEditModal
        open={editorOpen}
        item={editing}
        onClose={() => setEditorOpen(false)}
        onSave={(saved) => {
          mutateItems((items) => {
            const at = items.findIndex((i) => i.id === saved.id);
            if (at >= 0) items[at] = saved; else items.push(saved);
          });
          setEditorOpen(false);
          toast({ tone: "success", title: editing ? "Öğe güncellendi" : "Öğe eklendi", text: saved.name });
        }}
        onSaveMany={(added) => {
          mutateItems((items) => { items.push(...added); });
          setEditorOpen(false);
          toast({ tone: "success", title: `${added.length} uygulama eklendi`, text: bundle.name });
        }}
      />

      <AppPickerModal
        mode={picker ?? "addOpen"}
        open={picker !== null}
        onClose={() => setPicker(null)}
        onConfirm={(apps) => {
          mutateItems((items) => { items.push(...apps.map(appToItem)); });
          setPicker(null);
          toast({ tone: "success", title: `${apps.length} uygulama eklendi`, text: bundle.name });
        }}
      />

      <AppModal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Demeti sil?"
        footer={
          <>
            <Button onClick={() => setConfirmDelete(false)}>Vazgeç</Button>
            <Button
              variant="filled"
              destructive
              onClick={() => {
                setConfirmDelete(false);
                update((draft) => { draft.bundles = draft.bundles.filter((b) => b.id !== bundle.id); });
                onDeleted();
                toast({ tone: "info", title: "Demet silindi", text: bundle.name });
              }}
            >
              Sil
            </Button>
          </>
        }
      >
        “{bundle.name}” demeti kalıcı olarak silinecek. Bu işlem geri alınamaz.
      </AppModal>
    </div>
  );
}
