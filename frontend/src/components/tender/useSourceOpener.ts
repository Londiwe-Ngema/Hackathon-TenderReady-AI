import { useCallback, useState } from "react";
import { api } from "../../api";

/** Opens the original tender PDF (pre-signed S3 URL) at a specific page so advisors can verify AI output. */
export function useSourceOpener(tenderId: string) {
  const [notice, setNotice] = useState<string | null>(null);
  const open = useCallback(
    async (page?: number) => {
      // Open synchronously to avoid popup blockers, then point it at the signed URL.
      const win = window.open("", "_blank");
      try {
        const url = await api().documentUrl(tenderId);
        if (!url) {
          win?.close();
          setNotice("The original PDF isn't available in demo mode. In the live app this opens the tender at the cited page.");
          setTimeout(() => setNotice(null), 5000);
          return;
        }
        if (win) win.location.href = page ? `${url}#page=${page}` : url;
      } catch (err) {
        win?.close();
        setNotice(err instanceof Error ? err.message : "Could not open the document");
        setTimeout(() => setNotice(null), 5000);
      }
    },
    [tenderId],
  );
  return { open, notice };
}
