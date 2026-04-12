import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '../../constants/colors';

export default function RoutinesScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Routines</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: Colors.textPrimary,
    fontSize: 18,
  },
});
