"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  createBudgetItem,
  updateBudgetItem,
  deleteBudgetItem,
} from "@/actions/budget";
import type { BudgetCategory, BudgetItem } from "@/lib/types";

const TARGET: Record<BudgetCategory, number> = { expense: 30, savings: 20, investment: 50 };
const COLORS: Record<BudgetCategory, string> = { expense: "#ff6b6b", savings: "#ffd166", investment: "#4ecdc4" };
const LABELS: Record<BudgetCategory, string> = { expense: "Expenses", savings: "Savings", investment: "Investments" };
const CATS: BudgetCategory[] = ["expense", "savings", "investment"];

type View = "monthly" | "annual";

interface BudgetClientProps {
  initialItems: BudgetItem[];
  monthlyIncome: number;
  invoiceCount: number;
}

export function BudgetClient({ initialItems, monthlyIncome, invoiceCount }: BudgetClientProps) {
  const [items, setItems] = useState<BudgetItem[]>(initialItems);
  const [view, setView] = useState<View>("monthly");
  const [newName, setNewName] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newCat, setNewCat] = useState<BudgetCategory>("expense");

  const income = Math.max(monthlyIncome, 1);

  function scaled(n: number) {
    return view === "annual" ? n * 12 : n;
  }
  function fmt(n: number) {
    const v = scaled(n);
    if (v >= 100000) return "₹" + (v / 100000).toFixed(2) + "L";
    if (v >= 1000) return "₹" + Math.round(v / 1000) + "k";
    return "₹" + Math.round(v);
  }

  const totals = useMemo(() => {
    const t: Record<BudgetCategory, number> = { expense: 0, savings: 0, investment: 0 };
    items.forEach((i) => { t[i.category] += Number(i.amount) || 0; });
    return t;
  }, [items]);

  const totalAlloc = totals.expense + totals.savings + totals.investment;
  const unalloc = Math.max(income - totalAlloc, 0);
  const allocPct = (totalAlloc / income) * 100;

  // Donut geometry
  const R = 90;
  const C = 2 * Math.PI * R;
  const slices: { cat: BudgetCategory; dash: number; offset: number }[] = [];
  {
    let offset = 0;
    for (const cat of CATS) {
      const val = totals[cat];
      if (val <= 0) continue;
      const dash = (val / income) * C;
      slices.push({ cat, dash, offset });
      offset += dash;
    }
  }

  async function handleAdd() {
    const name = newName.trim();
    const amount = Number(newAmount);
    if (!name || !(amount > 0)) return;

    const tempId = -Date.now();
    const optimistic: BudgetItem = { id: tempId, name, amount, category: newCat, sortOrder: 9999 };
    setItems((cur) => [...cur, optimistic]);
    setNewName("");
    setNewAmount("");

    const res = await createBudgetItem({ name, amount, category: newCat });
    if (res.success && res.id) {
      setItems((cur) => cur.map((i) => (i.id === tempId ? { ...i, id: res.id! } : i)));
    } else {
      setItems((cur) => cur.filter((i) => i.id !== tempId));
      toast.error("Failed to add item");
    }
  }

  async function handleCategory(id: number, category: BudgetCategory) {
    const prev = items;
    setItems((cur) => cur.map((i) => (i.id === id ? { ...i, category } : i)));
    const res = await updateBudgetItem(id, { category });
    if (!res.success) { setItems(prev); toast.error("Failed to update"); }
  }

  async function handleDelete(id: number) {
    const prev = items;
    setItems((cur) => cur.filter((i) => i.id !== id));
    const res = await deleteBudgetItem(id);
    if (!res.success) { setItems(prev); toast.error("Failed to remove"); }
  }

  const groupOrder: Record<BudgetCategory, number> = { investment: 0, expense: 1, savings: 2 };
  const sortedItems = [...items].sort((a, b) => {
    const g = groupOrder[a.category] - groupOrder[b.category];
    if (g !== 0) return g;
    return Number(b.amount) - Number(a.amount);
  });

  return (
    <div className="budget-scope">
      <div className="wrap">
        <header>
          <h1>
            Budget Dashboard <span className="tag">30 / 20 / 50 target</span>
          </h1>
          <div className="header-controls">
            <div className="view-toggle">
              {(["monthly", "annual"] as View[]).map((v) => (
                <button key={v} className={view === v ? "active" : ""} onClick={() => setView(v)}>
                  {v === "monthly" ? "Monthly" : "Annual"}
                </button>
              ))}
            </div>
            <div className="income-box">
              <label>{view === "annual" ? "Annual Income" : "Monthly Income"}</label>
              <span className="income-val">{fmt(monthlyIncome)}</span>
              <span className="unit">
                {invoiceCount > 0 ? `avg of ${invoiceCount} invoices` : "no invoices yet"}
              </span>
            </div>
          </div>
        </header>

        <div className="summary-strip">
          {(CATS).map((cat) => (
            <div key={cat} className={`stat ${cat === "expense" ? "expense" : cat === "savings" ? "savings" : "investment"}`}>
              <div className="k">{LABELS[cat]}</div>
              <div className="v">{((totals[cat] / income) * 100).toFixed(1)}%</div>
              <div className="s">{fmt(totals[cat])}</div>
            </div>
          ))}
          <div className="stat unallocated">
            <div className="k">Unallocated</div>
            <div className="v">{((unalloc / income) * 100).toFixed(1)}%</div>
            <div className="s">{fmt(unalloc)}</div>
          </div>
        </div>

        <div className="grid">
          <div className="card">
            <h2>Allocation breakdown</h2>
            <div className="donut-wrap">
              <div className="donut">
                <svg width="240" height="240" viewBox="0 0 240 240">
                  <circle cx="120" cy="120" r="90" fill="none" stroke="#1a1e25" strokeWidth="28" />
                  <g>
                    {slices.map((s) => (
                      <circle
                        key={s.cat}
                        cx="120"
                        cy="120"
                        r={R}
                        fill="none"
                        stroke={COLORS[s.cat]}
                        strokeWidth="28"
                        strokeDasharray={`${s.dash} ${C - s.dash}`}
                        strokeDashoffset={-s.offset}
                        style={{ transition: "stroke-dasharray 0.5s ease, stroke-dashoffset 0.5s ease" }}
                      />
                    ))}
                  </g>
                </svg>
                <div className="center">
                  <div className="label">Allocated</div>
                  <div className="value">{allocPct.toFixed(0)}%</div>
                  <div className="sub">of {fmt(income)}</div>
                </div>
              </div>
              <div className="legend">
                {CATS.map((cat) => (
                  <div key={cat} className="legend-row">
                    <div className="l">
                      <span className="dot" style={{ background: COLORS[cat] }} />
                      <div>
                        <div className="name">{LABELS[cat]}</div>
                        <div className="amt">{fmt(totals[cat])}</div>
                      </div>
                    </div>
                    <div className="pct" style={{ color: COLORS[cat] }}>
                      {((totals[cat] / income) * 100).toFixed(1)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <h2>Actual vs target ratio</h2>
            <div>
              {CATS.map((cat) => {
                const actual = (totals[cat] / income) * 100;
                const target = TARGET[cat];
                const diff = actual - target;
                const maxPct = Math.max(actual, target, 60);
                const fillW = (actual / maxPct) * 100;
                const targetX = (target / maxPct) * 100;
                let deltaClass = "ok";
                let deltaTxt = "on target";
                if (Math.abs(diff) >= 1) {
                  if (cat === "expense") deltaClass = diff > 0 ? "under" : "over";
                  else deltaClass = diff > 0 ? "over" : "under";
                  deltaTxt = (diff > 0 ? "+" : "") + diff.toFixed(1) + "% vs target";
                }
                return (
                  <div key={cat} className="ratio-row">
                    <div className="ratio-label">
                      {LABELS[cat]}
                      <span className="sub">target {target}%</span>
                    </div>
                    <div className="bar">
                      <div className="fill" style={{ background: COLORS[cat], width: `${fillW}%` }} />
                      <div className="target" data-label={`${target}%`} style={{ left: `${targetX}%` }} />
                    </div>
                    <div className="ratio-stats">
                      <div className="actual" style={{ color: COLORS[cat] }}>{actual.toFixed(1)}%</div>
                      <div className={`delta ${deltaClass}`}>{deltaTxt}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="card items-card">
          <h2>Your items</h2>
          <div className="item-form">
            <input
              type="text"
              placeholder="Item name (e.g., Rent)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
            />
            <input
              type="number"
              placeholder="Amount (₹)"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
            />
            <select value={newCat} onChange={(e) => setNewCat(e.target.value as BudgetCategory)}>
              <option value="expense">Expense</option>
              <option value="savings">Savings</option>
              <option value="investment">Investment</option>
            </select>
            <button onClick={handleAdd}>Add item</button>
          </div>
          <div className="items-list">
            {sortedItems.length === 0 ? (
              <div className="empty">No items yet. Add one above.</div>
            ) : (
              sortedItems.map((item) => (
                <div key={item.id} className="item">
                  <span className="swatch" style={{ background: COLORS[item.category] }} />
                  <span className="name">{item.name}</span>
                  <span className="amount">
                    <b>{fmt(item.amount)}</b> · {((item.amount / income) * 100).toFixed(1)}%
                  </span>
                  <select
                    value={item.category}
                    onChange={(e) => handleCategory(item.id, e.target.value as BudgetCategory)}
                  >
                    <option value="expense">Expense</option>
                    <option value="savings">Savings</option>
                    <option value="investment">Investment</option>
                  </select>
                  <button className="del" onClick={() => handleDelete(item.id)}>Remove</button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
