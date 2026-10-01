import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CHART_COLORS, QUESTION_TYPE_LABELS, RATING_LABELS } from '../services/constants.js';

const axisStyle = { fontSize: 11 };

const tooltipStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--text)',
  fontSize: 12,
};

// Chart colours must be literal values: SVG attributes cannot resolve CSS vars
const PRIMARY = '#4f46e5';
const WARNING = '#f59e0b';

function NoData({ children = 'No data yet.' }) {
  return (
    <p className="muted small" style={{ textAlign: 'center', padding: '2rem 0' }}>
      {children}
    </p>
  );
}

/** Daily response counts over the last 30 days. */
export function ResponseTrendChart({ trend }) {
  const data = useMemo(
    () =>
      (trend ?? []).map((row) => ({
        date: row.date?.slice(5) ?? row.date,
        responses: row.count,
      })),
    [trend],
  );

  if (!data.length) return <NoData>No responses in the last 30 days.</NoData>;

  return (
    <div className="chart-box">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
          <defs>
            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={PRIMARY} stopOpacity={0.35} />
              <stop offset="100%" stopColor={PRIMARY} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e5ec" vertical={false} />
          <XAxis
            dataKey="date"
            tick={axisStyle}
            tickLine={false}
            axisLine={false}
            minTickGap={16}
          />
          <YAxis allowDecimals={false} tick={axisStyle} tickLine={false} axisLine={false} width={44} />
          <Tooltip contentStyle={tooltipStyle} />
          <Area
            type="monotone"
            dataKey="responses"
            stroke={PRIMARY}
            strokeWidth={2}
            fill="url(#trendFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Option distribution for choice questions. Horizontal bars keep long option
 * labels readable, which vertical bars do not.
 */
export function BreakdownBarChart({ breakdown, color = PRIMARY, withRatingLabels = false }) {
  const data = useMemo(() => {
    const rows = breakdown ?? [];
    const max = Math.max(...rows.map((r) => r.count), 1);
    return rows.map((row) => ({
      name: row.label,
      count: row.count,
      percent: Math.round((row.count / max) * 100),
      display: withRatingLabels
        ? `${row.label} · ${RATING_LABELS[row.label] ?? ''}`
        : row.label,
    }));
  }, [breakdown, withRatingLabels]);

  if (!data.length) return <NoData>No answers yet.</NoData>;

  return (
    <div className="chart-box" style={{ height: Math.max(160, data.length * 52 + 40) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 28, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e5ec" horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={axisStyle} tickLine={false} axisLine={false} />
          <YAxis
            type="category"
            dataKey="display"
            width={150}
            tick={{ ...axisStyle, fill: '#626877' }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(79,70,229,0.06)' }} />
          <Bar dataKey="count" fill={color} radius={[0, 6, 6, 0]} barSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Rating distribution. */
export function RatingChart({ breakdown, average }) {
  if (!breakdown?.length) return <NoData>No ratings yet.</NoData>;

  return (
    <>
      <BreakdownBarChart breakdown={breakdown} color={WARNING} withRatingLabels />
      {average != null && (
        <p className="muted small" style={{ textAlign: 'center' }}>
          Average rating: <strong>{average}</strong> / 5
        </p>
      )}
    </>
  );
}

/** Survey counts per category. */
export function CategoryChart({ byCategory }) {
  const data = useMemo(
    () => (byCategory ?? []).map((row) => ({ name: row.category, count: row.count })),
    [byCategory],
  );

  if (!data.length) return <NoData>No surveys yet.</NoData>;

  return (
    <div className="chart-box">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e5ec" vertical={false} />
          <XAxis dataKey="name" tick={{ ...axisStyle, fill: '#626877' }} tickLine={false} axisLine={false} />
          <YAxis allowDecimals={false} tick={axisStyle} tickLine={false} axisLine={false} width={44} />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="count" fill={PRIMARY} radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Doughnut of survey statuses. */
export function StatusDonut({ draft, published, closed }) {
  const data = [
    { name: 'Live', value: published },
    { name: 'Draft', value: draft },
    { name: 'Closed', value: closed },
  ].filter((d) => d.value > 0);

  if (!data.length) return <NoData>No surveys yet.</NoData>;

  return (
    <div className="chart-box">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="80%" paddingAngle={3}>
            {data.map((entry, i) => (
              <Cell key={entry.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
          <Legend
            verticalAlign="bottom"
            formatter={(v) => <span style={{ color: '#626877', fontSize: 12 }}>{v}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Free-text answers read better as a ranked list than a chart. */
export function TextBreakdown({ breakdown, questionType }) {
  if (!breakdown?.length) return <NoData>No answers yet.</NoData>;

  return (
    <>
      <ul className="breakdown-list">
        {breakdown.map((row) => (
          <li key={row.label}>
            <span>{row.label}</span>
            <strong>{row.count}</strong>
          </li>
        ))}
      </ul>
      <p className="muted small" style={{ marginTop: '0.5rem' }}>
        Most common answers to this {QUESTION_TYPE_LABELS[questionType]?.toLowerCase() ?? 'question'}.
      </p>
    </>
  );
}