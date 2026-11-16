import { useEffect, useRef, useState } from 'react';
import type { HandLandmarker, NormalizedLandmark } from '@mediapipe/tasks-vision';
import { GameEngine } from '../game/engine';
import type { ControlMode, GameMode, GameSettings, GameSnapshot, Point } from '../game/types';

type Props = {
  mode: ControlMode;
  gameMode: GameMode;
  settings: GameSettings;
  stream: MediaStream | null;
  landmarker: HandLandmarker | null;
  paused: boolean;
  onSnapshot: (snapshot: GameSnapshot) => void;
  onEnd: (snapshot: GameSnapshot) => void;
  onVisionError: (message: string) => void;
};

const HAND_LINES: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];

function pointInStage(
  landmark: NormalizedLandmark,
  video: HTMLVideoElement,
  width: number,
  height: number,
  mirror: boolean,
): Point {
  const sourceWidth = video.videoWidth || 1280;
  const sourceHeight = video.videoHeight || 720;
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const marginX = (width - sourceWidth * scale) / 2;
  const marginY = (height - sourceHeight * scale) / 2;
  return {
    x: marginX + (mirror ? 1 - landmark.x : landmark.x) * sourceWidth * scale,
    y: marginY + landmark.y * sourceHeight * scale,
  };
}

function playSound(kind: 'slice' | 'hit' | 'life') {
  const AudioContextClass = window.AudioContext;
  if (!AudioContextClass) return;
  try {
    const audio = new AudioContextClass();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = kind === 'hit' ? 'square' : 'sine';
    oscillator.frequency.setValueAtTime(kind === 'hit' ? 140 : kind === 'life' ? 440 : 660, audio.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(kind === 'hit' ? 55 : kind === 'life' ? 920 : 180, audio.currentTime + 0.15);
    gain.gain.setValueAtTime(0.075, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.17);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(); oscillator.stop(audio.currentTime + 0.18);
    oscillator.onended = () => { void audio.close(); };
  } catch { /* Audio is optional; the game must work even when autoplay is restricted. */ }
}

export default function GameArena({
  mode, gameMode, settings, stream, landmarker, paused, onSnapshot, onEnd, onVisionError,
}: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const settingsRef = useRef(settings);
  const pausedRef = useRef(paused);
  const callbacksRef = useRef({ onSnapshot, onEnd, onVisionError });
  const pointerRef = useRef<{ active: boolean; point: Point | null }>({ active: false, point: null });
  const [handCount, setHandCount] = useState(0);
  const handsRef = useRef<Point[][]>([]);

  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => { callbacksRef.current = { onSnapshot, onEnd, onVisionError }; }, [onSnapshot, onEnd, onVisionError]);

  useEffect(() => {
    if (!videoRef.current || !stream) return;
    const video = videoRef.current;
    video.srcObject = stream;
    void video.play().catch(() => callbacksRef.current.onVisionError('Não foi possível reproduzir a imagem da webcam.'));
    return () => { video.srcObject = null; };
  }, [stream]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) return;

    const engine = new GameEngine({
      gameMode,
      reducedEffects: settingsRef.current.reducedEffects,
      onSnapshot: snapshot => callbacksRef.current.onSnapshot(snapshot),
      onEnd: snapshot => callbacksRef.current.onEnd(snapshot),
      onSound: kind => { if (settingsRef.current.sound) playSound(kind); },
    });
    engineRef.current = engine;

    let frame = 0;
    let oldTime = performance.now();
    let lastDetection = 0;
    let lastVideoTime = -1;
    let detectionFailed = false;
    const previousTips = new Map<number, { point: Point; time: number }>();

    function resize() {
      if (!stage || !canvas || !context) return;
      const rect = stage.getBoundingClientRect();
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      engine.resize(width, height);
    }
    const observer = new ResizeObserver(resize);
    observer.observe(stage);
    resize();

    function drawHands() {
      if (!context || !settingsRef.current.showLandmarks) return;
      for (const points of handsRef.current) {
        context.save();
        context.strokeStyle = 'rgba(220, 255, 130, .85)';
        context.lineWidth = 2;
        context.shadowColor = '#cfff6a';
        context.shadowBlur = 8;
        for (const [a, b] of HAND_LINES) {
          if (!points[a] || !points[b]) continue;
          context.beginPath();
          context.moveTo(points[a].x, points[a].y);
          context.lineTo(points[b].x, points[b].y);
          context.stroke();
        }
        for (const [index, point] of points.entries()) {
          context.beginPath();
          context.arc(point.x, point.y, index === 8 ? 6 : 2.5, 0, Math.PI * 2);
          context.fillStyle = index === 8 ? '#f9fce7' : '#c9f577';
          context.fill();
        }
        context.restore();
      }
    }

    function tick(now: number) {
      if (!context) return;
      const dt = (now - oldTime) / 1000;
      oldTime = now;

      if (!pausedRef.current && engine.active) {
        const video = videoRef.current;
        if (mode === 'camera' && landmarker && video && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && now - lastDetection > 36 && video.currentTime !== lastVideoTime && !detectionFailed) {
          lastDetection = now;
          lastVideoTime = video.currentTime;
          try {
            const result = landmarker.detectForVideo(video, now);
            const currentHands = result.landmarks.map(hand => hand.map(point => pointInStage(point, video, engine.width, engine.height, settingsRef.current.mirror)));
            handsRef.current = currentHands;
            setHandCount(previous => previous === currentHands.length ? previous : currentHands.length);
            currentHands.forEach((points, index) => {
              const tip = points[8];
              const last = previousTips.get(index);
              if (last && tip) {
                const elapsed = Math.max(1, now - last.time);
                const distance = Math.hypot(tip.x - last.point.x, tip.y - last.point.y);
                if (distance / elapsed > 0.32 && distance < engine.width * 0.22) {
                  engine.slash(last.point, tip, 'camera');
                }
              }
              if (tip) previousTips.set(index, { point: tip, time: now });
            });
            for (const index of [...previousTips.keys()]) {
              if (index >= currentHands.length) previousTips.delete(index);
            }
          } catch (error) {
            detectionFailed = true;
            callbacksRef.current.onVisionError(error instanceof Error ? error.message : 'Erro no rastreamento da mão.');
          }
        }
        engine.update(Math.max(0, dt));
      }
      engine.render(context, settingsRef.current.showTrail);
      drawHands();
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      engine.active = false;
      engineRef.current = null;
    };
  }, [mode, gameMode, landmarker]);

  function stagePoint(event: React.PointerEvent<HTMLDivElement>): Point {
    const rect = stageRef.current!.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function pointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (mode !== 'mouse' || paused) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerRef.current = { active: true, point: stagePoint(event) };
  }

  function pointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (mode !== 'mouse' || paused || !pointerRef.current.active) return;
    const next = stagePoint(event);
    if (pointerRef.current.point) engineRef.current?.slash(pointerRef.current.point, next, 'mouse');
    pointerRef.current.point = next;
  }

  function pointerUp() { pointerRef.current = { active: false, point: null }; }

  return (
    <div
      ref={stageRef}
      className={`game-stage ${mode === 'mouse' ? 'stage-mouse' : ''} ${mode === 'camera' && settings.showVideo ? 'stage-camera' : ''}`}
      onPointerDown={pointerDown}
      onPointerMove={pointerMove}
      onPointerUp={pointerUp}
      onPointerCancel={pointerUp}
    >
      <div className="stage-grid" aria-hidden="true" />
      {mode === 'camera' && <video ref={videoRef} muted playsInline autoPlay className={`stage-video ${settings.mirror ? 'mirrored' : ''} ${settings.showVideo ? '' : 'video-hidden'}`} />}
      {mode === 'camera' && settings.showVideo && <div className="camera-overlay" aria-hidden="true" />}
      <canvas ref={canvasRef} className="game-canvas" aria-label="Área de jogo com frutas em movimento" />
      <div className="stage-top-left"><span className="live-dot" /> {mode === 'camera' ? `CÂMERA ATIVA · ${handCount} ${handCount === 1 ? 'MÃO' : 'MÃOS'}` : 'MODO MOUSE · ARCADE'}</div>
      <div className="stage-top-right">KATANA / MOTION <span>001</span></div>
      <div className="stage-bottom-left">{mode === 'camera' ? 'MOVA O INDICADOR PARA CORTAR' : 'CLIQUE E ARRASTE PARA CORTAR'} <span>✳</span></div>
      <div className="stage-bottom-right">VISUAL ENGINE / 60 FPS TARGET</div>
    </div>
  );
}
