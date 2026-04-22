import { useEffect, useRef, useState } from 'react';
import { api } from '../../../lib/api';

const TONE_PRESETS = [
  {
    value: 'friendly',
    label: 'Friendly',
    description: 'Warm and conversational',
  },
  {
    value: 'professional',
    label: 'Professional',
    description: 'Formal and informative',
  },
  {
    value: 'enthusiastic',
    label: 'Enthusiastic',
    description: 'Energetic and engaging',
  },
];

interface Props {
  onNext: () => void;
  onBack: () => void;
}

interface Document {
  id: string;
  filename: string;
  status: 'pending' | 'processing' | 'ready' | 'failed';
  chunk_count: number | null;
  token_count: number | null;
  error_message: string | null;
  created_at: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  processing: 'Processing…',
  ready: 'Indexed',
  failed: 'Failed',
};

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  processing: 'bg-yellow-100 text-yellow-700',
  ready: 'bg-brand-jade/20 text-brand-jade',
  failed: 'bg-red-50 text-red-700',
};

export default function Step2Content({ onNext, onBack }: Props) {
  const [welcomeText, setWelcomeText] = useState('');
  const [tonePreset, setTonePreset] = useState('friendly');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [fileSizes, setFileSizes] = useState<Record<string, number>>({});
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api
      .get<Document[]>('/api/admin/documents')
      .then(setDocuments)
      .catch(() => {});
  }, []);

  // Poll every 3s while any doc is pending or processing
  useEffect(() => {
    const needsPoll = documents.some(
      (d) => d.status === 'pending' || d.status === 'processing',
    );
    if (!needsPoll) return;
    const id = setInterval(() => {
      api
        .get<Document[]>('/api/admin/documents')
        .then(setDocuments)
        .catch(() => {});
    }, 3000);
    return () => clearInterval(id);
  }, [documents]);

  async function uploadFile(file: File) {
    setUploadError(null);
    setUploading(true);
    setFileSizes((prev) => ({ ...prev, [file.name]: file.size }));
    try {
      const formData = new FormData();
      formData.append('file', file);
      const doc = await api.postForm<Document>(
        '/api/admin/documents',
        formData,
      );
      setDocuments((prev) => [doc, ...prev]);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }

  async function handleContinue() {
    setSaving(true);
    try {
      await api.patch('/api/admin/tenants/me', {
        branding: { welcome_text: welcomeText, tone_preset: tonePreset },
      });
      onNext();
    } catch {
      // Non-critical — proceed anyway
      onNext();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Welcome message */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Welcome message
        </label>
        <textarea
          value={welcomeText}
          onChange={(e) => setWelcomeText(e.target.value)}
          placeholder="Welcome! I'm your AI guide. Ask me anything about this location."
          rows={3}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy"
        />
      </div>

      {/* Tone preset */}
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">
          AI tone
        </label>
        <div className="grid grid-cols-3 gap-2">
          {TONE_PRESETS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTonePreset(t.value)}
              className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                tonePreset === t.value
                  ? 'border-brand-navy bg-brand-sky/20'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="font-medium text-brand-navy">{t.label}</div>
              <div className="text-xs text-gray-500">{t.description}</div>
            </button>
          ))}
        </div>
      </div>

      <hr className="border-gray-100" />

      <p className="text-sm text-gray-500">
        Your AI guide answers visitor questions from these documents. PDFs,
        brochures, and handbooks work great.
      </p>

      {/* Drop zone */}
      <div
        onClick={() => !uploading && fileRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!uploading) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-10 transition-colors ${
          uploading
            ? 'cursor-default border-gray-200 bg-gray-50 opacity-60'
            : dragOver
              ? 'cursor-pointer border-brand-navy bg-brand-sky/20'
              : 'cursor-pointer border-gray-300 hover:border-gray-400'
        }`}
      >
        <svg
          className="mb-2 h-10 w-10 text-gray-300"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <p className="text-sm font-medium text-gray-600">
          {uploading ? 'Uploading…' : 'Drag files here or click to browse'}
        </p>
        <p className="mt-1 text-xs text-gray-400">
          PDF, DOCX, TXT — up to 20 MB each
        </p>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.docx,.txt"
        className="hidden"
        onChange={handleFileInput}
      />

      {uploadError && (
        <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">
          {uploadError}
        </div>
      )}

      {/* File list */}
      {documents.length > 0 && (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-brand-navy">
                  {doc.filename}
                </p>
                {fileSizes[doc.filename] != null && (
                  <p className="text-xs text-gray-400">
                    {formatBytes(fileSizes[doc.filename])}
                  </p>
                )}
              </div>
              <span
                className={`ml-4 shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  STATUS_STYLES[doc.status] ?? 'bg-gray-100 text-gray-600'
                }`}
              >
                {STATUS_LABEL[doc.status] ?? doc.status}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-gray-400 hover:text-gray-600"
        >
          ← Back
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onNext}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-500 hover:bg-gray-50"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={handleContinue}
            disabled={saving}
            className="rounded-lg bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-navy/90 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Continue →'}
          </button>
        </div>
      </div>
    </div>
  );
}
