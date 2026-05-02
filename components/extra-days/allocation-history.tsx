"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteExtraDayAllocation } from "@/actions/extra-days";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { ExtraDayAllocationDetail } from "@/lib/types";

function formatDays(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

interface AllocationHistoryProps {
  allocations: ExtraDayAllocationDetail[];
  canAllocate: boolean;
  onEditAllocation: (allocation: ExtraDayAllocationDetail) => void;
}

export function AllocationHistory({ allocations, canAllocate, onEditAllocation }: AllocationHistoryProps) {
  const router = useRouter();

  async function handleDelete(id: number) {
    if (!window.confirm("Delete this planner allocation?")) return;
    const result = await deleteExtraDayAllocation(id);
    if (!result.success) {
      toast.error(result.error ?? "Failed to delete allocation");
      return;
    }
    toast.success("Allocation deleted");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div className="space-y-1">
          <CardTitle>Allocation History</CardTitle>
          <p className="text-sm text-muted-foreground">
            FY-scoped planner entries only. These records do not affect any other Hisaab page.
          </p>
        </div>
        <Badge variant={canAllocate ? "secondary" : "outline"}>
          {canAllocate ? "Planner open" : "Planner locked for new allocations"}
        </Badge>
      </CardHeader>
      <CardContent>
        {allocations.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/70 p-6 text-sm text-muted-foreground">
            No planner allocations yet.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Bucket</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead className="text-right">Days</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allocations.map((allocation) => (
                <TableRow key={allocation.id}>
                  <TableCell>{formatDate(allocation.confirmedDate)}</TableCell>
                  <TableCell>{allocation.bucketName}</TableCell>
                  <TableCell>{allocation.targetName ?? "General Reserve"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{allocation.kind === "money" ? "Money" : "Days"}</Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatDays(allocation.days)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {allocation.dailyRate != null ? formatCurrency(allocation.dailyRate) : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {allocation.amountInr != null ? formatCurrency(allocation.amountInr) : "—"}
                  </TableCell>
                  <TableCell className="max-w-[220px] truncate text-muted-foreground">
                    {allocation.notes ?? "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => onEditAllocation(allocation)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleDelete(allocation.id)}>
                        Delete
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
  );
}
