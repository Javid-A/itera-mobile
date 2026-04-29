import { Ionicons } from '@expo/vector-icons';

type IoniconName = keyof typeof Ionicons.glyphMap;

const ICON_MAP: Record<string, IoniconName> = {
  briefcase: 'briefcase',
  barbell: 'barbell',
  cafe: 'cafe',
  star: 'star',
  home: 'home',
  school: 'school',
};

export function getMissionIconName(iconType: string): IoniconName {
  return ICON_MAP[iconType] ?? 'location';
}
