"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FYNavigatorProps {
  financialYear: string;
  basePath: string;
}

export function FYNavigator({ financialYear, basePath }: FYNavigatorProps) {
  const router = useRouter();

  function navigate(direction: -1 | 1) {
    const startYear = parseInt(financialYear.split("-")[0]) + direction;
    const newFY = `${startYear}-${String(startYear + 1).slice(2)}`;
    router.push(`${basePath}?fy=${newFY}`);
  }

  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => navigate(-1)}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="text-sm font-medium text-muted-foreground">FY {financialYear}</span>
      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => navigate(1)}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
