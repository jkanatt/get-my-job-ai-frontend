'use client';

import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer, FunnelChart, Funnel, LabelList, Cell } from 'recharts';

const CustomAreaTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const dateStr = payload[0].payload.fullLabel || new Date(label).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    return (
      <div className="bg-[var(--bg-elevated)] border border-[var(--border-strong)] rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4 min-w-[160px] relative z-50">
        <div className="flex flex-col gap-1.5 mb-3 pb-3 border-b border-[var(--border-subtle)]">
          <span className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--text-muted)]">{dateStr}</span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-none bg-[var(--c-primary)]" />
            <span className="text-[12px] font-bold text-[var(--text-primary)]/80 tracking-wide uppercase">Activity</span>
          </div>
          <span className="text-[14px] font-black text-[var(--text-primary)]">{payload[0].value}</span>
        </div>
      </div>
    );
  }
  return null;
};

import PropTypes from 'prop-types';

export function ApplicationActivityChart({ data }) {
  if (!Array.isArray(data) || data.length === 0) return null;
  
  return (
    <div className="w-full h-full min-h-[120px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--c-primary)" stopOpacity={0.4}/>
              <stop offset="95%" stopColor="var(--c-primary)" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <XAxis 
            dataKey="label" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 11, fill: 'var(--text-muted)', fontWeight: 500 }} 
            dy={10}
          />
          <Tooltip 
            content={<CustomAreaTooltip />}
            cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1, strokeDasharray: '3 3' }}
          />
          <Area type="monotone" dataKey="count" stroke="var(--c-primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" activeDot={{ r: 6, fill: 'var(--c-primary)', stroke: 'var(--bg-surface)', strokeWidth: 2 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

const FUNNEL_COLORS = ['#6366F1', '#3B82F6', '#10B981', '#F59E0B'];

const CustomFunnelTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const color = payload[0].fill || FUNNEL_COLORS[0];
    return (
      <div className="bg-[var(--bg-elevated)] border border-[var(--border-strong)] rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4 min-w-[160px] relative z-50">
        <div className="flex flex-col gap-1.5 mb-3 pb-3 border-b border-[var(--border-subtle)]">
          <span className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--text-muted)]">{data.name}</span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-none" style={{ backgroundColor: color }} />
            <span className="text-[12px] font-bold text-[var(--text-primary)]/80 tracking-wide uppercase">Count</span>
          </div>
          <span className="text-[14px] font-black text-[var(--text-primary)]">{payload[0].value}</span>
        </div>
      </div>
    );
  }
  return null;
};

export function PipelineFunnelChart({ data }) {
  if (!Array.isArray(data) || data.length === 0) return null;
  
  return (
    <div className="w-full h-[250px]">
      <ResponsiveContainer width="100%" height="100%">
        <FunnelChart>
          <Tooltip content={<CustomFunnelTooltip />} />
          <Funnel
            dataKey="value"
            data={data}
            isAnimationActive
          >
            <LabelList position="right" fill="var(--text-primary)" stroke="none" dataKey="name" fontSize={12} fontWeight={500} />
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={FUNNEL_COLORS[index % FUNNEL_COLORS.length]} stroke="var(--bg-surface)" strokeWidth={2} />
            ))}
          </Funnel>
        </FunnelChart>
      </ResponsiveContainer>
    </div>
  );
}

ApplicationActivityChart.propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.shape({
      day: PropTypes.string.isRequired,
      count: PropTypes.number.isRequired,
    })
  )
};

PipelineFunnelChart.propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
      value: PropTypes.number.isRequired,
    })
  )
};
