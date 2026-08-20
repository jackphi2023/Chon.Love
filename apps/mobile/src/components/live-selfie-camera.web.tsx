import { colors, spacing } from '@myfan/ui';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { PreparedLocalProfileImage } from '@/lib/profile-media';

type WebTrack = { stop: () => void };
type WebStream = { getTracks: () => WebTrack[] };
type WebVideo = {
  srcObject: WebStream | null;
  videoWidth: number;
  videoHeight: number;
  play: () => Promise<void>;
};
type CanvasContext = {
  drawImage: (
    source: unknown,
    sourceX: number,
    sourceY: number,
    sourceWidth: number,
    sourceHeight: number,
    destinationX: number,
    destinationY: number,
    destinationWidth: number,
    destinationHeight: number,
  ) => void;
};
type Canvas = {
  width: number;
  height: number;
  getContext: (type: '2d') => CanvasContext | null;
  toDataURL: (type: string, quality?: number) => string;
};
type WebGlobals = {
  navigator?: {
    mediaDevices?: {
      getUserMedia: (constraints: Record<string, unknown>) => Promise<WebStream>;
    };
  };
  document?: { createElement: (tag: 'canvas') => Canvas };
};
type VideoProps = {
  autoPlay?: boolean;
  muted?: boolean;
  playsInline?: boolean;
  ref?: (node: WebVideo | null) => void;
  style?: Record<string, unknown>;
};

const VideoElement = 'video' as unknown as React.ComponentType<VideoProps>;

type Props = {
  disabled?: boolean;
  onCapture: (image: PreparedLocalProfileImage) => void;
  onError: (message: string) => void;
};

export function LiveSelfieCamera({ disabled = false, onCapture, onError }: Props) {
  const videoRef = useRef<WebVideo | null>(null);
  const streamRef = useRef<WebStream | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  async function startCamera() {
    setIsStarting(true);
    try {
      const globals = globalThis as unknown as WebGlobals;
      const mediaDevices = globals.navigator?.mediaDevices;
      if (!mediaDevices?.getUserMedia) throw new Error('camera_not_supported');
      streamRef.current?.getTracks().forEach((track) => track.stop());
      const stream = await mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      if (!videoRef.current) throw new Error('camera_preview_not_ready');
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setIsReady(true);
    } catch (error) {
      const name = error instanceof Error ? error.name : '';
      onError(
        /NotAllowed|Permission/iu.test(name)
          ? 'Bạn cần cấp quyền camera cho trình duyệt để chụp selfie.'
          : 'Không thể mở camera. Hãy kiểm tra quyền camera hoặc thử trình duyệt khác.',
      );
    } finally {
      setIsStarting(false);
    }
  }

  async function capture() {
    const video = videoRef.current;
    const globals = globalThis as unknown as WebGlobals;
    if (!video || !globals.document || !isReady) return;
    if (!video.videoWidth || !video.videoHeight) {
      onError('Camera chưa sẵn sàng. Hãy đợi hình ảnh xuất hiện rồi chụp lại.');
      return;
    }

    setIsCapturing(true);
    try {
      const canvas = globals.document.createElement('canvas');
      const side = Math.min(video.videoWidth, video.videoHeight);
      const sourceX = Math.max(0, Math.floor((video.videoWidth - side) / 2));
      const sourceY = Math.max(0, Math.floor((video.videoHeight - side) / 2));
      canvas.width = 1080;
      canvas.height = 1080;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('canvas_context_unavailable');

      context.drawImage(
        video as unknown,
        sourceX,
        sourceY,
        side,
        side,
        0,
        0,
        canvas.width,
        canvas.height,
      );
      const previewUri = canvas.toDataURL('image/jpeg', 0.88);
      const response = await fetch(previewUri);
      const bytes = await response.arrayBuffer();
      onCapture({
        visibility: 'private',
        mimeType: 'image/jpeg',
        extension: 'jpg',
        width: canvas.width,
        height: canvas.height,
        bytes,
        previewUri,
        metadata: {
          mimeType: 'image/jpeg',
          extension: 'jpg',
          width: canvas.width,
          height: canvas.height,
          fileSizeBytes: bytes.byteLength,
        },
      });
    } catch {
      onError('Không thể chụp selfie từ camera. Hãy thử lại.');
    } finally {
      setIsCapturing(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.previewFrame}>
        <VideoElement
          autoPlay
          muted
          playsInline
          ref={(node) => { videoRef.current = node; }}
          style={videoStyle}
        />
        {!isReady ? (
          <View style={styles.previewOverlay}>
            <Text accessibilityElementsHidden style={styles.icon}>◉</Text>
            <Text style={styles.title}>Camera selfie trực tiếp</Text>
            <Text style={styles.description}>Bật camera để xem hình ảnh trực tiếp trước khi chụp selfie.</Text>
          </View>
        ) : null}
      </View>

      {!isReady ? (
        <Pressable
          accessibilityLabel="Bật camera"
          accessibilityRole="button"
          accessibilityState={{ disabled: disabled || isStarting, busy: isStarting }}
          disabled={disabled || isStarting}
          onPress={() => void startCamera()}
          style={({ pressed }) => [styles.button, pressed && styles.pressed, (disabled || isStarting) && styles.disabled]}
        >
          {isStarting ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.buttonText}>Bật camera</Text>}
        </Pressable>
      ) : (
        <Pressable
          accessibilityLabel="Chụp selfie"
          accessibilityRole="button"
          accessibilityState={{ disabled: disabled || isCapturing, busy: isCapturing }}
          disabled={disabled || isCapturing}
          onPress={() => void capture()}
          style={({ pressed }) => [styles.button, pressed && styles.pressed, (disabled || isCapturing) && styles.disabled]}
        >
          {isCapturing ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.buttonText}>Chụp selfie</Text>}
        </Pressable>
      )}
    </View>
  );
}

const videoStyle = {
  backgroundColor: '#111111',
  height: '100%',
  objectFit: 'cover',
  transform: 'scaleX(-1)',
  width: '100%',
};

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  previewFrame: {
    backgroundColor: '#111111',
    borderRadius: 14,
    height: 360,
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },
  previewOverlay: {
    alignItems: 'center',
    backgroundColor: colors.background,
    bottom: 0,
    gap: spacing.sm,
    justifyContent: 'center',
    left: 0,
    padding: spacing.lg,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  icon: { color: colors.primary, fontSize: 42 },
  title: { color: colors.text, fontSize: 18, fontWeight: '800' },
  description: { color: colors.muted, fontSize: 14, lineHeight: 21, maxWidth: 440, textAlign: 'center' },
  button: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 14, justifyContent: 'center', minHeight: 52, paddingHorizontal: spacing.lg },
  buttonText: { color: colors.surface, fontSize: 16, fontWeight: '800' },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.5 },
});