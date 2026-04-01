import { useEffect, useRef, useState } from "react";
import { api } from "../../../lib/api";

interface Document {
  id: string;
  filename: string;
  status: "pending" | "processing" | "ready" | "failed";
  chunk_count: number | null;
  token_count: number | null;
  error_message: string | null;
  created_at: string;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "PENDING",
  processing: "PROCESSING...",
  ready: "INDEXED",
  failed: "FAILED",
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  processing: "bg-yellow-100 text-yellow-700",
  ready: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function DocumentsTab() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [fileSizes, setFileSizes] = useState<Record<string, number>>({});
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api
      .get<Document[]>("/api/admin/documents")
      .then(setDocuments)
      .finally(() => setLoading(false));
  }, []);

  // Poll every 3s while any document is pending or processing
  useEffect(() => {
    const needsPoll = documents.some(
      (d) => d.status === "pending" || d.status === "processing",
    );
    if (!needsPoll) return;
    const id = setInterval(() => {
      api.get<Document[]>("/api/admin/documents").then(setDocuments);
    }, 3000);
    return () => clearInterval(id);
  }, [documents]);

  async function handleUpload(file: File) {
    setUploadError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const doc = await api.postForm<Document>("/api/admin/documents", formData);
      setDocuments((prev) => [doc, ...prev]);
      setFileSizes((prev) => ({ ...prev, [doc.id]: file.size }));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  }

  async function handleDelete(doc: Document) {
    if (!confirm(`Delete "${doc.filename}"? This will also remove all indexed chunks.`)) return;
    await api.delete(`/api/admin/documents/${doc.id}`);
    setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
  }

  if (loading) return <div className="py-8 text-center text-sm text-gray-400">Loading…</div>;

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
          <p className="mt-1 text-sm text-gray-500">
            Your AI guide answers questions from these files
          </p>
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {uploading ? "Uploading…" : "+ Upload document"}
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.docx,.txt"
        className="hidden"
        onChange={handleFileInput}
      />

      {uploadError && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">
          {uploadError}
        </div>
      )}

      {/* Drag/drop zone */}
      <div
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`mb-6 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed py-8 transition-colors ${
          dragOver
            ? "border-blue-400 bg-blue-50"
            : "border-gray-200 bg-white hover:border-gray-300"
        }`}
      >
        <svg
          className="mb-2 h-8 w-8 text-gray-300"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
          />
        </svg>
        <p className="text-sm text-gray-400">Drop new files here to upload</p>
      </div>

      {/* Table */}
      {documents.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                  File
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Size
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Chunks
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Uploaded
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {documents.map((doc) => (
                <tr key={doc.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-900">{doc.filename}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {fileSizes[doc.id] != null ? formatBytes(fileSizes[doc.id]) : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {doc.chunk_count != null ? doc.chunk_count : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[doc.status] ?? "bg-gray-100 text-gray-600"}`}
                    >
                      {STATUS_LABEL[doc.status] ?? doc.status}
                    </span>
                    {doc.status === "failed" && doc.error_message && (
                      <p className="mt-0.5 text-xs text-red-500">{doc.error_message}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(doc.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(doc)}
                      className="rounded-md border border-red-200 px-3 py-1 text-xs text-red-500 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
