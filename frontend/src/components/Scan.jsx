import React, { useEffect, useRef, useState, useCallback } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import TimerDisplay from "./TimerDisplay";
import ProgressBarVertical from "./ProgressBarVertical";

const BACKEND = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

export default function Scan({ teamId, socket, serverStartTs }) {
  const videoRef = useRef(null);
  const codeReader = useRef(new BrowserMultiFormatReader());

  // 🔒 Prevent duplicate scans (iOS bug fix)
  const handledScanRef = useRef(false);

  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  const [question, setQuestion] = useState(null);
  const [currentLevel, setCurrentLevel] = useState(null);
  const [lastToken, setLastToken] = useState(null);
  const [message, setMessage] = useState(null);
  const [teamProgress, setTeamProgress] = useState(1);
  const [lockUntil, setLockUntil] = useState(null);
  const [lockCountdown, setLockCountdown] = useState(0);
  const [gameCompleted, setGameCompleted] = useState(false);

  /* --------------------------------------
     SOCKET EVENTS
  -------------------------------------- */
  useEffect(() => {
    socket?.on("team:update", (team) => {
      if (team.id === teamId) {
        setTeamProgress(team.progress);
        setGameCompleted(team.progress > 10);
      }
    });

    return () => socket?.off("team:update");
  }, [socket, teamId]);

  useEffect(() => setGameCompleted(teamProgress > 10), [teamProgress]);

  /* --------------------------------------
     CAMERA DEVICE LOADING
  -------------------------------------- */
  const loadCameraDevices = useCallback(async () => {
    setMessage("Requesting camera access...");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });

      stream.getTracks().forEach((t) => t.stop());

      const list = await BrowserMultiFormatReader.listVideoInputDevices();
      if (list?.length) {
        setDevices(list);

        const backCam =
          list.find((d) =>
            ["back", "rear", "environment"].some((w) =>
              d.label.toLowerCase().includes(w)
            )
          ) || list[Math.min(1, list.length - 1)];

        if (backCam) setSelectedDeviceId(backCam.deviceId);
        setMessage(null);
      } else {
        setMessage("No cameras found. Check permissions.");
      }
    } catch (err) {
      console.error("Camera access error:", err);
      setMessage("Camera permission / device issue.");
    }
  }, []);

  useEffect(() => loadCameraDevices(), [loadCameraDevices]);

  /* --------------------------------------
     HARD STOP CAMERA (iOS SAFE)
  -------------------------------------- */
  const hardStopCamera = useCallback(() => {
    try {
      codeReader.current.reset();
    } catch {}

    if (videoRef.current?.srcObject) {
      for (const track of videoRef.current.srcObject.getTracks()) {
        track.stop();
      }
      videoRef.current.srcObject = null;
    }

    setScanning(false);
  }, []);

  /* --------------------------------------
     STOP SCAN
  -------------------------------------- */
  const stopScan = useCallback(() => {
    hardStopCamera();
  }, [hardStopCamera]);

  /* --------------------------------------
     HANDLE TOKEN (SCAN RESULT)
  -------------------------------------- */
  const handleToken = useCallback(
    async (token) => {
      // Ensure camera is fully stopped before UI changes (iOS)
      hardStopCamera();

      setMessage("Fetching question…");

      const resp = await fetch(BACKEND + "/api/scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, teamId }),
      });

      const data = await resp.json();

      if (!resp.ok) {
        if (data.waitMs) {
          const lockTime = Date.now() + data.waitMs;
          setLockUntil(lockTime);
          setMessage(
            `Locked! Wait ${Math.ceil(data.waitMs / 1000)} seconds.`
          );
        } else setMessage(data.error);
        return;
      }

      if (data.completed) {
        setGameCompleted(true);
        setQuestion(null);
        setMessage(
          data.message ||
            "🎉 Congratulations! You have completed all 10 levels!"
        );
        return;
      }

      setQuestion(data.question);
      setCurrentLevel(data.level);
      setLastToken(token);
      setMessage(null);
    },
    [teamId, hardStopCamera]
  );

  /* --------------------------------------
     TORCH
  -------------------------------------- */
  const enableTorchIfAvailable = useCallback(async () => {
    try {
      const track = videoRef.current?.srcObject?.getVideoTracks?.()[0];
      if (!track) return;

      const caps = track.getCapabilities?.();
      if (caps?.torch) {
        track.applyConstraints({ advanced: [{ torch: torchOn }] });
      }
    } catch (err) {
      console.log("Torch error:", err);
    }
  }, [torchOn]);

  useEffect(() => scanning && enableTorchIfAvailable(), [
    torchOn,
    scanning,
    enableTorchIfAvailable,
  ]);

  const toggleTorch = () => setTorchOn((p) => !p);

  /* --------------------------------------
     START SCAN (iOS SAFE)
  -------------------------------------- */
  const startScan = useCallback(async () => {
    if (!selectedDeviceId) return setMessage("No camera selected");

    handledScanRef.current = false; // reset scan guard
    setMessage("Starting camera…");
    setScanning(true);

    try {
      await codeReader.current.decodeFromVideoDevice(
        selectedDeviceId,
        videoRef.current,
        (result) => {
          if (result && !handledScanRef.current) {
            handledScanRef.current = true; // prevent duplicates
            stopScan();
            handleToken(result.getText());
          }
        }
      );

      enableTorchIfAvailable();
    } catch (err) {
      console.error(err);
      setMessage("Failed to start camera");
      setScanning(false);
    }
  }, [
    selectedDeviceId,
    stopScan,
    handleToken,
    enableTorchIfAvailable,
  ]);

  /* --------------------------------------
     SUBMIT ANSWER
  -------------------------------------- */
  const submitAnswer = useCallback(
    async (ans) => {
      const resp = await fetch(BACKEND + "/api/answer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: lastToken, teamId, answer: ans }),
      });

      const data = await resp.json();

      if (data.correct) {
        if (data.completed) {
          setGameCompleted(true);
          setMessage(
            data.message ||
              "🎉 Congratulations! You have completed all 10 levels!"
          );
        } else {
          setMessage(`Correct! Level ${data.nextLevel} unlocked.`);
        }

        // Do NOT restart scan automatically (iOS stability)
        setQuestion(null);
        setCurrentLevel(null);
        setLastToken(null);
        setLockUntil(null);
      } else {
        if (data?.lockUntil) {
          setLockUntil(data.lockUntil);
          const wait = Math.ceil(
            (data.lockUntil - Date.now()) / 1000
          );
          setMessage(`Wrong answer! Locked for ${wait} sec.`);
        } else setMessage("Wrong answer — try again.");
      }
    },
    [lastToken, teamId]
  );

  /* --------------------------------------
     LOCK COUNTDOWN
  -------------------------------------- */
  useEffect(() => {
    if (!lockUntil) return setLockCountdown(0);

    const tick = () => {
      const remaining = Math.max(
        0,
        Math.ceil((lockUntil - Date.now()) / 1000)
      );
      setLockCountdown(remaining);

      if (remaining <= 0) {
        setLockUntil(null);
        setMessage(null);
      }
    };

    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [lockUntil]);

  /* --------------------------------------
     CLEANUP
  -------------------------------------- */
  useEffect(() => () => stopScan(), [stopScan]);

  /* --------------------------------------
     UI
  -------------------------------------- */
  return (
    <div className="flex flex-col h-full">
      {/* progress + timer */}
      <div className="flex items-center gap-4 mb-4">
        <ProgressBarVertical
          percent={gameCompleted ? 100 : Math.min(100, teamProgress * 10)}
        />
        <TimerDisplay startTs={serverStartTs} big />
      </div>

      {/* controls */}
      <div className="flex gap-2 mb-3 flex-wrap">
        <button
          onClick={startScan}
          disabled={scanning || !selectedDeviceId || lockCountdown > 0 || gameCompleted}
          className="bg-emerald-500 text-black px-4 py-2 rounded disabled:opacity-50"
        >
          {scanning ? "Scanning…" : gameCompleted ? "Game Completed" : "Start Scan"}
        </button>

        {scanning && (
          <button onClick={stopScan} className="bg-red-500 text-white px-4 py-2 rounded">
            Stop
          </button>
        )}

        <button
          onClick={loadCameraDevices}
          disabled={scanning}
          className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          🔄 Refresh Camera
        </button>

        <select
          value={selectedDeviceId || ""}
          onChange={(e) => setSelectedDeviceId(e.target.value)}
          disabled={scanning || devices.length === 0}
          className="bg-slate-700 text-white px-2 py-2 rounded"
        >
          {devices.length === 0
            ? <option>No cameras</option>
            : devices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Camera ${d.deviceId.slice(0, 8)}`}
                </option>
              ))}
        </select>

        {scanning && (
          <button onClick={toggleTorch} className="bg-yellow-400 text-black px-4 py-2 rounded">
            {torchOn ? "Torch Off" : "Torch On"}
          </button>
        )}
      </div>

      {/* video */}
      <div className="rounded overflow-hidden mb-3">
        <video
          ref={videoRef}
          className="w-full h-72 bg-black object-cover"
          playsInline
          muted
          autoPlay
        />
      </div>

      {/* lock */}
      {lockCountdown > 0 && (
        <div className="bg-red-900/50 border-2 border-red-600 p-4 rounded mb-3 text-center">
          <div className="text-red-300 text-xl font-bold mb-1">🔒 Locked!</div>
          <div className="text-red-200 text-lg">
            Please wait <b>{lockCountdown}</b> seconds.
          </div>
        </div>
      )}

      {/* messages */}
      {message && lockCountdown === 0 && (
        <div className={`mb-2 ${gameCompleted ? "text-yellow-300 text-lg font-semibold" : "text-yellow-300"}`}>
          {message}
        </div>
      )}

      {/* question */}
      {question && !gameCompleted && (
        <div className="bg-slate-700 p-3 rounded">
          {currentLevel && (
            <div className="text-emerald-400 text-sm mb-2 font-semibold">
              Level {currentLevel} of 10
            </div>
          )}

          <div className="text-white text-lg mb-4 font-semibold">
            {typeof question === "string" ? question : question.text || question}
          </div>

          {Array.isArray(question.options) && question.options.length > 0 ? (
            <div className="space-y-2">
              {question.options.map((opt, idx) => (
                <button
                  key={idx}
                  disabled={lockCountdown > 0}
                  onClick={() => submitAnswer(opt)}
                  className="w-full px-4 py-3 rounded bg-slate-600 text-white hover:bg-slate-500"
                >
                  <span className="font-semibold mr-2 text-emerald-400">
                    {String.fromCharCode(65 + idx)}.
                  </span>
                  {opt}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex gap-2">
              <input id="ans" className="flex-1 px-2 py-2 rounded bg-slate-600 text-white" />
              <button
                onClick={() => submitAnswer(document.getElementById("ans").value)}
                className="bg-amber-400 text-black px-4 py-2 rounded"
              >
                Submit
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
