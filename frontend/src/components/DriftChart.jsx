import React from "react";
import {
  CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import config from "../config";

const CustomDot = (props) => {
  const { cx, cy, stroke, payload } = props;
  const size = 6;
  const h = size * 0.5;
  
  return (
    <g transform={`translate(${cx}, ${cy})`}>
      {/* Isometric Cube (SVG) */}
      <path d={`M0,0 L${size},-${h} L${size},${size-h} L0,${size} Z`} fill={stroke} opacity="0.8" />
      <path d={`M0,0 L-${size},-${h} L-${size},${size-h} L0,${size} Z`} fill={stroke} opacity="0.6" />
      <path d={`M0,0 L${size},-${h} L0,-${2*h} L-${size},-${h} Z`} fill="#FFFFFF" opacity="0.9" />
      <circle r={size * 1.5} fill={stroke} opacity="0.1" />
    </g>
  );
};

export default function DriftChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E8EAED" vertical={false} />
        <XAxis dataKey="batch" stroke="#9AA0A6" fontSize={11} fontFamily="var(--font-mono)" />
        <YAxis domain={[0, 100]} stroke="#9AA0A6" fontSize={11} fontFamily="var(--font-mono)" />
        <Tooltip
          contentStyle={{
            background: "rgba(255, 255, 255, 0.96)",
            border: "1px solid var(--border-light)",
            borderRadius: 12,
            fontFamily: "var(--font-sans)",
            fontSize: 13,
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            backdropFilter: "blur(8px)"
          }}
        />
        <ReferenceLine y={85} stroke="#34A853" strokeDasharray="4 4"
          label={{ value: "CERTIFIED ≥ 85", fill: "#34A853", fontSize: 10, position: "right", fontFamily: "var(--font-mono)", fontWeight: 700 }} />
        <ReferenceLine y={70} stroke="#F9AB00" strokeDasharray="4 4"
          label={{ value: "WARNING < 70", fill: "#B06000", fontSize: 10, position: "right", fontFamily: "var(--font-mono)", fontWeight: 700 }} />
        <Line
          type="monotone"
          dataKey="score"
          stroke={config.COLORS.blue}
          strokeWidth={3}
          dot={<CustomDot />}
          activeDot={{ r: 8, strokeWidth: 0, fill: config.COLORS.blue }}
          isAnimationActive
          animationDuration={1500}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
