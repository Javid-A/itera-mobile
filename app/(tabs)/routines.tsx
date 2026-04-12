import { StyleSheet, Text } from 'react-native';
import ScreenContainer from '../../components/ScreenContainer';
import { Colors, Typography } from '../../constants';

export default function RoutinesScreen() {
  return (
    <ScreenContainer style={styles.center}>
      <Text style={[Typography.h2, { color: Colors.textPrimary }]}>Routines</Text>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
