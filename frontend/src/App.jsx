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

  // screen = "home" | "scan" | "leaderboard"
  const [screen, setScreen] = useState("home");

  // SOCKET LISTENERS
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

  // Load initial data
  useEffect(() => {
    fetch(BACKEND + "/api/leaderboard")
      .then((r) => r.json())
      .then((j) => setLeaderboard(j.leaderboard || []));
  }, []);

  // Team switch
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

  // -------------------------
  // HOME SCREEN
  // -------------------------
  if (screen === "home") {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center px-4">
        <img src="https://res.cloudinary.com/delx0bz9t/image/upload/v1762703907/events/x4swrcgshquiqgz8rqx0.png" alt="NFA Logo" className="w-32 h-32 mb-4" />

        <h1 className="text-3xl font-bold mb-8">NFA QR HUNT</h1>
        

        {/* team selector */}
        <div className="mb-8">
          <label className="mr-2 text-slate-300">Team:</label>
          <select
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            className="rounded px-3 py-2 bg-slate-800 border border-slate-700"
          >
            <option value="team1">Team Orange</option>
            <option value="team2">Team Yellow</option>
            <option value="team3">Team Green</option>
            <option value="team4">Team Blue</option>
            <option value="team5">Team Red</option>
            <option value="team6">Team Pink</option>
          </select>
        </div>

        {/* MAIN BUTTONS */}
        <button
          onClick={() => setScreen("scan")}
          className="w-64 py-4 text-lg font-semibold bg-green-600 rounded-xl mb-4 hover:bg-green-700"
        >
          Scan QR
        </button>

        <button
          onClick={() => setScreen("leaderboard")}
          className="w-64 py-4 text-lg font-semibold bg-blue-600 rounded-xl hover:bg-blue-700"
        >
          Leaderboard
        </button>

        <footer className="absolute bottom-4 text-slate-500 text-xs">
          Installable PWA — Camera Required
        </footer>
      </div>
    );
  }

  // -------------------------
  // SCAN SCREEN
  // -------------------------
  if (screen === "scan") {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-4">

        <button
          onClick={() => setScreen("home")}
          className="mb-4 px-3 py-2 bg-slate-700 rounded-lg"
        >
          ← Back
        </button>

        <Scan teamId={teamId} socket={socket} serverStartTs={serverStartTs} />
      </div>
    );
  }

  // -------------------------
  // LEADERBOARD SCREEN
  // -------------------------
  if (screen === "leaderboard") {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-4">

        <button
          onClick={() => setScreen("home")}
          className="mb-4 px-3 py-2 bg-slate-700 rounded-lg"
        >
          ← Back
        </button>

        <Leaderboard data={leaderboard} selectedTeamId={teamId} />
      </div>
    );
  }
}
