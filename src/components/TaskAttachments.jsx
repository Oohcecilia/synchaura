import { useState, useRef } from "react";
import { Paperclip, Upload, X, FileText, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

function formatBytes(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileName(name) {
  return name.length > 30 ? name.slice(0, 27) + "…" : name;
}

// Read-only view used in TaskDetailDialog
export function AttachmentsViewer({ attachments }) {
  if (!attachments || attachments.length === 0) return null;
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
        <Paperclip className="h-3.5 w-3.5" /> Attachments ({attachments.length})
      </h4>
      <div className="space-y-1.5">
        {attachments.map((file, i) => (
          <a
            key={i}
            href={file.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs bg-muted/40 hover:bg-muted rounded-lg px-3 py-2 transition-colors group"
          >
            <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="flex-1 truncate font-medium">{getFileName(file.name)}</span>
            {file.size && <span className="text-muted-foreground">{formatBytes(file.size)}</span>}
            <Download className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          </a>
        ))}
      </div>
    </div>
  );
}

// Editable uploader used in TaskFormDialog
export default function TaskAttachments({ attachments = [], onChange }) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  const handleFiles = async (files) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const newAttachments = [...attachments];
    for (const file of Array.from(files)) {
      const { file_url } = {};
      newAttachments.push({ name: file.name, url: file_url, size: file.size });
    }
    onChange(newAttachments);
    setUploading(false);
  };

  const removeAttachment = (index) => {
    onChange(attachments.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium flex items-center gap-1.5">
          <Paperclip className="h-3.5 w-3.5" /> Attachments
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="h-7 text-xs"
        >
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
          {uploading ? "Uploading…" : "Upload"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {attachments.length > 0 && (
        <div className="space-y-1.5">
          {attachments.map((file, i) => (
            <div key={i} className="flex items-center gap-2 text-xs bg-muted/40 rounded-lg px-3 py-2">
              <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="flex-1 truncate">{getFileName(file.name)}</span>
              {file.size && <span className="text-muted-foreground">{formatBytes(file.size)}</span>}
              <button type="button" onClick={() => removeAttachment(i)} className="text-muted-foreground hover:text-destructive transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {attachments.length === 0 && !uploading && (
        <p className="text-xs text-muted-foreground">No attachments yet.</p>
      )}
    </div>
  );
}