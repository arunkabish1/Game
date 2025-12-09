import React from "react";

export default function ProgressBarVertical({ percent }) {
  const p = Math.max(0, Math.min(100, Math.round(percent || 0)));

  return (
    <div className="w-10 h-32 sm:w-14 sm:h-40 md:w-20 md:h-64 bg-slate-800 rounded flex items-end p-2">
      <div
        className="w-full bg-emerald-400 rounded transition-all"
        style={{ height: `${p}%` }}
      />
    </div>
  );
}
