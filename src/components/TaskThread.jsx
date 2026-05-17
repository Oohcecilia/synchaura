import { useState, useEffect, useRef } from "react";
import { MessageSquare, Paperclip, Send, X, FileText, Download, Loader2, AtSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

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

function CommentBubble({ comment }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
          {(comment.author_name || comment.author_email || "?")[0].toUpperCase()}
        </div>
        <span className="text-xs font-semibold">{comment.author_name || comment.author_email}</span>
        <span className="text-[10px] text-muted-foreground ml-auto">
          {formatDistanceToNow(new Date(comment.created_date), { addSuffix: true })}
        </span>
      </div>
      <div className="ml-8 space-y-2">
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{renderContent(comment.content)}</p>
        {comment.attachments && comment.attachments.length > 0 && (
          <div className="space-y-1">
            {comment.attachments.map((file, i) => (
              <a
                key={i}
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs bg-muted/50 hover:bg-muted rounded-lg px-2.5 py-1.5 transition-colors group"
              >
                <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="flex-1 truncate">{file.name}</span>
                {file.size && <span className="text-muted-foreground">{formatBytes(file.size)}</span>}
                <Download className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function TaskThread({ task, members, currentUser }) {
  const [comments, setComments] = useState([]);
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStart, setMentionStart] = useState(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const bottomRef = useRef(null);

  const loadComments = async () => {
    if (!task?.id) return;
    // const data = await base44.entities.TaskComment.filter({ task_id: task.id }, "created_date", 100);
    // setComments(data);
  };

  useEffect(() => {
    if (task?.id) loadComments();
  }, [task?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments]);

  const handleTextChange = (e) => {
    const val = e.target.value;
    setText(val);
    const cursor = e.target.selectionStart;
    const textUpToCursor = val.slice(0, cursor);
    const atMatch = textUpToCursor.match(/@(\w*)$/);
    if (atMatch) {
      setMentionQuery(atMatch[1].toLowerCase());
      setMentionStart(cursor - atMatch[0].length);
      setShowMentions(true);
    } else {
      setShowMentions(false);
      setMentionStart(null);
    }
  };

  const insertMention = (member) => {
    const name = (member.full_name || member.email).replace(/\s+/g, "_");
    const before = text.slice(0, mentionStart);
    const after = text.slice(textareaRef.current?.selectionStart || mentionStart);
    const newText = `${before}@${name} ${after}`;
    setText(newText);
    setShowMentions(false);
    textareaRef.current?.focus();
  };

  const filteredMembers = (members || []).filter((m) => {
    const n = (m.full_name || m.email || "").toLowerCase();
    return n.includes(mentionQuery);
  });

  const handleFiles = async (files) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const newAttachments = [...attachments];
    // for (const file of Array.from(files)) {
    // //   const { file_url } = await base44.integrations.Core.UploadFile({ file });
    // //   newAttachments.push({ name: file.name, url: file_url, size: file.size });
    // }
    setAttachments(newAttachments);
    setUploading(false);
  };

  const removeAttachment = (i) => setAttachments(attachments.filter((_, idx) => idx !== i));

  const handlePost = async () => {
    if (!text.trim() && attachments.length === 0) return;
    setPosting(true);
    const mentions = [...text.matchAll(/@(\S+)/g)].map((m) => m[1]);
    // await base44.entities.TaskComment.create({
    //   task_id: task.id,
    //   content: text.trim(),
    //   author_email: currentUser?.email || "",
    //   author_name: currentUser?.full_name || currentUser?.email || "",
    //   mentions,
    //   attachments,
    // });
    setText("");
    setAttachments([]);
    await loadComments();
    setPosting(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handlePost();
    }
    if (e.key === "Escape") setShowMentions(false);
  };

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
        <MessageSquare className="h-3.5 w-3.5" /> Discussion ({comments.length})
      </h4>

      {/* Comment list */}
      <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
        {/* {comments.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">No comments yet. Start the discussion!</p>
        )} */}
        {comments.map((c) => (
          <CommentBubble key={c.id} comment={c} members={members} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="border border-border rounded-xl bg-background overflow-visible">
        {/* Pending attachments */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-3 pt-2.5">
            {attachments.map((f, i) => (
              <div key={i} className="flex items-center gap-1 text-xs bg-muted rounded-md px-2 py-1">
                <FileText className="h-3 w-3 text-muted-foreground" />
                <span className="max-w-[100px] truncate">{f.name}</span>
                <button type="button" onClick={() => removeAttachment(i)} className="text-muted-foreground hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Mention dropdown */}
        <div className="relative">
          {showMentions && filteredMembers.length > 0 && (
            <div className="absolute bottom-full left-3 mb-1 z-50 bg-popover border border-border rounded-lg shadow-lg overflow-hidden min-w-[160px]">
              {filteredMembers.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); insertMention(m); }}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-muted transition-colors"
                >
                  <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary shrink-0">
                    {(m.full_name || m.email || "?")[0].toUpperCase()}
                  </div>
                  <span>{m.full_name || m.email}</span>
                </button>
              ))}
            </div>
          )}

          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder="Write a comment… use @ to mention"
            rows={2}
            className="w-full text-sm px-3 pt-2.5 pb-1 bg-transparent resize-none outline-none placeholder:text-muted-foreground"
          />
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 px-2 pb-2">
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
            title="Attach files"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
          </button>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
          <span className="text-[10px] text-muted-foreground ml-auto">⌘↵ to send</span>
          <Button
            size="sm"
            className="h-7 text-xs px-3"
            disabled={posting || (!text.trim() && attachments.length === 0)}
            onClick={handlePost}
          >
            {posting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>
    </div>
  );
}