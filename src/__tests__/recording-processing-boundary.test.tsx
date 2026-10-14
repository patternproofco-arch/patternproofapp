// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { RecordingProvider, useRecording } from "@/lib/recording-context";

afterEach(() => vi.unstubAllGlobals());

it("captures a recording without starting remote speech recognition or sending audio", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const remoteRecognition = vi.fn();
  Object.assign(window, {
    SpeechRecognition: remoteRecognition,
    webkitSpeechRecognition: remoteRecognition,
  });
  const stopTrack = vi.fn();
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] }),
    },
  });
  class Recorder {
    ondataavailable?: (e: { data: Blob }) => void;
    onstop?: () => void;
    start() {
      this.ondataavailable?.({ data: new Blob(["fictional audio"]) });
    }
    stop() {
      this.onstop?.();
    }
  }
  vi.stubGlobal("MediaRecorder", Recorder);
  const network = vi.fn();
  vi.stubGlobal("fetch", network);
  let recording!: ReturnType<typeof useRecording>;
  function Capture() {
    recording = useRecording();
    return null;
  }
  const host = document.createElement("div");
  const root = createRoot(host);
  try {
    await act(async () =>
      root.render(
        <RecordingProvider>
          <Capture />
        </RecordingProvider>,
      ),
    );
    await act(async () => {
      expect(await recording.start()).toBe(true);
    });
    await act(async () => {
      const item = await recording.stop();
      expect(item?.blob.size).toBeGreaterThan(0);
      expect(item?.transcript).toBe("");
    });
    expect(stopTrack).toHaveBeenCalledOnce();
    expect(remoteRecognition).not.toHaveBeenCalled();
    expect(network).not.toHaveBeenCalled();
  } finally {
    await act(async () => root.unmount());
    delete (window as unknown as Record<string, unknown>).SpeechRecognition;
    delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
  }
});
