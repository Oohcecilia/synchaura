import { useState, useEffect, useRef } from "react";
import { MessageSquare, Paperclip, Send, X, FileText, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";

function formatBytes(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function renderContent(content, members) {
  // Highlight @mentions
  const parts = content.split(/(@\S+)/g);
  return parts.map((part, i) => {
    if (part.startsWith("@")) {
      return (
        <span key={i} className="text-primary font-semibold">
          {part}
        </span>
      );
    }
    return part;
  });
}

export default function TaskThread({ task, members = [] }) {
  const [messages, setMessages] = useState(task?.comments || []);
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    setMessages(task?.comments || []);
  }, [task]);

  const handleSend = () => {
    if (!text.trim()) return;

    const nextMessage = {
      id: crypto.randomUUID(),
      text: text.trim(),
      created_at: new Date().toISOString(),
      attachments: [],
    };

    setMessages((prev) => [...prev, nextMessage]);
    setText("");
  };

  const handleFile = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setUploading(true);
    setTimeout(() => {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }, 300);
  };

  return (
    <div className="border rounded-xl p-3 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <MessageSquare className="h-4 w-4" />
        Thread
      </div>

      <div className="space-y-2 max-h-52 overflow-y-auto">
        {messages.length === 0 ? (
          <p className="text-xs text-muted-foreground">No comments yet</p>
        ) : (
          messages.map((message) => (
            <div key={message.id || message.created_at} className="bg-muted/40 rounded-lg p-2 text-xs">
              <p>{renderContent(message.text || "", members)}</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                {message.created_at
                  ? formatDistanceToNow(new Date(message.created_at), { addSuffix: true })
                  : "just now"}
              </p>
              {message.attachments?.map((attachment) => (
                <a
                  key={attachment.name}
                  href={attachment.url}
                  className="flex items-center gap-1 text-[10px] text-primary mt-1"
                >
                  <FileText className="h-3 w-3" />
                  {attachment.name} ({formatBytes(attachment.size)})
                  <Download className="h-3 w-3" />
                </a>
              ))}
            </div>
          ))
        )}
      </div>

      <div className="flex gap-2">
        <input ref={fileRef} type="file" className="hidden" multiple onChange={handleFile} />
        <Button type="button" size="icon" variant="outline" onClick={() => fileRef.current?.click()}>
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
        </Button>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a comment..."
          className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
        />
        {text && (
          <Button type="button" size="icon" variant="ghost" onClick={() => setText("")}>
            <X className="h-4 w-4" />
          </Button>
        )}
        <Button type="button" size="icon" onClick={handleSend}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
