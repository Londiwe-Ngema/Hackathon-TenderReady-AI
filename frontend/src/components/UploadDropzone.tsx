import { FileUp, FileText, X } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";
import { formatBytes, cx } from "../lib/format";
import { ErrorBox } from "./ui";

const MAX_BYTES = 20 * 1024 * 1024;

export function UploadDropzone({ onUpload }: { onUpload: (file: File, onProgress: (pct: number) => void) => Promise<void> }) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<Error | null>(null);

  function pick(f: File | undefined) {
    setError(null);
    if (!f) return;
    if (f.type !== "application/pdf" && !/\.pdf$/i.test(f.name)) return setError(new Error("Please choose a PDF file."));
    if (f.size > MAX_BYTES) return setError(new Error(`This PDF is ${formatBytes(f.size)}. The maximum is 20 MB.`));
    setFile(f);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    pick(e.dataTransfer.files[0]);
  }

  async function upload() {
    if (!file) return;
    setError(null);
    setProgress(0);
    try {
      await onUpload(file, setProgress);
      setFile(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Upload failed"));
    } finally {
      setProgress(null);
    }
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => input.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Choose a tender PDF to upload"
        className={cx(
          "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition",
          dragging ? "border-brand-500 bg-brand-50" : "border-slate-300 bg-slate-50 hover:border-brand-500 hover:bg-brand-50/50",
        )}
      >
        <FileUp className="mb-2 h-8 w-8 text-brand-600" />
        <p className="font-medium text-navy-900">Drop a tender or RFQ PDF here, or click to browse</p>
        <p className="mt-1 text-xs text-slate-500">PDF only, up to 20 MB. Scanned PDFs are supported.</p>
        <input ref={input} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => pick(e.target.files?.[0] ?? undefined)} />
      </div>

      {file && (
        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
          <FileText className="h-8 w-8 shrink-0 text-red-600" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-navy-900">{file.name}</p>
            <p className="text-xs text-slate-500">{formatBytes(file.size)}</p>
            {progress !== null && (
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full bg-brand-500 transition-all" style={{ width: `${progress}%` }} />
              </div>
            )}
          </div>
          {progress === null ? (
            <>
              <button className="btn-ghost p-1.5" onClick={() => setFile(null)} aria-label="Remove file">
                <X className="h-4 w-4" />
              </button>
              <button className="btn-primary" onClick={upload}>
                Upload &amp; analyse
              </button>
            </>
          ) : (
            <span className="text-sm tabular-nums text-slate-600">{progress}%</span>
          )}
        </div>
      )}
      {error && <ErrorBox error={error} />}
    </div>
  );
}
