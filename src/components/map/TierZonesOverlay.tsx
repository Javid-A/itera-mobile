import { StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import {
  TIER_COLORS,
  cTierThresholdLabel,
  xpForTier,
} from "../../config/tierConfig";
import {
  ShapeSource,
  FillLayer,
  LineLayer,
  MarkerView,
} from "../../services/mapbox";
import type { TierZones } from "../../utils/tierZones";

interface Props {
  zones: TierZones;
}

// A/B/C tier çevre daireleri, radyal C degrade ve floating tier etiketleri.
export default function TierZonesOverlay({ zones }: Props) {
  return (
    <>
      {zones.C_gradient.map((stop, i) => (
        <ShapeSource
          key={`tierCGrad-${i}`}
          id={`tierCGrad-${i}`}
          shape={stop.feature}
        >
          <FillLayer
            id={`tierCGradFill-${i}`}
            style={{
              fillColor: TIER_COLORS.C,
              fillOpacity: stop.opacity,
              fillAntialias: true,
            }}
          />
        </ShapeSource>
      ))}
      <ShapeSource id="tierACircle" shape={zones.A}>
        <FillLayer
          id="tierAFill"
          style={{ fillColor: TIER_COLORS.A, fillOpacity: 0.12 }}
        />
      </ShapeSource>
      <ShapeSource id="tierBBorder" shape={zones.B}>
        <LineLayer
          id="tierBHalo"
          style={{
            lineColor: TIER_COLORS.B,
            lineWidth: 24,
            lineOpacity: 0.15,
            lineBlur: 14,
          }}
        />
        <LineLayer
          id="tierBGlow"
          style={{
            lineColor: TIER_COLORS.B,
            lineWidth: 8,
            lineOpacity: 0.45,
            lineBlur: 4,
          }}
        />
        <LineLayer
          id="tierBMain"
          style={{
            lineColor: TIER_COLORS.B,
            lineWidth: 1.5,
            lineOpacity: 0.95,
            lineDasharray: [8, 4],
          }}
        />
      </ShapeSource>
      <ShapeSource id="tierABorder" shape={zones.A}>
        <LineLayer
          id="tierAHalo"
          style={{
            lineColor: TIER_COLORS.A,
            lineWidth: 22,
            lineOpacity: 0.12,
            lineBlur: 14,
          }}
        />
        <LineLayer
          id="tierAGlow"
          style={{
            lineColor: TIER_COLORS.A,
            lineWidth: 7,
            lineOpacity: 0.35,
            lineBlur: 4,
          }}
        />
        <LineLayer
          id="tierAMain"
          style={{
            lineColor: TIER_COLORS.A,
            lineWidth: 1.5,
            lineOpacity: 0.95,
            lineDasharray: [8, 4],
          }}
        />
      </ShapeSource>

      <MarkerView coordinate={zones.A_label} anchor={{ x: 0, y: 0.5 }}>
        <View style={styles.badgeWrapper} pointerEvents="none">
          <View style={styles.tailLeftA} />
          <BlurView intensity={25} tint="dark" style={styles.tierABody}>
            <LinearGradient
              colors={["rgba(166, 230, 53, 0.2)", "rgba(10, 18, 38, 0.8)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.tierInner}
            >
              <View
                style={[styles.tierBadgeDot, { backgroundColor: TIER_COLORS.A }]}
              />
              <Text style={[styles.tierBadgeLabel, { color: TIER_COLORS.A }]}>
                A
              </Text>
              <Text style={styles.tierBadgeXP}>{xpForTier("A")} XP</Text>
            </LinearGradient>
          </BlurView>
        </View>
      </MarkerView>

      <MarkerView coordinate={zones.B_label} anchor={{ x: 0, y: 0.5 }}>
        <View
          style={[
            styles.badgeWrapper,
            {
              shadowColor: TIER_COLORS.B,
              shadowOpacity: 0.5,
              shadowRadius: 10,
              elevation: 4,
            },
          ]}
          pointerEvents="none"
        >
          <View style={styles.tailLeftB} />
          <BlurView intensity={40} tint="dark" style={styles.tierBBody}>
            <LinearGradient
              colors={["rgba(34, 211, 238, 0.3)", "rgba(10, 18, 38, 0.85)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.tierInner}
            >
              <View
                style={[
                  styles.tierBadgeDot,
                  {
                    backgroundColor: TIER_COLORS.B,
                    shadowColor: TIER_COLORS.B,
                    shadowOpacity: 1,
                    shadowRadius: 5,
                  },
                ]}
              />
              <Text
                style={[
                  styles.tierBadgeLabel,
                  {
                    color: TIER_COLORS.B,
                    textShadowColor: "rgba(34, 211, 238, 0.6)",
                    textShadowRadius: 6,
                  },
                ]}
              >
                B
              </Text>
              <Text style={styles.tierBadgeXP}>{xpForTier("B")} XP</Text>
            </LinearGradient>
          </BlurView>
        </View>
      </MarkerView>

      <MarkerView coordinate={zones.C_label} anchor={{ x: 0, y: 0.5 }}>
        <View style={styles.badgeWrapper} pointerEvents="none">
          <View style={styles.tailLeftC} />
          <View style={styles.cTooltipGlowContainer}>
            <BlurView intensity={60} tint="dark" style={styles.cTooltipBody}>
              <LinearGradient
                colors={["rgba(168, 85, 247, 0.4)", "rgba(10, 18, 38, 0.9)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.cTooltipInner}
              >
                <Text style={styles.cTooltipText}>
                  {cTierThresholdLabel()} ({xpForTier("C")} XP)
                </Text>
              </LinearGradient>
            </BlurView>
          </View>
        </View>
      </MarkerView>
    </>
  );
}

const styles = StyleSheet.create({
  badgeWrapper: {
    flexDirection: "row",
    alignItems: "center",
  },
  tierABody: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(166, 230, 53, 0.2)",
    overflow: "hidden",
  },
  tierBBody: {
    borderRadius: 12,
    borderWidth: 1.5,
    borderTopColor: "rgba(34, 211, 238, 0.6)",
    borderLeftColor: "rgba(34, 211, 238, 0.4)",
    borderRightColor: "rgba(34, 211, 238, 0.1)",
    borderBottomColor: "rgba(34, 211, 238, 0.1)",
    overflow: "hidden",
  },
  tierInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  tailLeftA: {
    width: 0,
    height: 0,
    borderTopWidth: 4,
    borderBottomWidth: 4,
    borderRightWidth: 6,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
    borderRightColor: "rgba(166, 230, 53, 0.3)",
  },
  tailLeftB: {
    width: 0,
    height: 0,
    borderTopWidth: 5,
    borderBottomWidth: 5,
    borderRightWidth: 7,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
    borderRightColor: "rgba(34, 211, 238, 0.6)",
  },
  tailLeftC: {
    width: 0,
    height: 0,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderRightWidth: 8,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
    borderRightColor: "rgba(168, 85, 247, 0.8)",
    shadowColor: "#A855F7",
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  tierBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 4,
    elevation: 2,
  },
  tierBadgeLabel: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 14,
    letterSpacing: 1.2,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 3,
    textShadowColor: "rgba(255, 255, 255, 0.3)",
  },
  tierBadgeXP: {
    fontFamily: "Rajdhani_600SemiBold",
    fontSize: 12,
    color: "#8B95A5",
    letterSpacing: 0.5,
    marginLeft: 2,
  },
  cTooltipGlowContainer: {
    shadowColor: "#A855F7",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 16,
    elevation: 10,
    borderRadius: 16,
  },
  cTooltipBody: {
    borderRadius: 16,
    borderWidth: 1.5,
    borderTopColor: "rgba(168, 85, 247, 0.9)",
    borderLeftColor: "rgba(168, 85, 247, 0.7)",
    borderRightColor: "rgba(168, 85, 247, 0.1)",
    borderBottomColor: "rgba(168, 85, 247, 0.05)",
    overflow: "hidden",
  },
  cTooltipInner: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.2)",
    borderLeftColor: "rgba(255, 255, 255, 0.1)",
    borderRightColor: "rgba(255, 255, 255, 0.02)",
    borderBottomColor: "rgba(255, 255, 255, 0.02)",
    borderRadius: 14.5,
  },
  cTooltipText: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 15,
    letterSpacing: 0.6,
    color: "#FFFFFF",
    textShadowColor: "rgba(168, 85, 247, 1)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
});
