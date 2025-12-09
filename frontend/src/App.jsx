import React, { useEffect, useState } from "react";
import Scan from "./components/Scan";
import Leaderboard from "./components/Leaderboard";
import io from "socket.io-client";

const BACKEND = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
const socket = io(BACKEND, { autoConnect: true });

export default function App() {
  const [teamId, setTeamId] = useState("team1");
  const [leaderboard, setLeaderboard] = useState([]);
  const [teamState, setTeamState] = useState(null);
  const [serverStartTs, setServerStartTs] = useState(null);

  useEffect(() => {
    socket.on("connect", () => console.log("socket connected:", socket.id));
    socket.on("disconnect", () => console.log("socket disconnected"));
    socket.on("leaderboard:update", (data) => setLeaderboard(data || []));

    socket.on("team:update", (team) => {
      if (team && team.id === teamId) {
        setTeamState(team);
        if (team.currentLevelStart) setServerStartTs(team.currentLevelStart);
      }
    });

    socket.on("level_started", ({ teamId: tId, startTs }) => {
      if (tId === teamId) setServerStartTs(startTs);
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("leaderboard:update");
      socket.off("team:update");
      socket.off("level_started");
    };
  }, [teamId]);

  useEffect(() => {
    fetch(BACKEND + "/api/leaderboard")
      .then((r) => r.json())
      .then((j) => setLeaderboard(j.leaderboard || []));
  }, []);

  useEffect(() => {
    socket.emit("join", { teamId });

    fetch(`${BACKEND}/api/team/${teamId}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.ok && j.team) {
          setTeamState(j.team);
          if (j.team.currentLevelStart) setServerStartTs(j.team.currentLevelStart);
        }
      });

    fetch(BACKEND + "/api/leaderboard")
      .then((r) => r.json())
      .then((j) => setLeaderboard(j.leaderboard || []));
  }, [teamId]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-white">

      <header className="bg-slate-800 p-3 flex flex-col md:flex-row items-center justify-between gap-3">
        <h1 className="text-xl font-bold tracking-wide">QR Hunt</h1>

        <div className="text-sm flex items-center gap-2">
          <label className="text-slate-300">Team:</label>
          <select
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            className="rounded px-3 py-2 bg-slate-700 border border-slate-600"
          >
            <option value="team1">Team Alpha</option>
            <option value="team2">Team Bravo</option>
            <option value="team3">Team Charlie</option>
            <option value="team4">Team Delta</option>
            <option value="team5">Team Echo</option>
            <option value="team6">Team Foxtrot</option>
          </select>
        </div>
      </header>

      <main className="flex-1 p-3 md:p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <section className="bg-slate-900 rounded-xl p-3 shadow-lg md:col-span-2">
          <Scan teamId={teamId} socket={socket} serverStartTs={serverStartTs} />
        </section>

        <aside className="bg-slate-900 rounded-xl p-3 shadow-lg">
          <Leaderboard data={leaderboard} selectedTeamId={teamId} />
        </aside>
      </main>

      <footer className="p-2 text-center text-xs text-slate-400">
        Installable PWA — Camera Required for QR Scanning
      </footer>

    </div>
  );
}
