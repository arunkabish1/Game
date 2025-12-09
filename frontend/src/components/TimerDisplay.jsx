import React, { useEffect, useState } from "react";

export default function TimerDisplay({ startTs, big }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  if (!startTs)
    return <div className={big ? "text-2xl font-bold" : ""}>--:--</div>;

  const diff = Math.max(0, now - startTs);
  const s = Math.floor(diff / 1000) % 60;
  const m = Math.floor(diff / 60000) % 60;
  const h = Math.floor(diff / 3600000);

  const pad = (v) => String(v).padStart(2, "0");

  return (
    <div className={big ? "text-2xl font-extrabold" : ""}>
      ⏱ {pad(h)}:{pad(m)}:{pad(s)}
    </div>
  );
}
