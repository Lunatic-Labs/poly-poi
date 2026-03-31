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

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-yellow-50 text-yellow-700",
  processing: "bg-blue-50 text-blue-700",
  ready: "bg-green-50 text-green-700",
  failed: "bg-red-50 text-red-700",
};

export default function DocumentsTab() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
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

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const doc = await api.postForm<Document>("/api/admin/documents", formData);
      setDocuments((prev) => [doc, ...prev]);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleDelete(doc: Document) {
    if (!confirm(`Delete "${doc.filename}"? This will also remove all indexed chunks.`)) return;
    await api.delete(`/api/admin/documents/${doc.id}`);
    setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
  }

  if (loading) return <div className="py-8 text-center text-sm text-gray-400">Loading…</div>;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {documents.length} document{documents.length !== 1 ? "s" : ""}
        </p>
        <div>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {uploading ? "Uploading…" : "Upload document"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.docx,.txt"
            className="hidden"
            onChange={handleUpload}
          />
        </div>
      </div>

      {uploadError && (
        <div className="mb-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">
          {uploadError}
        </div>
      )}

      <p className="mb-3 text-xs text-gray-400">
        Supported formats: PDF, DOCX, TXT · Max 20 MB
      </p>

      {documents.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-10 text-center text-sm text-gray-400">
          No documents yet. Upload PDFs, brochures, or guides to power the AI chatbot.
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900">{doc.filename}</p>
                <div className="mt-0.5 flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[doc.status] ?? "bg-gray-100 text-gray-600"}`}
                  >
                    {doc.status}
                  </span>
                  {doc.status === "ready" && doc.chunk_count != null && (
                    <span className="text-xs text-gray-400">
                      {doc.chunk_count} chunks · {doc.token_count?.toLocaleString()} tokens
                    </span>
                  )}
                  {doc.status === "failed" && doc.error_message && (
                    <span className="text-xs text-red-500">{doc.error_message}</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleDelete(doc)}
                className="ml-4 shrink-0 text-xs text-red-500 hover:underline"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
