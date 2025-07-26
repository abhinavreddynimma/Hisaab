"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { EXPENSE_ACCOUNT_TYPES } from "@/lib/constants";
import { AccountDialog } from "./account-dialog";
import type { ExpenseAccount, ExpenseAccountType } from "@/lib/types";

interface AccountsListProps {
  accountsGrouped: {
    type: ExpenseAccountType;
    label: string;
    accounts: (ExpenseAccount & { children: ExpenseAccount[]; balance: number })[];
    totalBalance: number;
  }[];
}

export function AccountsList({ accountsGrouped }: AccountsListProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<ExpenseAccount | null>(null);
  const [defaultType, setDefaultType] = useState<ExpenseAccountType>("expense");

  const assets = accountsGrouped
    .filter(g => ["cash", "bank", "investment", "savings"].includes(g.type))
    .reduce((sum, g) => sum + g.totalBalance, 0);

  function handleAddForType(type: ExpenseAccountType) {
    setDefaultType(type);
    setEditingAccount(null);
    setDialogOpen(true);
  }

  function handleClose() {
    setDialogOpen(false);
    setEditingAccount(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total Assets</span>
            <span className="font-bold tabular-nums text-emerald-600">{formatCurrency(assets)}</span>
          </div>
        </CardContent>
      </Card>

      {accountsGrouped.map(group => (
        <Card key={group.type}>
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold" style={{ color: EXPENSE_ACCOUNT_TYPES[group.type].color }}>
                {group.label}
              </CardTitle>
              <div className="flex items-center gap-2">
                {["cash", "bank", "investment", "savings"].includes(group.type) && (
                  <span className="text-sm font-semibold tabular-nums">{formatCurrency(group.totalBalance)}</span>
                )}
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleAddForType(group.type)}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {group.accounts.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">No accounts</p>
            ) : (
              <div className="space-y-1">
                {group.accounts.map(account => (
                  <div key={account.id}>
                    <div
                      className="flex items-center justify-between py-2 px-2 -mx-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                      onClick={() => router.push(`/expenses/${account.id}`)}
                    >
                      <span className="text-sm font-medium">{account.name}</span>
                      <div className="flex items-center gap-2">
                        {["cash", "bank", "investment", "savings"].includes(account.type) && (
                          <span className="text-sm tabular-nums font-medium">{formatCurrency(account.balance)}</span>
                        )}
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                    {account.children.length > 0 && (
                      <div className="ml-4 space-y-0.5">
                        {account.children.map(child => {
                          const grandchildren = (child as ExpenseAccount & { children?: ExpenseAccount[] }).children ?? [];
                          return (
                            <div key={child.id}>
                              <div
                                className="flex items-center justify-between py-1.5 px-2 -mx-2 rounded-lg hover:bg-muted/50 cursor-pointer text-muted-foreground"
                                onClick={() => router.push(`/expenses/${child.id}`)}
                              >
                                <span className="text-xs font-medium">{child.name}</span>
                                <ChevronRight className="h-3 w-3" />
                              </div>
                              {grandchildren.length > 0 && (
                                <div className="ml-4 space-y-0.5">
                                  {grandchildren.map(gc => (
                                    <div
                                      key={gc.id}
                                      className="flex items-center justify-between py-1 px-2 -mx-2 rounded-lg hover:bg-muted/50 cursor-pointer text-muted-foreground/60"
                                      onClick={() => router.push(`/expenses/${gc.id}`)}
                                    >
                                      <span className="text-[11px]">{gc.name}</span>
                                      <ChevronRight className="h-2.5 w-2.5" />
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      <AccountDialog
        open={dialogOpen}
        onClose={handleClose}
        account={editingAccount}
        defaultType={defaultType}
        allAccounts={accountsGrouped.flatMap(g => g.accounts)}
      />
    </div>
  );
}
