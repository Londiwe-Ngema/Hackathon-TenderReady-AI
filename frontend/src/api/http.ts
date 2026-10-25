import type { UploadResponse } from "@tenderready/shared";
import { idToken } from "../lib/auth";
import type { RuntimeConfig } from "../lib/config";
import { ApiError, type Api } from "./types";

function putWithProgress(url: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", "application/pdf");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new ApiError(xhr.status, "Upload to storage failed"));
    xhr.onerror = () => reject(new ApiError(0, "Network error while uploading the PDF"));
    xhr.send(file);
  });
}

export function createHttpApi(config: RuntimeConfig): Api {
  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${config.apiUrl}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${await idToken()}`,
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (res.status === 204) return undefined as T;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(res.status, (data as { message?: string }).message ?? `Request failed (${res.status})`);
    return data as T;
  }

  return {
    dashboard: () => request("GET", "/dashboard"),
    getHub: () => request("GET", "/hub"),
    putHub: (profile) => request("PUT", "/hub", profile),
    listClients: () => request("GET", "/clients"),
    getClient: (id) => request("GET", `/clients/${id}`),
    createClient: (input) => request("POST", "/clients", input),
    updateClient: (id, input) => request("PUT", `/clients/${id}`, input),
    deleteClient: (id) => request("DELETE", `/clients/${id}`),
    listTenders: (clientId) => request("GET", `/clients/${clientId}/tenders`),
    async uploadTender(clientId, file, onProgress) {
      const { tenderId, uploadUrl } = await request<UploadResponse>("POST", `/clients/${clientId}/tenders`, {
        fileName: file.name,
        size: file.size,
      });
      await putWithProgress(uploadUrl, file, onProgress);
      return tenderId;
    },
    getTender: (id) => request("GET", `/tenders/${id}`),
    deleteTender: (id) => request("DELETE", `/tenders/${id}`),
    documentUrl: async (id) => (await request<{ url: string }>("GET", `/tenders/${id}/document`)).url,
    updateChecklistItem: (tenderId, itemId, patch) =>
      request("PATCH", `/tenders/${tenderId}/checklist/${encodeURIComponent(itemId)}`, patch),
    ask: (tenderId, question, history) => request("POST", `/tenders/${tenderId}/ask`, { question, history }),
  };
}
