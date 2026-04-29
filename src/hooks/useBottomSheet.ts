import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, BackHandler, PanResponder, type PanResponderInstance } from 'react-native';

interface UseBottomSheetOptions {
  collapsedHeight: number;
  expandedHeight: number;
}

interface UseBottomSheetResult {
  sheetY: Animated.Value;
  isExpanded: boolean;
  snap: (open: boolean) => void;
  panHandlers: PanResponderInstance['panHandlers'];
  backdropOpacity: Animated.AnimatedInterpolation<number>;
  dragRange: number;
}

export function useBottomSheet({
  collapsedHeight,
  expandedHeight,
}: UseBottomSheetOptions): UseBottomSheetResult {
  const dragRange = expandedHeight - collapsedHeight;
  const [isExpanded, setIsExpanded] = useState(false);

  const sheetY = useRef(new Animated.Value(dragRange)).current;
  const sheetYVal = useRef(dragRange);
  const gestureStartY = useRef(dragRange);

  useEffect(() => {
    const id = sheetY.addListener(({ value }) => {
      sheetYVal.current = value;
    });
    return () => sheetY.removeListener(id);
  }, [sheetY]);

  const snap = useCallback(
    (open: boolean) => {
      setIsExpanded(open);
      Animated.spring(sheetY, {
        toValue: open ? 0 : dragRange,
        useNativeDriver: false,
        tension: 65,
        friction: 11,
      }).start();
    },
    [sheetY, dragRange],
  );

  // Hardware back closes an open sheet first.
  useEffect(() => {
    const onBackPress = () => {
      if (isExpanded) {
        snap(false);
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [isExpanded, snap]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 4,
      onPanResponderGrant: () => {
        gestureStartY.current = sheetYVal.current;
      },
      onPanResponderMove: (_, gs) => {
        const next = Math.max(0, Math.min(dragRange, gestureStartY.current + gs.dy));
        sheetY.setValue(next);
      },
      onPanResponderRelease: (_, { dy, vy }) => {
        if (Math.abs(dy) < 6) {
          const currentlyExpanded = sheetYVal.current < dragRange / 2;
          snap(!currentlyExpanded);
          return;
        }
        const current = sheetYVal.current;
        const fastUp = vy < -0.5;
        const fastDown = vy > 0.5;
        const pastMid = current < dragRange / 2;
        snap(fastUp || (!fastDown && pastMid));
      },
    }),
  ).current;

  const backdropOpacity = sheetY.interpolate({
    inputRange: [0, dragRange],
    outputRange: [0.45, 0],
  });

  return {
    sheetY,
    isExpanded,
    snap,
    panHandlers: panResponder.panHandlers,
    backdropOpacity,
    dragRange,
  };
}
