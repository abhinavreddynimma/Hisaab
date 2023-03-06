"use client";

import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { formatEuro } from "@/lib/utils";

export interface LineItem {
  description: string;
  hsnSac: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

interface LineItemsEditorProps {
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
}

export function LineItemsEditor({ items, onChange }: LineItemsEditorProps) {
  function updateItem(index: number, field: keyof LineItem, value: string | number) {
    const updated = [...items];
    const item = { ...updated[index] };

    if (field === "description" || field === "hsnSac") {
      item[field] = value as string;
    } else if (field === "quantity" || field === "unitPrice") {
      const numValue = parseFloat(value as string) || 0;
      item[field] = numValue;
      item.amount = item.quantity * item.unitPrice;
    }

    updated[index] = item;
    onChange(updated);
  }

  function addRow() {
    onChange([
      ...items,
      { description: "Software Development (Artificial Intelligence Research)", hsnSac: "998314", quantity: 0, unitPrice: 0, amount: 0 },
    ]);
  }

  function removeRow(index: number) {
    const updated = items.filter((_, i) => i !== index);
    onChange(updated);
  }

  const total = items.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="space-y-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[200px]">Description</TableHead>
            <TableHead className="w-[120px]">HSN/SAC</TableHead>
            <TableHead className="w-[100px]">Quantity</TableHead>
            <TableHead className="w-[120px]">Unit Price</TableHead>
            <TableHead className="w-[120px] text-right">Amount</TableHead>
            <TableHead className="w-[50px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                No line items added. Click &quot;Add Row&quot; to begin.
              </TableCell>
            </TableRow>
          ) : (
            items.map((item, index) => (
              <TableRow key={index}>
                <TableCell>
                  <Input
                    value={item.description}
                    onChange={(e) =>
                      updateItem(index, "description", e.target.value)
                    }
                    placeholder="Service description"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    value={item.hsnSac}
                    onChange={(e) =>
                      updateItem(index, "hsnSac", e.target.value)
                    }
                    placeholder="HSN/SAC"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min={0}
                    step="0.5"
                    value={item.quantity || ""}
                    onChange={(e) =>
                      updateItem(index, "quantity", e.target.value)
                    }
                    placeholder="0"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={item.unitPrice || ""}
                    onChange={(e) =>
                      updateItem(index, "unitPrice", e.target.value)
                    }
                    placeholder="0.00"
                  />
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatEuro(item.amount)}
                </TableCell>
                <TableCell>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeRow(index)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Remove row</span>
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
        {items.length > 0 && (
          <TableFooter>
            <TableRow>
              <TableCell colSpan={4} className="text-right font-semibold">
                Subtotal
              </TableCell>
              <TableCell className="text-right font-semibold">
                {formatEuro(total)}
              </TableCell>
              <TableCell />
            </TableRow>
          </TableFooter>
        )}
      </Table>
      <Button type="button" variant="outline" size="sm" onClick={addRow}>
        <Plus className="mr-2 h-4 w-4" />
        Add Row
      </Button>
    </div>
  );
}
