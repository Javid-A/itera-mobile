import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Returns extra bottom padding to keep content above the on-screen keyboard.
// Works in edge-to-edge mode where windowSoftInputMode=adjustResize no longer
// shrinks the window, so KeyboardAvoidingView can't compute the gap itself.
// Subtracts the bottom safe-area inset because the keyboard reports its full
// height including the gesture nav area, which is already accounted for.
export function useKeyboardBottomInset(): number {
  const insets = useSafeAreaInsets();
  const [kbHeight, setKbHeight] = useState(0);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvt, (e) => {
      setKbHeight(e.endCoordinates?.height ?? 0);
    });
    const hideSub = Keyboard.addListener(hideEvt, () => setKbHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return Math.max(0, kbHeight - insets.bottom);
}
