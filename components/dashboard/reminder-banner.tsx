"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { dismissReminder } from "@/actions/reminders";
import { toast } from "sonner";

interface ReminderBannerProps {
  reminders: { id: number; type: string; monthKey: string }[];
}

const MESSAGES: Record<string, string> = {
  accountant_documents: "Send last month's invoice and FIRA to your accountant",
};

export function ReminderBanner({ reminders: initial }: ReminderBannerProps) {
  const [items, setItems] = useState(initial);
  const router = useRouter();

  if (items.length === 0) return null;

  async function handleDismiss(id: number) {
    setItems((prev) => prev.filter((r) => r.id !== id));
    try {
      await dismissReminder(id);
      router.refresh();
    } catch {
      toast.error("Failed to dismiss reminder");
    }
  }

  return (
    <div className="space-y-2">
      {items.map((r) => (
        <Card key={r.id} className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
          <CardContent className="flex items-center gap-3 p-3">
            <Bell className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="flex-1 text-sm font-medium text-amber-800 dark:text-amber-200">
              {MESSAGES[r.type] ?? r.type}
            </p>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200"
              onClick={() => handleDismiss(r.id)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
