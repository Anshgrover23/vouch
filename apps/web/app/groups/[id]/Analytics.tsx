"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { filterBuckets, nameKey, type AnalyticsRange } from "@/lib/ledger";
import { useGroup, useGroupMoney } from "./Group";
import styles from "../groups.module.css";

const INK = "var(--color-ink)";
const LIME = "var(--color-lime)";
const SHARE = "var(--color-ink-2)";

const TICK = {
  fill: INK,
  fontFamily: "var(--font-display)",
  fontSize: 11,
  fontWeight: 800,
} as const;

const AXIS = { stroke: INK, strokeWidth: 2 } as const;

const RANGES: Array<{ id: AnalyticsRange; label: string }> = [
  { id: "all", label: "All" },
  { id: "3m", label: "3 months" },
  { id: "month", label: "This month" },
];

function usePrefersReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(media.matches);
    const onChange = () => setReduce(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  return reduce;
}

type TipRow = { name?: string; value?: number; color?: string; dataKey?: string | number };

function ChartTip({
  active,
  label,
  payload,
  money,
}: {
  active?: boolean;
  label?: string | number;
  payload?: TipRow[];
  money: (value: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className={styles.chartTip}>
      {label != null && label !== "" ? <strong>{String(label)}</strong> : null}
      {payload.map((row) => (
        <p key={String(row.dataKey ?? row.name)}>
          <i style={{ background: row.color }} />
          {row.name} {money(Number(row.value ?? 0))}
        </p>
      ))}
    </div>
  );
}

function shortLabel(value: string, max = 16) {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

function AnalyticsHero() {
  const {
    state: { analytics },
  } = useGroup();
  const { money } = useGroupMoney();
  return (
    <dl className={styles.totals}>
      <div>
        <dt>Group spending</dt>
        <dd data-testid="totals-spending">{money(analytics.totals.groupSpending)}</dd>
      </div>
      <div>
        <dt>You paid</dt>
        <dd data-testid="totals-you-paid">{money(analytics.totals.youPaid)}</dd>
      </div>
      <div>
        <dt>Your share</dt>
        <dd data-testid="totals-your-share">{money(analytics.totals.yourShare)}</dd>
      </div>
    </dl>
  );
}

function AnalyticsRange({ value, onChange }: { value: AnalyticsRange; onChange: (next: AnalyticsRange) => void }) {
  return (
    <div className={styles.range} role="tablist" aria-label="Time range">
      {RANGES.map((range) => (
        <button
          key={range.id}
          type="button"
          role="tab"
          aria-selected={value === range.id}
          className={value === range.id ? `${styles.rangeChip} ${styles.rangeChipActive}` : styles.rangeChip}
          data-testid={`analytics-range-${range.id}`}
          onClick={() => onChange(range.id)}
        >
          {range.label}
        </button>
      ))}
    </div>
  );
}

function AnalyticsTrend({ range }: { range: AnalyticsRange }) {
  const {
    state: { analytics },
  } = useGroup();
  const { money } = useGroupMoney();
  const reduce = usePrefersReducedMotion();
  const buckets = filterBuckets(analytics.buckets, range);
  const crowded = buckets.length > 6;
  const data = buckets.map((row) => ({ ...row, Spend: row.spending }));

  return (
    <section className={styles.chartCard} data-testid="analytics-trend">
      <h2>Spend over time</h2>
      {buckets.length === 0 ? (
        <p className={styles.emptyCopy}>No spend in this stretch.</p>
      ) : (
        <div className={styles.chartPlot} role="img" aria-label="Spending by period">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: crowded ? 8 : 0 }}>
              <CartesianGrid vertical={false} stroke={INK} strokeOpacity={0.12} />
              <XAxis
                dataKey="label"
                tick={TICK}
                axisLine={AXIS}
                tickLine={AXIS}
                minTickGap={32}
                interval={crowded ? "equidistantPreserveStart" : 0}
                angle={crowded ? -32 : 0}
                textAnchor={crowded ? "end" : "middle"}
                height={crowded ? 52 : 28}
              />
              <YAxis
                tick={TICK}
                tickFormatter={(value: number) => money(value)}
                axisLine={AXIS}
                tickLine={AXIS}
                width={64}
              />
              <Tooltip
                cursor={{ fill: LIME, fillOpacity: 0.22 }}
                content={<ChartTip money={money} />}
              />
              <Bar
                dataKey="Spend"
                fill={LIME}
                stroke={INK}
                strokeWidth={2}
                maxBarSize={48}
                isAnimationActive={!reduce}
                radius={0}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

function AnalyticsPeople() {
  const {
    state: { analytics },
  } = useGroup();
  const { money } = useGroupMoney();
  const reduce = usePrefersReducedMotion();
  const height = Math.max(180, analytics.people.length * 68 + 48);

  return (
    <section className={styles.chartCard} data-testid="analytics-people">
      <h2>Who paid vs share</h2>
      {analytics.people.length === 0 ? (
        <p className={styles.emptyCopy}>Nobody paid or claimed yet.</p>
      ) : (
        <div className={styles.chartPlot} style={{ height }} role="img" aria-label="Paid versus share">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              layout="vertical"
              data={analytics.people.map((row) => ({
                ...row,
                Paid: row.paid,
                Share: row.share,
                id: nameKey(row.name),
              }))}
              margin={{ top: 4, right: 12, left: 4, bottom: 4 }}
            >
              <CartesianGrid horizontal={false} stroke={INK} strokeOpacity={0.12} />
              <XAxis type="number" tick={TICK} tickFormatter={(value: number) => money(value)} axisLine={AXIS} tickLine={AXIS} />
              <YAxis type="category" dataKey="name" tick={TICK} axisLine={AXIS} tickLine={AXIS} width={72} />
              <Tooltip cursor={{ fill: LIME, fillOpacity: 0.18 }} content={<ChartTip money={money} />} />
              <Legend
                iconType="square"
                iconSize={10}
                wrapperStyle={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 800,
                  fontSize: 11,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: INK,
                }}
              />
              <Bar dataKey="Paid" fill={LIME} stroke={INK} strokeWidth={2} maxBarSize={18} isAnimationActive={!reduce} radius={0} />
              <Bar dataKey="Share" fill={SHARE} stroke={INK} strokeWidth={2} maxBarSize={18} isAnimationActive={!reduce} radius={0} />
            </BarChart>
          </ResponsiveContainer>
          {analytics.people.map((row) => (
            <span key={row.name} hidden data-testid={`analytics-person-${nameKey(row.name)}`} />
          ))}
        </div>
      )}
    </section>
  );
}

function AnalyticsMerchants() {
  const {
    state: { analytics },
  } = useGroup();
  const { money } = useGroupMoney();
  const reduce = usePrefersReducedMotion();
  const height = Math.max(160, analytics.merchants.length * 48 + 24);

  return (
    <section className={styles.chartCard} data-testid="analytics-merchants">
      <h2>Top merchants</h2>
      {analytics.merchants.length === 0 ? (
        <p className={styles.emptyCopy}>No merchants yet.</p>
      ) : (
        <div className={styles.chartPlot} style={{ height }} role="img" aria-label="Spending by merchant">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              layout="vertical"
              data={analytics.merchants.map((row) => ({ ...row, Spend: row.spending }))}
              margin={{ top: 4, right: 12, left: 4, bottom: 4 }}
            >
              <CartesianGrid horizontal={false} stroke={INK} strokeOpacity={0.12} />
              <XAxis type="number" tick={TICK} tickFormatter={(value: number) => money(value)} axisLine={AXIS} tickLine={AXIS} />
              <YAxis
                type="category"
                dataKey="name"
                tick={TICK}
                tickFormatter={(value: string) => shortLabel(value)}
                axisLine={AXIS}
                tickLine={AXIS}
                width={108}
              />
              <Tooltip cursor={{ fill: LIME, fillOpacity: 0.18 }} content={<ChartTip money={money} />} />
              <Bar dataKey="Spend" fill={LIME} stroke={INK} strokeWidth={2} maxBarSize={22} isAnimationActive={!reduce} radius={0} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

export function GroupAnalytics() {
  const {
    state: { receipts },
  } = useGroup();
  const [range, setRange] = useState<AnalyticsRange>("all");

  if (receipts.length === 0) {
    return (
      <section className={styles.panel} data-testid="group-analytics">
        <p className={styles.emptyCopy}>No receipts in this group yet. Snap or type one.</p>
      </section>
    );
  }

  return (
    <section className={styles.panel} data-testid="group-analytics">
      <Analytics.Hero />
      <Analytics.Range value={range} onChange={setRange} />
      <Analytics.Trend range={range} />
      <div className={styles.analyticsSplit}>
        <Analytics.People />
        <Analytics.Merchants />
      </div>
      <p className={styles.hint}>Group spending excludes settlements.</p>
    </section>
  );
}

export const Analytics = {
  Hero: AnalyticsHero,
  Range: AnalyticsRange,
  Trend: AnalyticsTrend,
  People: AnalyticsPeople,
  Merchants: AnalyticsMerchants,
};
