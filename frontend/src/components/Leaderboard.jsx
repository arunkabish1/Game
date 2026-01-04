import React from "react";

function formatTime(ms) {
  if (!ms) return "0s";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}m ${sec}s`;
}

export default function Leaderboard({ data = [], selectedTeamId }) {
  const top = data.slice(0, 3);

  return (
    <div className="flex flex-col">

      <h2 className="text-xl font-semibold mb-4 text-center md:text-left">
        Leaderboard
      </h2>

      {/* Podium */}
      <div className="flex items-end justify-center gap-2 sm:gap-3 mb-6 text-center">
        
        <div className="flex flex-col items-center">
          <div className="bg-slate-700 w-14 h-14 sm:w-20 sm:h-20 rounded flex items-end justify-center pb-2">
            {top[1] ? top[1].name.split(" ")[1] : "2"}
          </div>
          <div className="text-xs sm:text-sm text-slate-400">2nd</div>
        </div>

        <div className="flex flex-col items-center">
          <div className="bg-yellow-400 text-black font-bold w-20 h-24 sm:w-28 sm:h-32 rounded flex items-end justify-center pb-2">
            {top[0] ? top[0].name.split(" ")[1] : "1"}
          </div>
          <div className="text-xs sm:text-sm text-slate-400">1st</div>
        </div>

        <div className="flex flex-col items-center">
          <div className="bg-slate-700 w-14 h-12 sm:w-20 sm:h-16 rounded flex items-end justify-center pb-2">
            {top[2] ? top[2].name.split(" ")[1] : "3"}
          </div>
          <div className="text-xs sm:text-sm text-slate-400">3rd</div>
        </div>

      </div>

      {/* Full List */}
      <ol className="list-decimal pl-5">
        {data.map((t) => {
          // If progress > 10, game is completed (10 levels done)
          // Otherwise, levelsCompleted = progress - 1 (e.g., progress 5 means 4 levels completed)
          const levelsCompleted = t.progress > 10 ? 10 : Math.max(0, (t.progress || 1) - 1);
          const isGameCompleted = t.progress > 10;
          const isSelected = t.id === selectedTeamId;

          return (
            <li
              key={t.id}
              className={`mb-3 rounded ${
                isSelected ? "bg-slate-800 p-2 border border-slate-700" : ""
              }`}
            >
              <div className="flex justify-between items-start">

                <div>
                  <strong className="text-base">{t.name}</strong>

                  <div className={`text-xs ${isGameCompleted ? 'text-yellow-400 font-semibold' : 'text-slate-400'}`}>
                    {isGameCompleted ? '✅ Completed: Lvl 10' : `Lvl: ${levelsCompleted}`}
                  </div>

                  <div className="text-xs text-slate-500">
                    {Object.entries(t.level_times || {}).map(([lvl, ms]) => (
                      <div key={lvl}>
                        <span className="font-medium">L{lvl}:</span>{" "}
                        {Math.round(ms / 1000)}s
                      </div>
                    ))}
                  </div>
                </div>

                <div className="text-sm text-slate-400">
                  {formatTime(t.total_time_ms)}
                </div>

              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
