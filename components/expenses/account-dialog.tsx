"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createExpenseAccount, updateExpenseAccount, toggleExpenseAccountActive } from "@/actions/expenses";
import { EXPENSE_ACCOUNT_TYPES } from "@/lib/constants";
import type { ExpenseAccount, ExpenseAccountType } from "@/lib/types";

interface AccountDialogProps {
  open: boolean;
  onClose: () => void;
  account: ExpenseAccount | null;
  defaultType: ExpenseAccountType;
  allAccounts: ExpenseAccount[];
}

export function AccountDialog({ open, onClose, account, defaultType, allAccounts }: AccountDialogProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<ExpenseAccountType>(defaultType);
  const [parentId, setParentId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (account) {
      setName(account.name);
      setType(account.type);
      setParentId(account.parentId ? String(account.parentId) : "none");
    } else {
      setName("");
      setType(defaultType);
      setParentId("none");
    }
  }, [account, defaultType, open]);

  const parentOptions = allAccounts.filter(a => a.type === type && !a.parentId && a.id !== account?.id);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name) { toast.error("Please enter a name"); return; }

    setSaving(true);
    try {
      if (account) {
        await updateExpenseAccount(account.id, { name, type, parentId: parentId !== "none" ? parseInt(parentId) : null });
        toast.success("Account updated");
      } else {
        await createExpenseAccount({ name, type, parentId: parentId !== "none" ? parseInt(parentId) : null });
        toast.success("Account created");
      }
      onClose();
    } catch {
      toast.error("Failed to save account");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive() {
    if (!account) return;
    try {
      await toggleExpenseAccountActive(account.id);
      toast.success(account.isActive ? "Account deactivated" : "Account activated");
      onClose();
    } catch {
      toast.error("Failed to update account");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{account ? "Edit" : "Add"} Account</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input placeholder="Account name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as ExpenseAccountType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(EXPENSE_ACCOUNT_TYPES).map(([key, config]) => (
                  <SelectItem key={key} value={key}>{config.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {type === "expense" && parentOptions.length > 0 && (
            <div className="space-y-2">
              <Label>Parent Category (optional)</Label>
              <Select value={parentId} onValueChange={setParentId}>
                <SelectTrigger><SelectValue placeholder="None (top-level)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (top-level)</SelectItem>
                  {parentOptions.map(a => (
                    <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex justify-between pt-2">
            <div>
              {account && (
                <Button type="button" variant="outline" size="sm" onClick={handleToggleActive}>
                  {account.isActive ? "Deactivate" : "Activate"}
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving..." : account ? "Update" : "Create"}</Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
