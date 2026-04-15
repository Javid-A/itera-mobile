import { useEffect, useRef, useState } from 'react';
import { Image, View } from 'react-native';

const FRAME_W = 153;
const FRAME_H = 258;
const IDLE_FRAMES = 15;
const WALK_FRAMES = 15;
const DISPLAY_W = 59;
const DISPLAY_H = 100;
const SCALE = DISPLAY_W / FRAME_W;

export type Direction = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';

const DIRECTION_RING: Direction[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];
const DIR_STEP_MS = 120; // ms per 45° step

// Directions that are horizontal mirrors of another direction
const MIRRORED_FROM: Partial<Record<Direction, Direction>> = {
  sw: 'se',
  w: 'e',
  nw: 'ne',
};

const IDLE: Record<Direction, any> = {
  s:  require('../assets/idle_s.png'),
  se: require('../assets/idle_se.png'),
  e:  require('../assets/idle_e.png'),
  ne: require('../assets/idle_ne.png'),
  n:  require('../assets/idle_n.png'),
  sw: require('../assets/idle_se.png'), // mirrored from se
  w:  require('../assets/idle_e.png'),  // mirrored from e
  nw: require('../assets/idle_ne.png'), // mirrored from ne
};

const WALK: Record<Direction, any> = {
  s:  require('../assets/walk_s.png'),
  se: require('../assets/walk_se.png'),
  e:  require('../assets/walk_e.png'),
  ne: require('../assets/walk_ne.png'),
  n:  require('../assets/walk_n.png'),
  sw: require('../assets/walk_se.png'), // mirrored from se
  w:  require('../assets/walk_e.png'),  // mirrored from e
  nw: require('../assets/walk_ne.png'), // mirrored from ne
};

interface Props {
  isWalking?: boolean;
  scale?: number;
  direction?: Direction;
}

export default function CharacterSprite({ isWalking = false, scale = 1, direction = 's' }: Props) {
  const [frame, setFrame] = useState(0);
  const frameRef = useRef(0);
  // displayDir: the direction currently shown — steps toward `direction` prop
  const [displayDir, setDisplayDir] = useState<Direction>(direction);
  const displayDirRef = useRef<Direction>(direction);

  const totalFrames = isWalking ? WALK_FRAMES : IDLE_FRAMES;
  const fps = isWalking ? 12 : 8;

  useEffect(() => {
    frameRef.current = 0;
    setFrame(0);
  }, [isWalking]);

  useEffect(() => {
    const interval = setInterval(() => {
      frameRef.current = (frameRef.current + 1) % totalFrames;
      setFrame(frameRef.current);
    }, 1000 / fps);
    return () => clearInterval(interval);
  }, [totalFrames, fps]);

  // Step through intermediate directions instead of snapping instantly
  useEffect(() => {
    if (direction === displayDirRef.current) return;

    const stepTimer = setInterval(() => {
      const curIdx = DIRECTION_RING.indexOf(displayDirRef.current);
      const tgtIdx = DIRECTION_RING.indexOf(direction);
      if (curIdx === tgtIdx) {
        clearInterval(stepTimer);
        return;
      }
      // Shortest rotation: clockwise or counter-clockwise
      let diff = tgtIdx - curIdx;
      if (diff > 4) diff -= 8;
      if (diff < -4) diff += 8;
      const nextIdx = (curIdx + (diff > 0 ? 1 : -1) + 8) % 8;
      const nextDir = DIRECTION_RING[nextIdx];
      displayDirRef.current = nextDir;
      setDisplayDir(nextDir);
    }, DIR_STEP_MS);

    return () => clearInterval(stepTimer);
  }, [direction]);

  const mirrored = displayDir in MIRRORED_FROM;
  const sourceDir = MIRRORED_FROM[displayDir] ?? displayDir;
  const sprite = isWalking ? WALK[sourceDir] : IDLE[sourceDir];

  const scaledW = DISPLAY_W * scale;
  const scaledH = DISPLAY_H * scale;
  const sheetWidth = totalFrames * FRAME_W * SCALE * scale;

  return (
    <View
      style={{
        width: scaledW,
        height: scaledH,
        overflow: 'hidden',
        transform: mirrored ? [{ scaleX: -1 }] : [],
      }}
    >
      <Image
        source={sprite}
        style={{
          width: sheetWidth,
          height: scaledH,
          transform: [{ translateX: -frame * scaledW }],
        }}
        resizeMode="stretch"
      />
    </View>
  );
}
