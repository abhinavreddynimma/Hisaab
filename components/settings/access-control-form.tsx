"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createAdmin,
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
  hasAdminUser: boolean;
  initialViewers: AuthUser[];
}

export function AccessControlForm({
  sessionsEnabled,
  hasAdminUser,
  initialViewers,
}: AccessControlFormProps) {
  const router = useRouter();

  // Admin creation state
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminConfirmPassword, setAdminConfirmPassword] = useState("");
  const [creatingAdmin, setCreatingAdmin] = useState(false);

  // Viewer creation state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tag, setTag] = useState("");
  const [creatingViewer, setCreatingViewer] = useState(false);

  // Viewer list state
  const [updatingUserId, setUpdatingUserId] = useState<number | null>(null);
  const [viewers, setViewers] = useState<AuthUser[]>(initialViewers);

  const hasActiveViewer = useMemo(
    () => viewers.some((viewer) => viewer.isActive),
    [viewers]
  );

  async function handleCreateAdmin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (adminPassword !== adminConfirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setCreatingAdmin(true);
    try {
      const result = await createAdmin({
        name: adminName,
        email: adminEmail,
        password: adminPassword,
      });
      if (!result.success) {
        toast.error(result.error ?? "Unable to create admin account");
        return;
      }
      toast.success("Admin account created. Sessions are now enabled.");
      router.refresh();
    } finally {
      setCreatingAdmin(false);
    }
  }

  async function handleCreateViewer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreatingViewer(true);
    try {
      const result = await createViewerUser({
        name,
        email,
        password,
        tag: tag || undefined,
      });
      if (!result.success) {
        toast.error(result.error ?? "Unable to create user");
        return;
      }
      toast.success("User account created");
      setName("");
      setEmail("");
      setPassword("");
      setTag("");
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
        toast.error(result.error ?? "Unable to update user");
        return;
      }
      setViewers((current) =>
        current.map((viewer) =>
          viewer.id === userId ? { ...viewer, isActive } : viewer
        )
      );
      toast.success(isActive ? "User enabled" : "User disabled");
    } finally {
      setUpdatingUserId(null);
    }
  }

  if (!sessionsEnabled && !hasAdminUser) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Create Admin Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Create your admin account to enable access control. Once created,
            sign-in will be required to access the app and you can add users
            with view-only permissions.
          </p>
          <form onSubmit={handleCreateAdmin} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="admin-name">Name</Label>
                <Input
                  id="admin-name"
                  value={adminName}
                  onChange={(event) => setAdminName(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-email">Email</Label>
                <Input
                  id="admin-email"
                  type="email"
                  value={adminEmail}
                  onChange={(event) => setAdminEmail(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-password">Password</Label>
                <Input
                  id="admin-password"
                  type="password"
                  minLength={8}
                  value={adminPassword}
                  onChange={(event) => setAdminPassword(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-confirm-password">Confirm Password</Label>
                <Input
                  id="admin-confirm-password"
                  type="password"
                  minLength={8}
                  value={adminConfirmPassword}
                  onChange={(event) => setAdminConfirmPassword(event.target.value)}
                  required
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={creatingAdmin}>
                {creatingAdmin ? "Creating..." : "Create Admin Account"}
              </Button>
            </div>
          </form>
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
              {hasActiveViewer ? "User accounts are active." : "No user accounts yet."}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Create User Account</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateViewer} className="grid gap-4 sm:grid-cols-2">
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
            <div className="space-y-2">
              <Label htmlFor="viewer-tag">Tag</Label>
              <Input
                id="viewer-tag"
                placeholder="e.g. accountant, friend, lawyer"
                value={tag}
                onChange={(event) => setTag(event.target.value)}
              />
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <Button type="submit" disabled={creatingViewer}>
                {creatingViewer ? "Creating..." : "Create User"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>User Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          {viewers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No user accounts created yet.</p>
          ) : (
            <div className="space-y-3">
              {viewers.map((viewer) => (
                <div
                  key={viewer.id}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{viewer.name}</p>
                      {viewer.tag && (
                        <Badge variant="outline">{viewer.tag}</Badge>
                      )}
                    </div>
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
