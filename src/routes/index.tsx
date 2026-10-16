import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import bodyHtml from "../wiki/body.html?raw";
import "../wiki/smite.css";

export const Route = createFileRoute("/")({
  component: Home,
  head: () => ({
    meta: [{ title: "SMITE Wiki & Database" }],
    links: [
      {
        rel: "preload",
        href: "/fonts/PenumbraFlareStd-Semibold.woff2",
        as: "font",
        type: "font/woff2",
        crossOrigin: "anonymous",
      },
    ],
  }),
});

type WikiWindow = Window & {
  bootSmiteWiki?: () => void;
  __smiteWikiLoaded?: boolean;
  __smiteWikiLoading?: boolean;
};

function Home() {
  useEffect(() => {
    const panel = document.createElement("pre");
    panel.id = "smite-runtime-diagnostic";
    panel.style.cssText =
      "position:fixed;z-index:2147483647;left:8px;right:8px;bottom:8px;max-height:38vh;overflow:auto;margin:0;padding:12px;background:#111;color:#8cff9b;border:2px solid #555;border-radius:8px;font:12px monospace;white-space:pre-wrap;word-break:break-word;";
    document.body.appendChild(panel);

    const report = (message: string) => {
      panel.textContent += message + "\\n";
    };

    report("DIAGNÓSTICO ATIVO: inicializando página.");

    window.addEventListener("error", (event) => {
      report("ERRO JS: " + event.message + " | " + event.filename + ":" + event.lineno);
    });

    window.addEventListener("unhandledrejection", (event) => {
      report("PROMISE REJEITADA: " + String(event.reason));
    });

    const w = window as WikiWindow;
    const boot = () => {
      report("Chamando bootSmiteWiki: " + typeof w.bootSmiteWiki);
      w.bootSmiteWiki?.();
      report("Chamada de bootSmiteWiki concluída.");
    };

    if (w.__smiteWikiLoaded) {
      boot();
      return;
    }

    if (w.__smiteWikiLoading) {
      const onReady = () => boot();
      window.addEventListener("smite-wiki-ready", onReady, { once: true });
      return () => window.removeEventListener("smite-wiki-ready", onReady);
    }

    w.__smiteWikiLoading = true;
    const script = document.createElement("script");
    script.src = "/smite/wiki.js?v=4";
    script.async = false;
    script.onload = () => {
      w.__smiteWikiLoaded = true;
      window.dispatchEvent(new Event("smite-wiki-ready"));
      boot();
    };
    script.onerror = () => {
      report("ERRO: não foi possível carregar " + script.src);
    };
    document.body.appendChild(script);
  }, []);

  return (
    <div
      id="smite-app"
      className="smite-app on-screen-main"
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: bodyHtml }}
    />
  );
}
