import React from 'react';
import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Line } from 'recharts';

const DifficultyChart = ({ data }) => {
  return (
    <div className="chart-container glass" style={{ marginBottom: '2rem' }}>
      <h3>全关卡难度梯度预测 (Total Budget Curve)</h3>
      <div style={{ height: '300px', marginTop: '1rem' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis dataKey="level" label={{ value: '层数 (Level)', position: 'insideBottom', offset: -5 }} stroke="var(--text-muted)" />
            <YAxis stroke="var(--text-muted)" />
            <Tooltip
              contentStyle={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
              itemStyle={{ color: 'var(--accent-primary)' }}
            />
            <Line type="monotone" dataKey="budget" stroke="var(--accent-primary)" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 8 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default DifficultyChart;
