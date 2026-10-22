"use client";

import { useEffect } from "react";

export function useUnsavedTakeWarning(unsaved: boolean) {
  useEffect(() => {
    if (!unsaved) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const followLink = (event: MouseEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(link instanceof HTMLAnchorElement) || link.target === "_blank" || link.hasAttribute("download")) return;
      if (link.href === location.href || link.href.startsWith(`${location.href.split("#")[0]}#`)) return;
      if (!window.confirm("Your vocal take has not been saved. Leave this page and discard it?")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const submit = (event: SubmitEvent) => {
      if (!window.confirm("Your vocal take has not been saved. Leave this page and discard it?")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", followLink, true);
    document.addEventListener("submit", submit, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", followLink, true);
      document.removeEventListener("submit", submit, true);
    };
  }, [unsaved]);
}
