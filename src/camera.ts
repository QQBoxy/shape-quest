import { CONFIG } from "./config";
export interface CameraChoice { facingMode: "user" | "environment"; deviceId?: string; }

export async function openCamera(
  video: HTMLVideoElement,
  active = () => true,
  choice: CameraChoice = { facingMode: "user" },
): Promise<MediaStream> {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia)
    throw new Error(
      "需要 HTTPS 或 localhost 才能使用攝影機。手機請使用 HTTPS 網址。",
    );
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      ...(choice.deviceId
        ? { deviceId: { exact: choice.deviceId } }
        : { facingMode: choice.facingMode === "environment"
          ? { exact: "environment" } : { ideal: "user" } }),
      width: { ideal: CONFIG.camera.width },
      height: { ideal: CONFIG.camera.height },
      frameRate: { ideal: 24, max: 30 },
    },
  });
  try {
    if (!active())
      throw new DOMException("Camera setup cancelled", "AbortError");
    const track = stream.getVideoTracks()[0];
    if (!choice.deviceId && choice.facingMode === "environment" && track?.getSettings().facingMode === "user")
      throw new Error("這個裝置未提供後鏡頭，請從選單改選可用的鏡頭。");
    // Use the widest zoom the selected physical camera actually exposes.
    const zoom = (track?.getCapabilities?.() as (MediaTrackCapabilities & {
      zoom?: { min: number; max: number };
    }) | undefined)?.zoom;
    if (zoom && Number.isFinite(zoom.min)) {
      try {
        const wide: MediaTrackConstraintSet & { zoom: number } = { zoom: zoom.min };
        await track.applyConstraints({ advanced: [wide] });
      } catch { /* The camera remains usable when zoom controls are unavailable. */ }
    }
    if (!active()) throw new DOMException("Camera setup cancelled", "AbortError");
    video.srcObject = stream;
    await video.play();
    return stream;
  } catch (error) {
    stream.getTracks().forEach((t) => t.stop());
    if (video.srcObject === stream) video.srcObject = null;
    throw error;
  }
}
export function cameraError(error: unknown) {
  if (error instanceof DOMException) {
    const messages: Record<string, string> = {
      NotAllowedError:
        "尚未取得攝影機權限。請在網址列或瀏覽器設定允許攝影機，再重試。",
      NotFoundError: "找不到攝影機，請從選單改選其他鏡頭。",
      NotReadableError: "攝影機可能被其他 App 占用，請關閉其他視訊程式後重試。",
      OverconstrainedError: "找不到所選鏡頭或不支援目前設定，請從選單改選其他鏡頭。",
      SecurityError: "瀏覽器禁止攝影機，請確認使用 HTTPS 並允許權限。",
    };
    return messages[error.name] ?? "攝影機無法啟動，請重新整理或換用瀏覽器。";
  }
  return error instanceof Error ? error.message : "啟動失敗，請再試一次。";
}
