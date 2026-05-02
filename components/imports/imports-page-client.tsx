"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle2, XCircle, Eye, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { formatCurrency, formatDate } from "@/lib/utils";
import { importStatement, resolveMatch, updateCanonicalCategory } from "@/actions/statement-import";
import type { StatementImport, CanonicalTransaction, ExpenseAccount, StatementSource } from "@/lib/types";

interface ImportsPageClientProps {
  imports: StatementImport[];
  reviewTransactions: CanonicalTransaction[];
  unmatchedTransactions: CanonicalTransaction[];
  accounts: ExpenseAccount[];
  initialTab?: string;
}

const SOURCE_LABELS: Record<StatementSource, string> = {
  sbi: "SBI",
  phonepe: "PhonePe",
  hdfc: "HDFC",
  icici: "ICICI",
  card: "Card Statement",
  other: "Other",
};

const STATUS_CONFIG = {
  pending: { label: "Pending", color: "bg-yellow-100 text-yellow-800" },
  processing: { label: "Processing", color: "bg-blue-100 text-blue-800" },
  completed: { label: "Completed", color: "bg-emerald-100 text-emerald-800" },
  failed: { label: "Failed", color: "bg-red-100 text-red-800" },
};

export function ImportsPageClient({
  imports,
  reviewTransactions,
  unmatchedTransactions,
  accounts,
  initialTab,
}: ImportsPageClientProps) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [source, setSource] = useState<StatementSource>("sbi");
  const [password, setPassword] = useState("");
  const [resultDialog, setResultDialog] = useState<{
    open: boolean;
    result?: { totalRows: number; newTransactions: number; autoMatched: number; flaggedForReview: number; skippedDuplicates: number; errors: string[] };
  }>({ open: false });

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.set("source", source);
    if (password) formData.set("password", password);

    setUploading(true);
    try {
      const result = await importStatement(formData);
      setResultDialog({ open: true, result });
      toast.success(`Imported ${result.totalRows} rows`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setUploading(false);
      form.reset();
    }
  }

  async function handleResolve(id: number, action: "confirm" | "reject" | "ignore") {
    try {
      await resolveMatch(id, action);
      toast.success(action === "confirm" ? "Match confirmed" : action === "reject" ? "Match rejected" : "Transaction ignored");
      router.refresh();
    } catch {
      toast.error("Failed to resolve");
    }
  }

  async function handleCategorize(id: number, categoryId: number | null, accountId: number | null) {
    try {
      await updateCanonicalCategory(id, categoryId, accountId);
      toast.success("Category updated");
      router.refresh();
    } catch {
      toast.error("Failed to update category");
    }
  }

  const expenseCategories = accounts.filter(a => a.type === "expense" && a.isActive);
  const bankAccounts = accounts.filter(a => (a.type === "bank" || a.type === "cash") && a.isActive);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Statement Imports</h1>
      </div>

      <Tabs defaultValue={initialTab || "upload"}>
        <TabsList>
          <TabsTrigger value="upload">
            <Upload className="mr-1.5 h-4 w-4" />
            Upload
          </TabsTrigger>
          <TabsTrigger value="review">
            <AlertTriangle className="mr-1.5 h-4 w-4" />
            Review ({reviewTransactions.length})
          </TabsTrigger>
          <TabsTrigger value="unmatched">
            <Clock className="mr-1.5 h-4 w-4" />
            Unmatched ({unmatchedTransactions.length})
          </TabsTrigger>
          <TabsTrigger value="history">
            <FileSpreadsheet className="mr-1.5 h-4 w-4" />
            History ({imports.length})
          </TabsTrigger>
        </TabsList>

        {/* Upload Tab */}
        <TabsContent value="upload" className="mt-4">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Import Statement</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUpload} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="source">Statement Source</Label>
                    <Select value={source} onValueChange={(v) => setSource(v as StatementSource)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sbi">SBI Bank</SelectItem>
                        <SelectItem value="hdfc" disabled>HDFC (coming soon)</SelectItem>
                        <SelectItem value="icici" disabled>ICICI (coming soon)</SelectItem>
                        <SelectItem value="phonepe" disabled>PhonePe (coming soon)</SelectItem>
                        <SelectItem value="card" disabled>Card Statement (coming soon)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="file">Statement File</Label>
                    <Input
                      id="file"
                      name="file"
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Excel (.xlsx, .xls) or CSV files supported
                    </p>
                  </div>

                  {source === "sbi" && (
                    <div className="space-y-2">
                      <Label htmlFor="password">File Password (if protected)</Label>
                      <Input
                        id="password"
                        name="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Leave empty if not password-protected"
                      />
                    </div>
                  )}

                  <Button type="submit" disabled={uploading} className="w-full">
                    {uploading ? (
                      <>Processing...</>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Upload & Process
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>How It Works</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <div className="flex gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">1</div>
                  <p>Upload your bank statement file. Duplicate files are automatically detected.</p>
                </div>
                <div className="flex gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">2</div>
                  <p>Each row is parsed, fingerprinted, and matched against existing transactions using UTR, amount, date, and payee.</p>
                </div>
                <div className="flex gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">3</div>
                  <p>Exact and strong matches are auto-linked. Fuzzy matches go to the Review tab for your confirmation.</p>
                </div>
                <div className="flex gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">4</div>
                  <p>Unmatched transactions can be categorized and synced to Expenses when ready.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Review Tab */}
        <TabsContent value="review" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Transactions Needing Review</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {reviewTransactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <CheckCircle2 className="h-10 w-10 text-emerald-500 mb-3" />
                  <p className="text-muted-foreground">All clear! No transactions need review.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Direction</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reviewTransactions.map((txn) => (
                      <TableRow key={txn.id}>
                        <TableCell className="whitespace-nowrap">{formatDate(txn.date)}</TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {txn.description || txn.normalizedPayee || "-"}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {txn.reference || "-"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {formatCurrency(txn.amount)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={txn.direction === "credit" ? "default" : "secondary"}>
                            {txn.direction}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                              onClick={() => handleResolve(txn.id, "confirm")}
                              title="Confirm match"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                              onClick={() => handleResolve(txn.id, "reject")}
                              title="Reject match (mark as new)"
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-gray-500 hover:text-gray-700"
                              onClick={() => handleResolve(txn.id, "ignore")}
                              title="Ignore"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Unmatched Tab */}
        <TabsContent value="unmatched" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Unmatched Transactions</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {unmatchedTransactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <CheckCircle2 className="h-10 w-10 text-emerald-500 mb-3" />
                  <p className="text-muted-foreground">No unmatched transactions.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Payee</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Direction</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unmatchedTransactions.map((txn) => (
                      <UnmatchedRow
                        key={txn.id}
                        txn={txn}
                        categories={expenseCategories}
                        bankAccounts={bankAccounts}
                        onCategorize={handleCategorize}
                        onIgnore={() => handleResolve(txn.id, "ignore")}
                      />
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Import History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {imports.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <FileSpreadsheet className="h-10 w-10 text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground">No imports yet. Upload a statement to get started.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>File</TableHead>
                      <TableHead>Date Range</TableHead>
                      <TableHead className="text-right">Rows</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {imports.map((imp) => {
                      const statusCfg = STATUS_CONFIG[imp.status];
                      return (
                        <TableRow key={imp.id}>
                          <TableCell className="whitespace-nowrap">{formatDate(imp.createdAt)}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{SOURCE_LABELS[imp.source]}</Badge>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate" title={imp.originalName}>
                            {imp.originalName}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm">
                            {imp.dateRangeStart && imp.dateRangeEnd
                              ? `${formatDate(imp.dateRangeStart)} - ${formatDate(imp.dateRangeEnd)}`
                              : "-"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{imp.rowCount}</TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusCfg.color}`}>
                              {statusCfg.label}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Import Result Dialog */}
      <Dialog open={resultDialog.open} onOpenChange={(open) => setResultDialog({ open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Complete</DialogTitle>
            <DialogDescription>
              Statement has been processed successfully.
            </DialogDescription>
          </DialogHeader>
          {resultDialog.result && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <StatCard label="Total Rows" value={resultDialog.result.totalRows} />
                <StatCard label="New Transactions" value={resultDialog.result.newTransactions} color="text-emerald-600" />
                <StatCard label="Auto-Matched" value={resultDialog.result.autoMatched} color="text-blue-600" />
                <StatCard label="Needs Review" value={resultDialog.result.flaggedForReview} color="text-amber-600" />
                <StatCard label="Skipped (Duplicates)" value={resultDialog.result.skippedDuplicates} color="text-gray-500" />
              </div>
              {resultDialog.result.errors.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-sm font-medium text-amber-800 mb-1">Warnings ({resultDialog.result.errors.length})</p>
                  <ul className="text-xs text-amber-700 space-y-0.5 max-h-32 overflow-y-auto">
                    {resultDialog.result.errors.slice(0, 10).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                    {resultDialog.result.errors.length > 10 && (
                      <li>...and {resultDialog.result.errors.length - 10} more</li>
                    )}
                  </ul>
                </div>
              )}
              <Button className="w-full" onClick={() => setResultDialog({ open: false })}>
                Done
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-lg border p-3 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold tabular-nums ${color || ""}`}>{value}</p>
    </div>
  );
}

function UnmatchedRow({
  txn,
  categories,
  bankAccounts,
  onCategorize,
  onIgnore,
}: {
  txn: CanonicalTransaction;
  categories: ExpenseAccount[];
  bankAccounts: ExpenseAccount[];
  onCategorize: (id: number, categoryId: number | null, accountId: number | null) => void;
  onIgnore: () => void;
}) {
  const [categoryId, setCategoryId] = useState<string>(txn.categoryId?.toString() || "");
  const [accountId, setAccountId] = useState<string>(txn.accountId?.toString() || "");

  function handleSave() {
    onCategorize(
      txn.id,
      categoryId ? parseInt(categoryId) : null,
      accountId ? parseInt(accountId) : null,
    );
  }

  return (
    <TableRow>
      <TableCell className="whitespace-nowrap">{formatDate(txn.date)}</TableCell>
      <TableCell className="max-w-[150px] truncate" title={txn.description || ""}>
        {txn.description || "-"}
      </TableCell>
      <TableCell className="max-w-[100px] truncate" title={txn.normalizedPayee || ""}>
        {txn.normalizedPayee || "-"}
      </TableCell>
      <TableCell className="font-mono text-xs">
        {txn.reference || "-"}
      </TableCell>
      <TableCell className="text-right tabular-nums font-medium">
        {formatCurrency(txn.amount)}
      </TableCell>
      <TableCell>
        <Badge variant={txn.direction === "credit" ? "default" : "secondary"}>
          {txn.direction}
        </Badge>
      </TableCell>
      <TableCell>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger className="h-8 w-[130px] text-xs">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id.toString()}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Select value={accountId} onValueChange={setAccountId}>
          <SelectTrigger className="h-8 w-[130px] text-xs">
            <SelectValue placeholder="Account" />
          </SelectTrigger>
          <SelectContent>
            {bankAccounts.map((acc) => (
              <SelectItem key={acc.id} value={acc.id.toString()}>
                {acc.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleSave}>
            Save
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-gray-500"
            onClick={onIgnore}
            title="Ignore"
          >
            <Eye className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
