"use client";

import { useState, useRef } from "react";
import { toast } from "sonner";
import { Upload, Trash2, FileText, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { InvoiceAttachment } from "@/lib/types";

interface InvoiceAttachmentsProps {
  invoiceId: number;
  attachments: InvoiceAttachment[];
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function InvoiceAttachments({
  invoiceId,
  attachments: initialAttachments,
}: InvoiceAttachmentsProps) {
  const [attachments, setAttachments] = useState(initialAttachments);
  const [uploading, setUploading] = useState(false);
  const [label, setLabel] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      toast.error("Please select a file");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (label.trim()) {
        formData.append("label", label.trim());
      }

      const response = await fetch(`/api/invoices/${invoiceId}/attachments`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const result = await response.json();
      setAttachments((prev) => [
        {
          id: result.id,
          invoiceId,
          fileName: "",
          originalName: file.name,
          mimeType: file.type,
          fileSize: file.size,
          label: label.trim() || null,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      setLabel("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      toast.success("File uploaded successfully");
    } catch {
      toast.error("Failed to upload file");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(attachmentId: number) {
    setDeletingId(attachmentId);
    try {
      const response = await fetch(`/api/attachments/${attachmentId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Delete failed");
      }

      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
      toast.success("Attachment deleted");
    } catch {
      toast.error("Failed to delete attachment");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Card className="no-print">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Attachments
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload Form */}
        <form onSubmit={handleUpload} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="attachment-file" className="text-xs">File</Label>
              <Input
                id="attachment-file"
                type="file"
                ref={fileInputRef}
                className="text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="attachment-label" className="text-xs">Label (optional)</Label>
              <Input
                id="attachment-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Bank Receipt, FIRA, Statement"
                className="text-sm"
              />
            </div>
          </div>
          <Button type="submit" size="sm" disabled={uploading}>
            {uploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            {uploading ? "Uploading..." : "Upload"}
          </Button>
        </form>

        {/* Attachments List */}
        {attachments.length > 0 && (
          <div className="divide-y rounded-md border">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="flex items-center justify-between gap-3 px-3 py-2"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {attachment.originalName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(attachment.fileSize)}
                      {attachment.label && (
                        <span className="ml-2 rounded bg-muted px-1.5 py-0.5">
                          {attachment.label}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    asChild
                  >
                    <a
                      href={`/api/attachments/${attachment.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Download className="h-4 w-4" />
                      <span className="sr-only">Download</span>
                    </a>
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        disabled={deletingId === attachment.id}
                      >
                        {deletingId === attachment.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                        <span className="sr-only">Delete</span>
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Attachment</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete &quot;{attachment.originalName}&quot;?
                          This cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(attachment.id)}
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}

        {attachments.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-4">
            No attachments yet. Upload bank receipts, FIRA, or other documents.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
