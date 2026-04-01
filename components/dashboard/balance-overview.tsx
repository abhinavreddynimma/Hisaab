"use client";

import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  Label,
  ResponsiveContainer,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Plus, Minus } from "lucide-react";

interface BalanceOverviewProps {
  balanceData: {
    leaveBalance: number;
    totalExtraWorking: number;
    extraBalance: number;
    leavesAllowed: number;
    leavesTaken: number;
    annualDaysOffTarget: number;
    totalDaysOffToDate: number;
    expectedDaysOffToDate: number;
    burnoutRiskThreshold: number;
    leavesTakenToDate: number;
    publicHolidaysOffToDate: number;
    daysOffStatus: "burnout_risk" | "on_track" | "above_target";
    fyWorkingDaysComparison: {
      totalWeekdaysInFY: number;
      yourWorkingDays: number;
      frenchEmployeeWorkingDays: number;
      leavesTaken: number;
      holidaysTaken: number;
      extraWorkingDays: number;
    };
  };
  monthlyData: {
    month: string;
    working: number;
    leaves: number;
    extraWorking: number;
    halfDays: number;
  }[];
  financialYear?: string;
}

interface BalanceDetail {
  icon: "plus" | "minus";
  value: number;
  color: string;
}

interface DaysOffProgress {
  current: number;
  burnoutThreshold: number;
  expected: number;
  target: number;
  status: "burnout_risk" | "on_track" | "above_target";
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function DaysOffProgressBar({ progress }: { progress: DaysOffProgress }) {
  const maxValue = Math.max(1, progress.target * 1.2, progress.expected * 1.1, progress.current * 1.1);
  const toPercent = (value: number) => clamp((value / maxValue) * 100, 0, 100);

  const burnoutPercent = toPercent(progress.burnoutThreshold);
  const expectedPercent = toPercent(progress.expected);
  const targetPercent = toPercent(progress.target);
  const currentPercent = clamp(toPercent(progress.current), 1, 99);
  const expectedMarkerPercent = clamp(expectedPercent, 1, 99);

  const statusTone = {
    burnout_risk: {
      markerLine: "border-red-700",
      markerDot: "bg-red-500",
    },
    on_track: {
      markerLine: "border-emerald-700",
      markerDot: "bg-emerald-500",
    },
    above_target: {
      markerLine: "border-amber-700",
      markerDot: "bg-amber-500",
    },
  } as const;
  const markerTone = statusTone[progress.status];

  return (
    <div className="mt-2.5">
      <div className="relative h-3 overflow-hidden rounded-full bg-slate-200/90">
        <div className="absolute inset-y-0 left-0 bg-red-400/85" style={{ width: `${burnoutPercent}%` }} />
        <div
          className="absolute inset-y-0 bg-emerald-400/85"
          style={{ left: `${burnoutPercent}%`, width: `${Math.max(expectedPercent - burnoutPercent, 0)}%` }}
        />
        <div
          className="absolute inset-y-0 bg-amber-400/85"
          style={{ left: `${expectedPercent}%`, width: `${Math.max(targetPercent - expectedPercent, 0)}%` }}
        />
        <div
          className="absolute inset-y-0 bg-rose-300/75"
          style={{ left: `${targetPercent}%`, width: `${Math.max(100 - targetPercent, 0)}%` }}
        />
        <div
          className="absolute inset-y-[-2px] w-0 -translate-x-1/2 border-l-2 border-dashed border-amber-800/80"
          style={{ left: `${expectedMarkerPercent}%` }}
          title={`Expected by month end: ${formatNumber(progress.expected)}`}
          aria-hidden="true"
        />
        <div
          className={cn("absolute inset-y-[-4px] w-0 -translate-x-1/2 border-l-2", markerTone.markerLine)}
          style={{ left: `${currentPercent}%` }}
          title={`Current days off: ${formatNumber(progress.current)}`}
          aria-hidden="true"
        />
        <span
          className={cn("absolute left-0 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white", markerTone.markerDot)}
          style={{ left: `${currentPercent}%` }}
          aria-hidden="true"
        />
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-red-400" aria-hidden="true" />
          Risk &lt; {formatNumber(progress.burnoutThreshold)}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden="true" />
          Healthy zone
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-amber-400" aria-hidden="true" />
          Ahead of pace
        </span>
      </div>
      <div className="mt-1 flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-[11px] text-muted-foreground tabular-nums">
        <span>You: {formatNumber(progress.current)}</span>
        <span>Expected: {formatNumber(progress.expected)}</span>
        <span>Target: {formatNumber(progress.target)}</span>
      </div>
    </div>
  );
}

function BalanceCard({
  label,
  value,
  colorClass,
  showValue = true,
  showSign = true,
  statusLabel,
  statusClass,
  helperText,
  emoji,
  emojiClassName,
  details,
  daysOffProgress,
  plainDetails,
}: {
  label: string;
  value: number;
  colorClass: string;
  showValue?: boolean;
  showSign?: boolean;
  statusLabel?: string;
  statusClass?: string;
  helperText?: string;
  emoji?: string;
  emojiClassName?: string;
  details?: BalanceDetail[];
  daysOffProgress?: DaysOffProgress;
  plainDetails?: { label: string; value: number }[];
}) {
  const formattedValue = formatNumber(value);

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          {emoji && (
            <span
              className={cn("text-lg leading-none select-none", emojiClassName)}
              aria-hidden="true"
              title={statusLabel ?? label}
            >
              {emoji}
            </span>
          )}
        </div>
        {showValue && (
          <p className={cn("text-2xl font-semibold tabular-nums mt-1.5", colorClass)}>
            {showSign && value >= 0 ? `+${formattedValue}` : formattedValue}
          </p>
        )}
        {statusLabel && (
          <p className={cn(showValue ? "mt-1.5" : "mt-2", "text-xs font-medium uppercase tracking-wide", statusClass)}>
            {statusLabel}
          </p>
        )}
        {helperText && (
          <p className="mt-1 text-xs text-muted-foreground">
            {helperText}
          </p>
        )}
        {daysOffProgress && <DaysOffProgressBar progress={daysOffProgress} />}
        {plainDetails && plainDetails.length > 0 && (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground tabular-nums">
            {plainDetails.map((item) => (
              <span key={item.label}>
                {item.label}: {formatNumber(item.value)}
              </span>
            ))}
          </div>
        )}
        {details && details.length > 0 && (
          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground justify-end">
            {details.map((d, i) => (
              <span key={i} className="flex items-center gap-1">
                {d.icon === "plus" ? (
                  <Plus className={cn("h-3 w-3", d.color)} />
                ) : (
                  <Minus className={cn("h-3 w-3", d.color)} />
                )}
                {formatNumber(d.value)}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface CumulativeEntry {
  month: string;
  cumWorking: number;
  cumExtra: number;
  cumLeaves: number;
  cumHalfDays: number;
  mWorking: number;
  mExtra: number;
  mLeaves: number;
  pace: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CumulativeTooltip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as CumulativeEntry;

  return (
    <div className="rounded-xl border border-black/[0.06] bg-white px-3 py-2.5 shadow-lg shadow-black/[0.08] dark:bg-gray-900 dark:border-white/10">
      <p className="mb-1.5 text-sm font-semibold text-gray-900 dark:text-gray-100">{label}</p>
      <div className="space-y-0.5 text-xs">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-indigo-500" />
          <span className="text-gray-600 dark:text-gray-400">Working</span>
          <span className="ml-auto font-medium tabular-nums">+{d.mWorking}</span>
          <span className="text-gray-400 tabular-nums">({d.cumWorking})</span>
        </div>
        {d.cumExtra > 0 && (
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-gray-600 dark:text-gray-400">Extra</span>
            <span className="ml-auto font-medium tabular-nums">{d.mExtra > 0 ? `+${d.mExtra}` : "—"}</span>
            <span className="text-gray-400 tabular-nums">({d.cumExtra})</span>
          </div>
        )}
        {d.cumLeaves > 0 && (
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-rose-400" />
            <span className="text-gray-600 dark:text-gray-400">Leaves</span>
            <span className="ml-auto font-medium tabular-nums">{d.mLeaves > 0 ? `+${d.mLeaves}` : "—"}</span>
            <span className="text-gray-400 tabular-nums">({d.cumLeaves})</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function BalanceOverview({ balanceData, monthlyData, financialYear }: BalanceOverviewProps) {
  const hasData = monthlyData.length > 0;
  const daysOffStatusMeta = {
    burnout_risk: {
      label: "Burnout Risk",
      colorClass: "text-red-600",
      emoji: "🥵",
      emojiClassName: "motion-safe:animate-bounce",
    },
    on_track: {
      label: "On Track",
      colorClass: "text-green-600",
      emoji: "🙂",
      emojiClassName: "motion-safe:animate-pulse",
    },
    above_target: {
      label: "Above Target",
      colorClass: "text-amber-600",
      emoji: "😌",
      emojiClassName: "motion-safe:animate-pulse",
    },
  } as const;
  const daysOffMeta = daysOffStatusMeta[balanceData.daysOffStatus];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        <BalanceCard
          label="Leave Balance"
          value={balanceData.leaveBalance}
          colorClass={balanceData.leaveBalance >= 0 ? "text-green-600" : "text-red-600"}
          details={[
            { icon: "plus", value: balanceData.leavesAllowed, color: "text-green-500" },
            { icon: "minus", value: balanceData.leavesTaken, color: "text-red-500" },
          ]}
        />
        <BalanceCard
          label="Extra Working Days"
          value={balanceData.totalExtraWorking}
          colorClass="text-purple-600"
        />
        <BalanceCard
          label="Extra Balance"
          value={balanceData.extraBalance}
          colorClass={balanceData.extraBalance >= 0 ? "text-green-600" : "text-red-600"}
          details={[
            { icon: "plus", value: balanceData.leavesAllowed, color: "text-green-500" },
            { icon: "plus", value: balanceData.totalExtraWorking, color: "text-violet-500" },
            { icon: "minus", value: balanceData.leavesTaken, color: "text-red-500" },
          ]}
        />
        <BalanceCard
          label="Total Days Off (FYTD)"
          value={balanceData.totalDaysOffToDate}
          showSign={false}
          colorClass={daysOffMeta.colorClass}
          statusLabel={daysOffMeta.label}
          emoji={daysOffMeta.emoji}
          emojiClassName={daysOffMeta.emojiClassName}
          helperText={`Expected by month end (FY): ${formatNumber(balanceData.expectedDaysOffToDate)} / ${formatNumber(balanceData.annualDaysOffTarget)} · Burnout risk below ${formatNumber(balanceData.burnoutRiskThreshold)}`}
          daysOffProgress={{
            current: balanceData.totalDaysOffToDate,
            burnoutThreshold: balanceData.burnoutRiskThreshold,
            expected: balanceData.expectedDaysOffToDate,
            target: balanceData.annualDaysOffTarget,
            status: balanceData.daysOffStatus,
          }}
          plainDetails={[
            { label: "Leaves", value: balanceData.leavesTakenToDate },
            { label: "Holidays", value: balanceData.publicHolidaysOffToDate },
          ]}
        />
      </div>

      {/* FY Working Days Comparison */}
      {(() => {
        const cmp = balanceData.fyWorkingDaysComparison;
        // yourWorkingDays already excludes leaves (implicit weekdays minus leave entries)
        const effectiveDays = cmp.yourWorkingDays + cmp.extraWorkingDays;
        const frenchPct = (cmp.frenchEmployeeWorkingDays / cmp.totalWeekdaysInFY) * 100;
        const yourPct = Math.min((effectiveDays / cmp.totalWeekdaysInFY) * 100, 100);
        const diff = effectiveDays - cmp.frenchEmployeeWorkingDays;

        return (
          <Card>
            <CardContent className="p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">FY Working Days</p>

              {/* Single bar with French employee marker */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{effectiveDays} effective days</span>
                  <span className={cn("text-xs font-semibold tabular-nums", diff > 0 ? "text-indigo-600" : "text-emerald-600")}>
                    {diff > 0 ? `+${diff}` : diff}
                  </span>
                </div>
                <div className="relative h-7 rounded-full bg-muted overflow-hidden">
                  {/* Net working days = working - leaves (indigo) */}
                  <div
                    className="absolute inset-y-0 left-0 bg-indigo-500 transition-all"
                    style={{ width: `${Math.min(((cmp.yourWorkingDays - cmp.leavesTaken) / cmp.totalWeekdaysInFY) * 100, 100)}%` }}
                  />
                  {/* Extra working days (violet, stacked after net working) */}
                  {cmp.extraWorkingDays > 0 && (
                    <div
                      className="absolute inset-y-0 bg-emerald-500 transition-all"
                      style={{
                        left: `${Math.min(((cmp.yourWorkingDays - cmp.leavesTaken) / cmp.totalWeekdaysInFY) * 100, 100)}%`,
                        width: `${Math.min((cmp.extraWorkingDays / cmp.totalWeekdaysInFY) * 100, 100 - Math.min(((cmp.yourWorkingDays - cmp.leavesTaken) / cmp.totalWeekdaysInFY) * 100, 100))}%`,
                      }}
                    />
                  )}
                  {/* French employee marker — black vertical line at 210 */}
                  <div
                    className="absolute inset-y-[-4px] w-0.5 bg-foreground z-10"
                    style={{ left: `${frenchPct}%` }}
                    title={`French employee avg: ${cmp.frenchEmployeeWorkingDays} days`}
                  />
                  <span
                    className="absolute text-[9px] font-semibold text-foreground z-10"
                    style={{ left: `${frenchPct}%`, top: "-14px", transform: "translateX(-50%)" }}
                  >
                    {cmp.frenchEmployeeWorkingDays}
                  </span>
                </div>
              </div>

              {/* Breakdown */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground tabular-nums">
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-indigo-500" /> Working: {cmp.yourWorkingDays}</span>
                {cmp.extraWorkingDays > 0 && (
                  <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> +Extra: {cmp.extraWorkingDays}</span>
                )}
                {cmp.leavesTaken > 0 && (
                  <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-400" /> −Leaves: {cmp.leavesTaken}</span>
                )}
                <span className="inline-flex items-center gap-1">
                  <span className="h-0.5 w-3 bg-foreground" /> French avg: {cmp.frenchEmployeeWorkingDays}
                </span>
                <span>Total weekdays: {cmp.totalWeekdaysInFY}</span>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      <Card>
        <CardHeader>
          <CardTitle>Monthly Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {hasData ? (() => {
            const cmp = balanceData.fyWorkingDaysComparison;
            const totalWeekdays = cmp.totalWeekdaysInFY;
            const frenchAvg = cmp.frenchEmployeeWorkingDays;

            // Build cumulative data with monthly values for tooltip
            let cumW = 0, cumE = 0, cumL = 0, cumH = 0;
            const cumulativeData: CumulativeEntry[] = monthlyData.map((m, idx) => {
              const mW = m.working + m.halfDays * 0.5;
              const mE = m.extraWorking;
              const mL = m.leaves + m.halfDays * 0.5;
              cumW += mW;
              cumE += mE;
              cumL += mL;
              cumH += m.halfDays;
              // Pace: even distribution across months
              const pace = Math.round((totalWeekdays / monthlyData.length) * (idx + 1));
              return { month: m.month, cumWorking: cumW, cumExtra: cumE, cumLeaves: cumL, cumHalfDays: cumH, mWorking: mW, mExtra: mE, mLeaves: mL, pace };
            });

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const renderLabel = (color: string) => (props: any) => {
              const { x, y, value } = props;
              if (!value || value === 0) return null;
              return (
                <text x={x} y={y - 10} textAnchor="middle" fontSize={10} fontWeight={600} fill={color}>
                  {value}
                </text>
              );
            };

            return (
              <div className="space-y-4">
                {/* Main chart: Working days area + pace line + reference lines */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Cumulative Working Days</p>
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={cumulativeData} margin={{ top: 20, right: 15, left: 15, bottom: 0 }}>
                      <defs>
                        <linearGradient id="workingGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#9ca3af" }} />
                      <Tooltip content={<CumulativeTooltip />} />

                      {/* French avg reference */}
                      <ReferenceLine y={frenchAvg} stroke="#94a3b8" strokeDasharray="4 4" strokeWidth={1}>
                        <Label value={`French avg: ${frenchAvg}`} position="insideTopLeft" className="fill-muted-foreground" fontSize={9} />
                      </ReferenceLine>

                      {/* Pace line (even distribution) */}
                      <Area type="monotone" dataKey="pace" stroke="#d1d5db" strokeWidth={1} strokeDasharray="3 3" fill="none" dot={false} name="Pace" />

                      {/* Working days filled area */}
                      <Area
                        type="monotone"
                        dataKey="cumWorking"
                        stroke="#6366f1"
                        strokeWidth={2.5}
                        fill="url(#workingGradient)"
                        dot={{ r: 4, fill: "#6366f1", strokeWidth: 0 }}
                        activeDot={{ r: 6, strokeWidth: 2, stroke: "#fff" }}
                        name="Working"
                        label={renderLabel("#6366f1")}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Mini chart: Leaves + Extra */}
                {(cumulativeData[cumulativeData.length - 1]?.cumExtra > 0 || cumulativeData[cumulativeData.length - 1]?.cumLeaves > 0) && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Leaves & Extra Working</p>
                    <ResponsiveContainer width="100%" height={120}>
                      <LineChart data={cumulativeData} margin={{ top: 15, right: 15, left: 15, bottom: 0 }}>
                        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#9ca3af" }} />
                        <Tooltip content={<CumulativeTooltip />} />
                        <Line type="monotone" dataKey="cumExtra" stroke="#10b981" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3, fill: "#10b981" }} name="Extra" label={renderLabel("#10b981")} />
                        <Line type="monotone" dataKey="cumLeaves" stroke="#fb7185" strokeWidth={2} dot={{ r: 3, fill: "#fb7185" }} name="Leaves" label={renderLabel("#fb7185")} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            );
          })() : (
            <div className="flex h-[280px] items-center justify-center text-muted-foreground">
              No data yet. Start tracking days in the Calendar.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
