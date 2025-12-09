import React, { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import TimerDisplay from "./TimerDisplay";
import ProgressBarVertical from "./ProgressBarVertical";

export default function Scan({ teamId, socket, serverStartTs }) {
  const videoRef = useRef(null);
  const codeReaderRef = useRef(null);

  const [scanning, setScanning] = useState(false);
  const [question, setQuestion] = useState(null);
  const [lastToken, setLastToken] = useState(null);
  const [message, setMessage] = useState(null);
  const [currentLevel, setCurrentLevel] = useState(1);
  const [teamProgress, setTeamProgress] = useState(1);

  useEffect(() => {
    if (!socket) return;

    const onTeamUpdate = (team) => {
      if (team && team.id === teamId) {
        setTeamProgress(team.progress || 1);
        setCurrentLevel(team.progress || 1);
      }
    };

    const onLevelStarted = ({ teamId: tId, level }) => {
      if (tId === teamId) {
        setCurrentLevel(level);
      }
    };

    socket.on("team:update", onTeamUpdate);
    socket.on("level_started", onLevelStarted);

    socket.emit("request_leaderboard");

    return () => {
      socket.off("team:update", onTeamUpdate);
      socket.off("level_started", onLevelStarted);
    };
  }, [socket, teamId]);

  useEffect(() => {
    return () => stopScan();
  }, []);

  async function startScan() {
    setMessage(null);
    setQuestion(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setMessage("Camera not supported.");
      return;
    }

    codeReaderRef.current = new BrowserMultiFormatReader();
    setScanning(true);

    try {
      const devices = await BrowserMultiFormatReader.listVideoInputDevices();
      const deviceId = devices?.[0]?.deviceId;

      await codeReaderRef.current.decodeFromVideoDevice(
        deviceId,
        videoRef.current,
        (result, err) => {
          if (result) {
            stopScan();
            handleToken(result.getText());
          }
        }
      );
    } catch {
      setMessage("Camera access failed. Check permissions.");
      setScanning(false);
    }
  }

  function stopScan() {
    try {
      codeReaderRef.current?.reset();
    } catch {}
    setScanning(false);
  }

  async function handleToken(token) {
    setMessage("Scanned — fetching question...");

    try {
      const resp = await fetch(
        (import.meta.env.VITE_BACKEND_URL || "http://localhost:5000") +
          "/api/scan",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token, teamId }),
        }
      );

      const j = await resp.json();
      if (!resp.ok) return setMessage(j.error || "Error");

      setQuestion(j.question);
      setLastToken(token);
      setCurrentLevel(j.level);
      setMessage(null);
    } catch {
      setMessage("Network error");
    }
  }

  async function submitAnswer(ans) {
    try {
      const resp = await fetch(
        (import.meta.env.VITE_BACKEND_URL || "http://localhost:5000") +
          "/api/answer",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token: lastToken, teamId, answer: ans }),
        }
      );

      const j = await resp.json();

      if (j.correct) {
        setMessage("Correct! Level unlocked.");
        setQuestion(null);
        setLastToken(null);
      } else {
        setMessage("Wrong answer — try again.");
      }
    } catch {
      setMessage("Network error");
    }
  }

  const levelsCompleted = Math.max(0, (teamProgress || 1) - 1);
  const progressPercent = Math.round((levelsCompleted / 10) * 100);

  return (
    <div className="flex flex-col h-full">

      {/* Level & Timer */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 md:w-16 md:h-16 bg-slate-800 rounded flex items-center justify-center">
            <svg
              className="w-8 h-8 text-yellow-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 8v4l3 3"
              />
            </svg>
          </div>

          <div>
            <div className="text-xs text-slate-400">Level</div>
            <div className="text-xl font-bold">{levelsCompleted}/10</div>
          </div>
        </div>

        <div className="text-right">
          <div className="text-xs text-slate-400">Timer</div>
          <TimerDisplay startTs={serverStartTs} big />
        </div>
      </div>

      {/* Main Layout (Responsive) */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Scanner */}
        <div className="col-span-2 bg-slate-800 rounded p-3 flex flex-col">

          {/* Buttons */}
          <div className="mb-3 flex flex-col sm:flex-row gap-2">
            <button
              onClick={startScan}
              disabled={scanning}
              className="bg-emerald-500 text-black px-4 py-3 rounded-lg w-full sm:w-auto"
            >
              Start Camera Scan
            </button>

            {scanning && (
              <button
                onClick={stopScan}
                className="bg-rose-500 text-white px-4 py-3 rounded-lg w-full sm:w-auto"
              >
                Stop
              </button>
            )}
          </div>

          {/* Video */}
          <div className="rounded-lg overflow-hidden shadow-lg mb-3">
            <video
              ref={videoRef}
              className="w-full h-56 sm:h-64 md:h-72 object-cover bg-black"
              playsInline
            />
          </div>

          {/* Token input */}
          <div className="mb-2">
            <input
              id="pasteToken"
              placeholder="Or paste token here"
              className="w-full px-3 py-2 rounded bg-slate-700"
            />

            <div className="mt-2 flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => {
                  const t = document.getElementById("pasteToken").value;
                  handleToken(t);
                }}
                className="bg-indigo-500 px-4 py-3 rounded-lg w-full sm:w-auto"
              >
                Open
              </button>

              <button
                onClick={() => {
                  document.getElementById("pasteToken").value = "";
                }}
                className="bg-slate-600 px-4 py-3 rounded-lg w-full sm:w-auto"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Message */}
          {message && <div className="text-yellow-300 text-sm mb-2">{message}</div>}

          {/* Question */}
          {question && (
            <div className="mt-3 bg-slate-700 p-3 rounded flex flex-col">
              <div className="text-slate-200 mb-2 font-semibold">Question</div>
              <div className="text-lg mb-3">{question}</div>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  id="ans"
                  placeholder="Your answer"
                  className="flex-1 px-3 py-2 rounded bg-slate-600"
                />

                <button
                  onClick={() => {
                    const a = document.getElementById("ans").value;
                    submitAnswer(a);
                  }}
                  className="bg-amber-400 text-black px-4 py-3 rounded w-full sm:w-auto"
                >
                  Submit
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Progress */}
        <div className="flex flex-col items-center mt-4 md:mt-0">
          <ProgressBarVertical percent={progressPercent} />

          <div className="mt-4 w-full text-center md:text-left">
            <div className="text-sm text-slate-400">Progress</div>
            <div className="text-lg font-bold">{progressPercent}%</div>
          </div>
        </div>
      </div>
    </div>
  );
}
