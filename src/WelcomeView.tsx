import type { ReactNode } from "react";
import { AppWindow, ListChecks, Plus } from "lucide-react";

interface Option {
  icon: ReactNode;
  title: string;
  text: string;
  onClick: () => void;
}

/** Hiç demet yokken gösterilir: ilk kurulumda da, tüm demetler silindiğinde de. */
export function WelcomeView({
  onSnapshot, onCreateEmpty, onPickInstalled,
}: {
  onSnapshot: () => void;
  onCreateEmpty: () => void;
  onPickInstalled: () => void;
}) {
  const options: Option[] = [
    {
      icon: <AppWindow size={22} />,
      title: "Açık uygulamalardan",
      text: "Şu an açık olan uygulamaları tek tıkla demete çevir.",
      onClick: onSnapshot,
    },
    {
      icon: <ListChecks size={22} />,
      title: "Başlat menüsünden seç",
      text: "Kurulu uygulamalardan istediklerini işaretle.",
      onClick: onPickInstalled,
    },
    {
      icon: <Plus size={22} />,
      title: "Boş demet oluştur",
      text: "Sıfırdan başla, öğeleri kendin ekle.",
      onClick: onCreateEmpty,
    },
  ];

  return (
    <section className="app-welcome" aria-labelledby="app-welcome-title">
      <div className="app-welcome-body">
      <span className="app-welcome-mark" aria-hidden="true"><span className="app-welcome-symbol" /></span>
      <h1 id="app-welcome-title" className="app-welcome-title">Bir demet oluşturalım</h1>
      <p className="app-welcome-text">
        Demet, tek kısayolla birlikte açılan uygulama, klasör ve web adreslerinin listesidir.
        Başlamak için bir yol seç.
      </p>

      <div className="app-welcome-options">
        {options.map((o) => (
          <button
            key={o.title}
            type="button"
            className="app-welcome-option"
            onClick={o.onClick}
          >
            <span className="app-welcome-option-icon" aria-hidden="true">{o.icon}</span>
            <span className="app-welcome-option-title">{o.title}</span>
            <span className="app-welcome-option-text">{o.text}</span>
          </button>
        ))}
      </div>
      </div>

      <p className="app-welcome-tip">İpucu: Her demete Ctrl+Alt+Shift+1 gibi bir kısayol verebilirsin.</p>
    </section>
  );
}
