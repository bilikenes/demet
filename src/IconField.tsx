import { useState } from "react";
import { BundleGlyph } from "./BundleGlyph";
import { AppModal } from "./AppModal";
import { SymbolPicker } from "./SymbolPicker";
import { Button, Tooltip } from "./ui";

/** Demet ikonunu gösteren düğme; basınca ikon seçici açılır. Seçim "Seç" ile onaylanır. */
export function IconField({
  value, onChange, label = "Demet ikonu",
}: { value: string; onChange: (id: string) => void; label?: string }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  const openPicker = () => {
    setDraft(value);
    setOpen(true);
  };
  const confirm = () => {
    if (draft !== value) onChange(draft);
    setOpen(false);
  };

  return (
    <>
      <Tooltip content="İkon seç">
        <Button
          aria-label={`${label}: değiştir`}
          icon={<BundleGlyph value={value} size={20} />}
          onClick={openPicker}
        />
      </Tooltip>
      <AppModal
        open={open}
        onClose={() => setOpen(false)}
        title="İkon seç"
        footer={
          <>
            <Button onClick={() => setOpen(false)}>Vazgeç</Button>
            <Button variant="filled" onClick={confirm}>Seç</Button>
          </>
        }
      >
        <SymbolPicker value={draft} onChange={setDraft} onConfirm={confirm} />
      </AppModal>
    </>
  );
}
