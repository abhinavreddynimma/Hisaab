"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createShareableSetupLink,
  createViewerUser,
  updateViewerStatus,
} from "@/actions/auth";
import type { AuthUser } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AccessControlFormProps {
  sessionsEnabled: boolean;
  setupLinkExpiresAt: string | null;
  initialViewers: AuthUser[];
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString();
}

export function AccessControlForm({
  sessionsEnabled,
  setupLinkExpiresAt,
  initialViewers,
}: AccessControlFormProps) {
  const router = useRouter();
  const [generatingLink, setGeneratingLink] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [generatedLinkExpiry, setGeneratedLinkExpiry] = useState<string | null>(setupLinkExpiresAt);
  const [creatingViewer, setCreatingViewer] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [updatingUserId, setUpdatingUserId] = useState<number | null>(null);
  const [viewers, setViewers] = useState<AuthUser[]>(initialViewers);

  const hasActiveViewer = useMemo(
    () => viewers.some((viewer) => viewer.isActive),
    [viewers]
  );

  async function handleGenerateLink() {
    setGeneratingLink(true);
    try {
      const result = await createShareableSetupLink();
      if (!result.success || !result.token || !result.expiresAt) {
        toast.error(result.error ?? "Unable to generate shareable link");
        return;
      }
      const url = `${window.location.origin}/hisaab/setup/${result.token}`;
      setGeneratedLink(url);
      setGeneratedLinkExpiry(result.expiresAt);
      toast.success("Shareable setup link created");
    } finally {
      setGeneratingLink(false);
    }
  }

  async function handleCopyLink() {
    if (!generatedLink) return;
    await navigator.clipboard.writeText(generatedLink);
    toast.success("Link copied");
  }

  async function handleCreateViewer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreatingViewer(true);
    try {
      const result = await createViewerUser({ name, email, password });
      if (!result.success) {
        toast.error(result.error ?? "Unable to create viewer");
        return;
      }
      toast.success("Viewer account created");
      setName("");
      setEmail("");
      setPassword("");
      router.refresh();
    } finally {
      setCreatingViewer(false);
    }
  }

  async function handleToggleViewer(userId: number, isActive: boolean) {
    setUpdatingUserId(userId);
    try {
      const result = await updateViewerStatus({ userId, isActive });
      if (!result.success) {
        toast.error(result.error ?? "Unable to update viewer");
        return;
      }
      setViewers((current) =>
        current.map((viewer) =>
          viewer.id === userId ? { ...viewer, isActive } : viewer
        )
      );
      toast.success(isActive ? "Viewer enabled" : "Viewer disabled");
    } finally {
      setUpdatingUserId(null);
    }
  }

  if (!sessionsEnabled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Enable User Sessions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Sessions are currently disabled. Generate a shareable setup link to create
            the first admin account. Once that account is created, sign-in will be required.
          </p>
          <Button onClick={handleGenerateLink} disabled={generatingLink}>
            {generatingLink ? "Generating..." : "Create Shareable Link"}
          </Button>

          {generatedLink && (
            <div className="space-y-2 rounded-md border p-3">
              <Label htmlFor="setup-link">Setup link</Label>
              <Input id="setup-link" value={generatedLink} readOnly />
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  Expires on {generatedLinkExpiry ? formatDateTime(generatedLinkExpiry) : "N/A"}
                </p>
                <Button size="sm" variant="outline" onClick={handleCopyLink}>
                  Copy
                </Button>
              </div>
            </div>
          )}

          {!generatedLink && generatedLinkExpiry && (
            <p className="text-xs text-muted-foreground">
              A previous setup link exists and expires on {formatDateTime(generatedLinkExpiry)}.
              Generate a new link if needed.
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Session Access</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Sessions are enabled. Users must sign in to access the app.
          </p>
          <div className="flex items-center gap-2">
            <Badge variant="default">Enabled</Badge>
            <span className="text-xs text-muted-foreground">
              {hasActiveViewer ? "Viewer accounts are active." : "No active viewer accounts yet."}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Create Viewer Account</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateViewer} className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="viewer-name">Name</Label>
              <Input
                id="viewer-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="viewer-email">Email</Label>
              <Input
                id="viewer-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="viewer-password">Password</Label>
              <Input
                id="viewer-password"
                type="password"
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
            <div className="sm:col-span-3 flex justify-end">
              <Button type="submit" disabled={creatingViewer}>
                {creatingViewer ? "Creating..." : "Create Viewer"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Viewer Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          {viewers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No viewer accounts created yet.</p>
          ) : (
            <div className="space-y-3">
              {viewers.map((viewer) => (
                <div
                  key={viewer.id}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div>
                    <p className="font-medium">{viewer.name}</p>
                    <p className="text-sm text-muted-foreground">{viewer.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={viewer.isActive ? "outline" : "secondary"}>
                      {viewer.isActive ? "Active" : "Disabled"}
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={updatingUserId === viewer.id}
                      onClick={() => handleToggleViewer(viewer.id, !viewer.isActive)}
                    >
                      {viewer.isActive ? "Disable" : "Enable"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
