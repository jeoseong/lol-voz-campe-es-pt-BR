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
    const w = window as WikiWindow;
    const boot = () => w.bootSmiteWiki?.();

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
