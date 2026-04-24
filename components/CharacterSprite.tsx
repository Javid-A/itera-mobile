import { useEffect, useRef, useState } from "react";
import { Image, View } from "react-native";

const FRAME_SIZE = 128;

const IDLE_FRAMES = 67;
const IDLE_COLS = 8;
const IDLE_ROWS = 9;

const WALK_FRAMES = 15;
const WALK_COLS = 5;
const WALK_ROWS = 3;

// Blender 30 FPS: idle exported every 3 frames → 10 FPS; walk every 2 frames → 15 FPS
const IDLE_FRAME_DURATION = (1000 / 30) * 3;
const WALK_FRAME_DURATION = (1000 / 30) * 2;

export type Direction = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";

export const DIRECTION_RING: Direction[] = [
  "n",
  "ne",
  "e",
  "se",
  "s",
  "sw",
  "w",
  "nw",
];

// Mirrored pairs: ne/e/se are horizontal flips of nw/w/sw
const MIRRORED_FROM: Partial<Record<Direction, Direction>> = {
  ne: "nw",
  e: "w",
  se: "sw",
};

const IDLE: Record<string, any> = {
  n: require("../assets/idle_n.png"),
  nw: require("../assets/idle_nw.png"),
  w: require("../assets/idle_w.png"),
  sw: require("../assets/idle_sw.png"),
  s: require("../assets/idle_s.png"),
};

const WALK: Record<string, any> = {
  n: require("../assets/walk_n.png"),
  nw: require("../assets/walk_nw.png"),
  w: require("../assets/walk_w.png"),
  sw: require("../assets/walk_sw.png"),
  s: require("../assets/walk_s.png"),
};

export function bearingToDirection(relativeBearing: number): Direction {
  const normalized = ((relativeBearing % 360) + 360) % 360;
  const index = Math.round(normalized / 45) % 8;
  return DIRECTION_RING[index];
}

interface Props {
  isWalking?: boolean;
  displaySize?: number;
  direction?: Direction;
}

export default function CharacterSprite({
  isWalking = false,
  displaySize = 80,
  direction = "s",
}: Props) {
  const [frame, setFrame] = useState(0);
  const frameRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(Date.now());

  const totalFrames = isWalking ? WALK_FRAMES : IDLE_FRAMES;
  const cols = isWalking ? WALK_COLS : IDLE_COLS;
  const rows = isWalking ? WALK_ROWS : IDLE_ROWS;

  useEffect(() => {
    frameRef.current = 0;
    setFrame(0);
    startRef.current = Date.now();
  }, [isWalking]);

  useEffect(() => {
    const frameDuration = isWalking ? WALK_FRAME_DURATION : IDLE_FRAME_DURATION;
    const loop = () => {
      const elapsed = Date.now() - startRef.current;
      const nextFrame = Math.floor(elapsed / frameDuration) % totalFrames;
      if (nextFrame !== frameRef.current) {
        frameRef.current = nextFrame;
        setFrame(nextFrame);
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [totalFrames, isWalking]);

  const mirrored = direction in MIRRORED_FROM;
  const sourceDir = MIRRORED_FROM[direction] ?? direction;
  const sprite = isWalking ? WALK[sourceDir] : IDLE[sourceDir];

  const col = frame % cols;
  const row = Math.floor(frame / cols);
  const imgWidth = cols * displaySize;
  const imgHeight = rows * displaySize;

  // 2 bumps per cycle; amplitude scales with displaySize so bob stays visible at any zoom
  const bobAmplitude = displaySize * 0.018;
  const bobPhase = isWalking
    ? Math.sin((frame / WALK_FRAMES) * Math.PI * 4)
    : Math.sin((frame / IDLE_FRAMES) * Math.PI * 2);
  const bobY = isWalking ? bobPhase * bobAmplitude : 0;

  // Shadow shrinks when character rises, grows when it steps down; idle gets a slow breath
  const shadowScale = isWalking ? 1 + bobPhase * 0.08 : 1 + bobPhase * 0.05;

  const spriteTransform: any[] = [{ translateY: bobY }];
  if (mirrored) spriteTransform.push({ scaleX: -1 });

  return (
    <View
      collapsable={false}
      style={{ width: displaySize, height: displaySize }}
    >
      {/* Zero-size anchor centered at the foot point; each oval uses negative
          top/left = -(dimension/2) so it's always centered on the same pixel */}
      <View
        style={{
          position: "absolute",
          bottom: displaySize * 0.19,
          alignSelf: "center",
          width: 0,
          height: 0,
          transform: [{ scale: shadowScale }],
        }}
      >
        {[
          { w: 0.34, h: 0.078, opacity: 0.05 },
          { w: 0.22, h: 0.056, opacity: 0.12 },
          { w: 0.1, h: 0.034, opacity: 0.28 },
        ].map(({ w, h, opacity }, i) => (
          <View
            key={i}
            style={{
              position: "absolute",
              width: displaySize * w,
              height: displaySize * h,
              borderRadius: 999,
              backgroundColor: `rgba(0, 0, 0, ${opacity})`,
              top: -(displaySize * h) / 2,
              left: -(displaySize * w) / 2,
            }}
          />
        ))}
      </View>
      {/* Sprite: bob + mirror applied here only so shadow stays grounded */}
      <View
        style={{
          width: displaySize,
          height: displaySize,
          overflow: "hidden",
          transform: spriteTransform,
        }}
      >
        <Image
          source={sprite}
          style={{
            width: imgWidth,
            height: imgHeight,
            transform: [
              { translateX: -col * displaySize },
              { translateY: -row * displaySize },
            ],
          }}
          resizeMode="stretch"
        />
      </View>
    </View>
  );
}
