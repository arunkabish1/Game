import React, { useEffect, useRef, useState, useCallback } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import TimerDisplay from "./TimerDisplay";
import ProgressBarVertical from "./ProgressBarVertical";

const BACKEND = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

export default function Scan({ teamId, socket, serverStartTs }) {
  const videoRef = useRef(null);
  const codeReader = useRef(new BrowserMultiFormatReader());

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

    return () => {
      socket?.off("team:update");
    };
  }, [socket, teamId]);

  // Initialize game completed state from teamProgress
  useEffect(() => {
    setGameCompleted(teamProgress > 10);
  }, [teamProgress]);

  /* --------------------------------------
     LOAD CAMERA DEVICES
  -------------------------------------- */
  const loadCameraDevices = useCallback(async () => {
    setMessage("Requesting camera access...");
    try {
      // First, request camera permission by getting a temporary stream
      // This is required for some browsers to list devices with labels
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      
      // Stop the temporary stream
      stream.getTracks().forEach(track => track.stop());
      
      // Now list devices (they should have labels now)
      const list = await BrowserMultiFormatReader.listVideoInputDevices();
      
      if (list && list.length > 0) {
        setDevices(list);

        // Auto-select environment/back camera
        let backCam =
          list.find((d) =>
            d.label.toLowerCase().includes("back") ||
            d.label.toLowerCase().includes("rear") ||
            d.label.toLowerCase().includes("environment")
          ) || list[list.length > 1 ? 1 : 0];

        if (backCam) {
          setSelectedDeviceId(backCam.deviceId);
        }
        setMessage(null);
      } else {
        setMessage("No cameras found. Please check your camera permissions.");
      }
    } catch (err) {
      console.error("Camera access error:", err);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setMessage("Camera permission denied. Please allow camera access and click 'Refresh Camera'.");
      } else if (err.name === "NotFoundError") {
        setMessage("No camera found on this device.");
      } else {
        setMessage("Failed to access camera: " + err.message);
      }
      
      // Try to list devices anyway (might work without labels)
      try {
        const list = await BrowserMultiFormatReader.listVideoInputDevices();
        if (list && list.length > 0) {
          setDevices(list);
          setSelectedDeviceId(list[0].deviceId);
          setMessage(null);
        }
      } catch (e) {
        console.error("Failed to list devices:", e);
      }
    }
  }, []);

  useEffect(() => {
    loadCameraDevices();
  }, [loadCameraDevices]);

  /* --------------------------------------
     STOP SCANNING
  -------------------------------------- */
  const stopScan = useCallback(() => {
    try {
      codeReader.current.reset();
    } catch {}
    setScanning(false);

    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((t) => t.stop());
    }
  }, []);

  /* --------------------------------------
     HANDLE TOKENS
  -------------------------------------- */
  const handleToken = useCallback(async (token) => {
    setMessage("Fetching question…");

    const resp = await fetch(
      BACKEND + "/api/scan",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, teamId }),
      }
    );

    const data = await resp.json();

    if (!resp.ok) {
      if (data.waitMs) {
        // Locked - set lock state
        const lockTime = Date.now() + data.waitMs;
        setLockUntil(lockTime);
        setMessage(`Locked! Wait ${Math.ceil(data.waitMs / 1000)} seconds.`);
      } else {
        setMessage(data.error);
      }
      return;
    }

    // Check if game is completed
    if (data.completed) {
      setGameCompleted(true);
      setQuestion(null);
      setMessage(data.message || "🎉 Congratulations! You have completed all 10 levels!");
      return;
    }

    setQuestion(data.question);
    setCurrentLevel(data.level);
    setLastToken(token);
    setMessage(null);
  }, [teamId]);

  /* --------------------------------------
     TORCH MODE
  -------------------------------------- */
  const enableTorchIfAvailable = useCallback(async () => {
    try {
      if (!videoRef.current?.srcObject) return;
      const track = videoRef.current.srcObject.getVideoTracks()[0];
      if (!track) return;
      
      const capabilities = track.getCapabilities();

      if ("torch" in capabilities) {
        track.applyConstraints({
          advanced: [{ torch: torchOn }]
        });
      } else {
        console.log("Torch not supported");
      }
    } catch (err) {
      console.log("Torch error:", err);
    }
  }, [torchOn]);

  const toggleTorch = useCallback(async () => {
    setTorchOn((prev) => !prev);
  }, []);

  useEffect(() => {
    if (scanning) {
      enableTorchIfAvailable();
    }
  }, [torchOn, scanning, enableTorchIfAvailable]);

  /* --------------------------------------
     START SCANNING
  -------------------------------------- */
  const startScan = useCallback(async () => {
    if (!selectedDeviceId) return setMessage("No camera selected");

    setMessage("Starting camera…");
    setScanning(true);

    try {
      await codeReader.current.decodeFromVideoDevice(
        selectedDeviceId,
        videoRef.current,
        (result, err) => {
          if (result) {
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
  }, [selectedDeviceId, stopScan, handleToken, enableTorchIfAvailable]);

  /* --------------------------------------
     SUBMIT ANSWER
  -------------------------------------- */
  const submitAnswer = useCallback(async (ans) => {
    const resp = await fetch(
      BACKEND + "/api/answer",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: lastToken, teamId, answer: ans }),
      }
    );

    const data = await resp.json();

    if (data.correct) {
      if (data.completed) {
        setGameCompleted(true);
        setMessage(data.message || "🎉 Congratulations! You have completed all 10 levels!");
      } else {
        setMessage(`Correct! Level ${data.nextLevel} unlocked.`);
      }
      setQuestion(null);
      setCurrentLevel(null);
      setLastToken(null);
      setLockUntil(null); // Clear any lock
    } else {
      // Wrong answer - lock for 30 seconds
      if (data.lockUntil) {
        setLockUntil(data.lockUntil);
        const waitTime = Math.ceil((data.lockUntil - Date.now()) / 1000);
        setMessage(`Wrong answer! Locked for ${waitTime} seconds.`);
      } else {
        setMessage("Wrong answer — try again.");
      }
    }
  }, [lastToken, teamId]);

  // Lock countdown timer
  useEffect(() => {
    if (!lockUntil) {
      setLockCountdown(0);
      return;
    }

    const updateCountdown = () => {
      const remaining = Math.max(0, Math.ceil((lockUntil - Date.now()) / 1000));
      setLockCountdown(remaining);

      if (remaining <= 0) {
        setLockUntil(null);
        setMessage(null);
      }
    };

    updateCountdown(); // Initial update
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [lockUntil]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopScan();
    };
  }, [stopScan]);

  /* --------------------------------------
     UI
  -------------------------------------- */
  return (
    <div className="flex flex-col h-full">
      {/* --- PROGRESS & TIMER --- */}
      <div className="flex items-center gap-4 mb-4">
        <ProgressBarVertical percent={gameCompleted ? 100 : Math.min(100, teamProgress * 10)} />
        <TimerDisplay startTs={serverStartTs} big />
      </div>

      {/* --- CAMERA CONTROL BUTTONS --- */}
      <div className="flex gap-2 mb-3 flex-wrap">
        <button
          onClick={startScan}
          disabled={scanning || !selectedDeviceId || lockCountdown > 0 || gameCompleted}
          className="bg-emerald-500 text-black px-4 py-2 rounded disabled:opacity-50"
        >
          {scanning ? "Scanning…" : gameCompleted ? "Game Completed" : "Start Scan"}
        </button>

        {scanning && (
          <button
            onClick={stopScan}
            className="bg-red-500 text-white px-4 py-2 rounded"
          >
            Stop
          </button>
        )}

        <button
          onClick={loadCameraDevices}
          disabled={scanning}
          className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
          title="Refresh camera list"
        >
          🔄 Refresh Camera
        </button>

        {/* Switch Camera */}
        <select
          value={selectedDeviceId || ""}
          onChange={(e) => setSelectedDeviceId(e.target.value)}
          className="bg-slate-700 text-white px-2 py-2 rounded"
          disabled={scanning || devices.length === 0}
        >
          {devices.length === 0 ? (
            <option value="">No cameras available</option>
          ) : (
            devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Camera ${d.deviceId.slice(0, 8)}`}
              </option>
            ))
          )}
        </select>

        {/* Torch Button */}
        {scanning && (
          <button
            onClick={toggleTorch}
            className="bg-yellow-400 text-black px-4 py-2 rounded"
          >
            {torchOn ? "Torch Off" : "Torch On"}
          </button>
        )}
      </div>

      {/* --- VIDEO VIEWPORT --- */}
      <div className="rounded overflow-hidden mb-3">
        <video
          ref={videoRef}
          className="w-full h-72 bg-black object-cover"
          playsInline
          muted
          autoPlay
        />
      </div>

      {/* --- LOCK MESSAGE --- */}
      {lockCountdown > 0 && (
        <div className="bg-red-900/50 border-2 border-red-600 p-4 rounded mb-3 text-center">
          <div className="text-red-300 text-xl font-bold mb-1">
            🔒 Locked!
          </div>
          <div className="text-red-200 text-lg">
            Wrong answer! Please wait <span className="font-bold">{lockCountdown}</span> seconds before trying again.
          </div>
        </div>
      )}

      {/* --- MANUAL INPUT FOR TESTING --- */}
      {!gameCompleted && (
        <div className={`bg-slate-800 p-3 rounded mb-3 border ${lockCountdown > 0 ? 'border-red-600 opacity-50' : 'border-slate-600'}`}>
          <div className="text-slate-300 text-sm mb-2 font-semibold">🧪 Manual Input</div>
          <div className="flex gap-2">
            <input
              id="manualToken"
              type="text"
              placeholder={lockCountdown > 0 ? "Locked..." : "Enter QR token manually..."}
              disabled={lockCountdown > 0}
              className="flex-1 px-3 py-2 rounded bg-slate-700 text-white border border-slate-600 focus:outline-none focus:border-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
              onKeyDown={(e) => {
                if (e.key === "Enter" && lockCountdown === 0) {
                  const token = e.target.value.trim();
                  if (token) {
                    handleToken(token);
                    e.target.value = "";
                  }
                }
              }}
            />
            <button
              onClick={() => {
                if (lockCountdown === 0) {
                  const input = document.getElementById("manualToken");
                  const token = input?.value.trim();
                  if (token) {
                    handleToken(token);
                    input.value = "";
                  }
                }
              }}
              disabled={lockCountdown > 0}
              className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Submit Token
            </button>
          </div>
        </div>
      )}

      {/* --- GAME COMPLETED MESSAGE --- */}
      {gameCompleted && (
        <div className="bg-gradient-to-r from-yellow-600 to-yellow-500 text-black p-6 rounded-lg mb-4 text-center border-4 border-yellow-300">
          <div className="text-3xl font-bold mb-2">🎉 Congratulations! 🎉</div>
          <div className="text-xl font-semibold">You have completed all 10 levels!</div>
          <div className="text-sm mt-2 text-yellow-900">The game is complete!</div>
        </div>
      )}

      {/* --- MESSAGES --- */}
      {message && lockCountdown === 0 && (
        <div className={`mb-2 ${gameCompleted ? 'text-yellow-300 text-lg font-semibold' : 'text-yellow-300'}`}>
          {message}
        </div>
      )}

      {/* --- QUESTION VIEW --- */}
      {question && !gameCompleted && (
        <div className={`bg-slate-700 p-3 rounded ${lockCountdown > 0 ? 'opacity-50' : ''}`}>
          {currentLevel && (
            <div className="text-emerald-400 text-sm mb-2 font-semibold">
              Level {currentLevel} of 10
            </div>
          )}
          <div className="text-white text-lg mb-4 font-semibold">
            {typeof question === 'string' ? question : question.text || question}
          </div>

          {/* Show options as selectable buttons */}
          {question.options && Array.isArray(question.options) && question.options.length > 0 ? (
            <div className="space-y-2">
              <div className="text-slate-300 text-sm mb-3 font-semibold">Select your answer:</div>
              {question.options.map((opt, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    if (lockCountdown === 0) {
                      submitAnswer(opt);
                    }
                  }}
                  disabled={lockCountdown > 0}
                  className="w-full text-left px-4 py-3 rounded bg-slate-600 text-white hover:bg-slate-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border-2 border-transparent hover:border-emerald-400"
                >
                  <span className="font-semibold mr-2 text-emerald-400">{String.fromCharCode(65 + idx)}.</span>
                  {opt}
                </button>
              ))}
            </div>
          ) : (
            // Fallback to text input if no options available
            <div className="flex gap-2">
              <input 
                id="ans" 
                className="flex-1 px-2 py-2 rounded bg-slate-600 text-white disabled:opacity-50 disabled:cursor-not-allowed" 
                placeholder={lockCountdown > 0 ? "Locked..." : "Enter answer..."}
                disabled={lockCountdown > 0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && lockCountdown === 0) {
                    submitAnswer(e.target.value);
                  }
                }}
              />
              <button
                onClick={() => {
                  if (lockCountdown === 0) {
                    submitAnswer(document.getElementById("ans").value);
                  }
                }}
                disabled={lockCountdown > 0}
                className="bg-amber-400 text-black px-4 py-2 rounded disabled:opacity-50 disabled:cursor-not-allowed"
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
