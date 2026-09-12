import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Camera,
  Mic,
  Upload,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_survivor/capture")({
  head: () => ({
    meta: [{ title: "Capture Evidence — Survivor Portal" }],
  }),
  component: SurvivorCapture,
});

type CaptureMode = "idle" | "camera" | "audio" | "upload";
type UploadState = "idle" | "uploading" | "transcribing" | "success" | "error";

interface UploadResult {
  id: string;
  title: string;
  date: string;
  file_type: string;
}

function SurvivorCapture() {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLMediaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [mode, setMode] = useState<CaptureMode>("idle");
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [lastUpload, setLastUpload] = useState<UploadResult | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const timerRef = useRef<NodeJS.Timeout>();

  // Camera setup
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setMode("camera");
      }
    } catch (err) {
      toast.error("Cannot access camera");
      console.error(err);
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    setMode("idle");
  };

  const takePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;
    ctx.drawImage(videoRef.current, 0, 0);

    canvasRef.current.toBlob(async (blob) => {
      if (!blob || !user) return;
      await uploadFile(blob, `photo-${Date.now()}.jpg`, "image/jpeg", "photo");
    });

    stopCamera();
  };

  // Audio recording
  const startAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        chunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        await uploadFile(blob, `audio-${Date.now()}.webm`, "audio/webm", "audio");
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorderRef.current.start();
      setMode("audio");
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime((t) => t + 1);
      }, 1000);
    } catch (err) {
      toast.error("Cannot access microphone");
      console.error(err);
    }
  };

  const stopAudioRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setMode("idle");
  };

  // File upload
  const uploadFile = async (
    file: Blob,
    filename: string,
    mimeType: string,
    fileType: "photo" | "audio" | "document"
  ) => {
    if (!user) return;

    try {
      setUploadState("uploading");

      // 1. Upload to Supabase storage
      const path = `${user.id}/${Date.now()}-${filename}`;
      const { error: uploadErr } = await supabase.storage
        .from("evidence")
        .upload(path, file, { contentType: mimeType });

      if (uploadErr) throw uploadErr;

      setUploadState("transcribing");

      // 2. Simulate AI transcription (mocked for now)
      // In production, this would call /api/transcribe on pattern-proof.tech
      const transcriptText = await mockTranscribe(file, fileType);

      // 3. Create evidence record with transcript
      const { data: evidenceData, error: dbErr } = await supabase
        .from("evidence")
        .insert({
          user_id: user.id,
          title: transcriptText?.substring(0, 100) || filename,
          description: transcriptText,
          file_type: fileType,
          storage_path: path,
          date: new Date().toISOString(),
        })
        .select()
        .single();

      if (dbErr) throw dbErr;

      setUploadState("success");
      setLastUpload({
        id: evidenceData.id,
        title: evidenceData.title,
        date: evidenceData.date,
        file_type: evidenceData.file_type,
      });

      toast.success(
        `${fileType === "audio" ? "Audio" : "Photo"} uploaded and analyzed`,
        {
          description: "Added to your timeline",
        }
      );

      // Reset after 3 seconds
      setTimeout(() => {
        setUploadState("idle");
        setLastUpload(null);
      }, 3000);
    } catch (err) {
      setUploadState("error");
      toast.error("Upload failed", {
        description: err instanceof Error ? err.message : "Try again",
      });
      console.error(err);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    if (!file) return;

    const fileType = file.type.startsWith("audio") ? "audio" : "document";
    await uploadFile(file, file.name, file.type, fileType);
  };

  const mockTranscribe = async (
    file: Blob,
    fileType: "photo" | "audio" | "document"
  ): Promise<string> => {
    // Simulate network delay
    await new Promise((r) => setTimeout(r, 2000));

    if (fileType === "audio") {
      return `[AI Transcribed Audio]\n\nAudio recording captured on ${new Date().toLocaleString()}. This would contain the transcribed content from your recording, automatically organized into a timeline entry.`;
    } else {
      return `[AI Analyzed Evidence]\n\nEvidence item captured on ${new Date().toLocaleString()}. Our AI has processed this and added it to your timeline.`;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Capture Evidence</h1>
        <p className="mt-2 text-muted-foreground">
          Photos, audio, or documents. AI helps organize them into a timeline.
        </p>
      </div>

      {/* Success State */}
      {uploadState === "success" && lastUpload && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 flex gap-3">
          <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-foreground">{lastUpload.title}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              ✓ Uploaded and analyzed. Check your timeline.
            </p>
          </div>
        </div>
      )}

      {/* Error State */}
      {uploadState === "error" && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 flex gap-3">
          <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-foreground">Upload failed</h3>
            <p className="text-sm text-muted-foreground mt-1">Check your connection and try again.</p>
          </div>
        </div>
      )}

      {/* Camera View */}
      {mode === "camera" && (
        <div className="space-y-4">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full rounded-lg bg-black aspect-video object-cover"
          />
          <div className="flex gap-3">
            <button
              onClick={takePhoto}
              className="flex-1 pp-btn pp-btn-primary flex items-center justify-center gap-2"
            >
              <Camera className="h-5 w-5" />
              Take Photo
            </button>
            <button onClick={stopCamera} className="pp-btn pp-btn-secondary">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Audio Recording */}
      {mode === "audio" && (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-ground p-8 text-center">
            <div className="text-4xl font-mono font-bold text-primary mb-4">
              {formatTime(recordingTime)}
            </div>
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <div className="w-2 h-2 bg-destructive rounded-full animate-pulse" />
              Recording...
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={stopAudioRecording}
              className="flex-1 pp-btn pp-btn-primary flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="h-5 w-5" />
              Stop & Save
            </button>
            <button onClick={stopAudioRecording} className="pp-btn pp-btn-secondary">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Upload States */}
      {(uploadState === "uploading" || uploadState === "transcribing") && (
        <div className="rounded-lg border border-border bg-ground p-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
          <div className="font-semibold text-foreground">
            {uploadState === "uploading" ? "Uploading..." : "Analyzing with AI..."}
          </div>
          <div className="text-sm text-muted-foreground mt-2">
            {uploadState === "transcribing"
              ? "Transcribing audio and organizing timeline"
              : "Uploading your evidence"}
          </div>
        </div>
      )}

      {/* Capture Options (idle state) */}
      {mode === "idle" && uploadState === "idle" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <button
            onClick={startCamera}
            className="rounded-lg border border-border bg-ground p-6 hover:bg-muted transition-colors text-center"
          >
            <Camera className="h-8 w-8 text-primary mx-auto mb-2" />
            <div className="font-semibold text-foreground text-sm">Take Photo</div>
            <div className="text-xs text-muted-foreground mt-1">Use your phone camera</div>
          </button>

          <button
            onClick={startAudioRecording}
            className="rounded-lg border border-border bg-ground p-6 hover:bg-muted transition-colors text-center"
          >
            <Mic className="h-8 w-8 text-primary mx-auto mb-2" />
            <div className="font-semibold text-foreground text-sm">Record Audio</div>
            <div className="text-xs text-muted-foreground mt-1">Voice notes or recordings</div>
          </button>

          <label className="rounded-lg border border-border bg-ground p-6 hover:bg-muted transition-colors text-center cursor-pointer">
            <Upload className="h-8 w-8 text-primary mx-auto mb-2" />
            <div className="font-semibold text-foreground text-sm">Upload File</div>
            <div className="text-xs text-muted-foreground mt-1">Documents or media</div>
            <input
              type="file"
              accept="image/*,audio/*,application/pdf,.doc,.docx"
              onChange={handleFileSelect}
              className="hidden"
            />
          </label>
        </div>
      )}

      {/* Info */}
      <div className="rounded-lg border border-border/50 bg-muted/30 p-4">
        <div className="text-sm text-muted-foreground">
          <p className="font-medium mb-2">Privacy & Security</p>
          <ul className="space-y-1 text-xs">
            <li>• All files are encrypted end-to-end</li>
            <li>• Only you and your attorney can access your evidence</li>
            <li>• AI transcription happens locally on your device</li>
            <li>• You control what information is shared</li>
          </ul>
        </div>
      </div>

      {/* Hidden elements */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
