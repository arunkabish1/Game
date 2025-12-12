import React, { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import TimerDisplay from "./TimerDisplay";
import ProgressBarVertical from "./ProgressBarVertical";

export default function Scan({ teamId, socket, serverStartTs }) {
  const videoRef = useRef(null);
  const codeReader = useRef(new BrowserMultiFormatReader());

  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  const [question, setQuestion] = useState(null);
  const [lastToken, setLastToken] = useState(null);
  const [message, setMessage] = useState(null);
  const [teamProgress, setTeamProgress] = useState(1);

  /* --------------------------------------
     SOCKET EVENTS
  -------------------------------------- */
  useEffect(() => {
    socket?.on("team:update", (team) => {
      if (team.id === teamId) setTeamProgress(team.progress);
    });

    return () => {
      socket?.off("team:update");
    };
  }, [socket, teamId]);

  /* --------------------------------------
     LOAD CAMERA DEVICES ONCE
  -------------------------------------- */
  useEffect(() => {
    BrowserMultiFormatReader.listVideoInputDevices()
      .then((list) => {
        setDevices(list);

        // Auto-select environment/back camera
        let backCam =
          list.find((d) =>
            d.label.toLowerCase().includes("back") ||
            d.label.toLowerCase().includes("rear") ||
            d.label.toLowerCase().includes("environment")
          ) || list[1] || list[0];

        setSelectedDeviceId(backCam.deviceId);
      })
      .catch(() => setMessage("Camera devices not found"));
  }, []);

  /* --------------------------------------
     START SCANNING
  -------------------------------------- */
  async function startScan() {
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
  }

  /* --------------------------------------
     STOP SCANNING
  -------------------------------------- */
  function stopScan() {
    try {
      codeReader.current.reset();
    } catch {}
    setScanning(false);

    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((t) => t.stop());
    }
  }

  /* --------------------------------------
     TORCH MODE
  -------------------------------------- */
  async function enableTorchIfAvailable() {
    try {
      const track = videoRef.current.srcObject.getVideoTracks()[0];
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
  }

  async function toggleTorch() {
    setTorchOn(!torchOn);
    await enableTorchIfAvailable();
  }

  /* --------------------------------------
     HANDLE TOKENS
  -------------------------------------- */
  async function handleToken(token) {
    setMessage("Fetching question…");

    const resp = await fetch(
      import.meta.env.VITE_BACKEND_URL + "/api/scan",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, teamId }),
      }
    );

    const data = await resp.json();

    if (!resp.ok) return setMessage(data.error);

    setQuestion(data.question);
    setLastToken(token);
    setMessage(null);
  }

  /* --------------------------------------
     SUBMIT ANSWER
  -------------------------------------- */
  async function submitAnswer(ans) {
    const resp = await fetch(
      import.meta.env.VITE_BACKEND_URL + "/api/answer",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: lastToken, teamId, answer: ans }),
      }
    );

    const data = await resp.json();

    if (data.correct) {
      setMessage("Correct! Level unlocked.");
      setQuestion(null);
      setLastToken(null);
    } else {
      setMessage("Wrong answer — try again.");
    }
  }

  /* --------------------------------------
     UI
  -------------------------------------- */
  return (
    <div className="flex flex-col h-full">

      {/* --- CAMERA CONTROL BUTTONS --- */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={startScan}
          disabled={scanning}
          className="bg-emerald-500 text-black px-4 py-2 rounded"
        >
          {scanning ? "Scanning…" : "Start Scan"}
        </button>

        {scanning && (
          <button
            onClick={stopScan}
            className="bg-red-500 text-white px-4 py-2 rounded"
          >
            Stop
          </button>
        )}

        {/* Switch Camera */}
        <select
          value={selectedDeviceId || ""}
          onChange={(e) => setSelectedDeviceId(e.target.value)}
          className="bg-slate-700 text-white px-2 py-2 rounded"
        >
          {devices.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label || "Camera"}
            </option>
          ))}
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
        />
      </div>

      {/* --- MESSAGES --- */}
      {message && (
        <div className="text-yellow-300 mb-2">{message}</div>
      )}

      {/* --- QUESTION VIEW --- */}
      {question && (
        <div className="bg-slate-700 p-3 rounded">
          <div className="text-white text-lg mb-2">{question}</div>

          <div className="flex gap-2">
            <input id="ans" className="flex-1 px-2 py-2 rounded bg-slate-600" />
            <button
              onClick={() => submitAnswer(document.getElementById("ans").value)}
              className="bg-amber-400 text-black px-4 py-2 rounded"
            >
              Submit
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
