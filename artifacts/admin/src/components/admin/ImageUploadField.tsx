import { useRef, useState } from "react";
import { Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/lib/i18n";
import { AdminApiError } from "@/lib/api-admin";

/**
 * Image upload field that posts to /api/uploads (multer + S3-backed
 * fileStore on the server). Falls back to a manual URL input so admins
 * can still paste an external URL (e.g. CDN-hosted asset) when needed.
 */
interface Props {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  kind?: string;
  accept?: string;
  /** Disable the upload control, e.g. while the parent form is submitting. */
  disabled?: boolean;
  testId?: string;
}

function authHeader(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("auth_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function ImageUploadField({
  value,
  onChange,
  label,
  kind = "general",
  accept = "image/*",
  disabled = false,
  testId,
}: Props) {
  const { lang } = useTranslation();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFiles(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", kind);
      const res = await fetch("/api/uploads", {
        method: "POST",
        headers: { ...authHeader() },
        body: fd,
      });
      if (!res.ok) {
        let parsed: unknown = null;
        try { parsed = await res.json(); } catch { /* ignore */ }
        const errObj = (parsed && typeof parsed === "object")
          ? (parsed as Record<string, unknown>) : {};
        const detail =
          (typeof errObj.error === "string" && errObj.error) ||
          `${res.status} ${res.statusText}`;
        throw new AdminApiError(res.status, detail, parsed, null);
      }
      const json = (await res.json()) as { url: string };
      onChange(json.url);
      toast({ title: lang === "ar" ? "تم الرفع" : "Uploaded" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({
        variant: "destructive",
        title: lang === "ar" ? "فشل الرفع" : "Upload failed",
        description: msg,
      });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      {label && <label className="text-sm font-medium">{label}</label>}
      <div className="flex gap-2 items-start">
        <Input
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://…"
          disabled={disabled || uploading}
          data-testid={testId ? `${testId}-url` : undefined}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || uploading}
          data-testid={testId ? `${testId}-upload` : undefined}
        >
          {uploading
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Upload className="w-4 h-4" />}
          <span className="ml-2 hidden md:inline">
            {lang === "ar" ? "رفع" : "Upload"}
          </span>
        </Button>
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onChange("")}
            disabled={disabled || uploading}
            aria-label={lang === "ar" ? "مسح" : "Clear"}
          >
            <X className="w-4 h-4" />
          </Button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFiles(f);
          }}
          data-testid={testId ? `${testId}-file` : undefined}
        />
      </div>
      {value && (
        <div className="rounded-md border border-border overflow-hidden bg-muted/30 inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="preview"
            className="max-h-32 max-w-full object-contain"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        </div>
      )}
    </div>
  );
}
