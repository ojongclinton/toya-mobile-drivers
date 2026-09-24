import React, { useEffect, useState, useCallback, useRef } from "react";
import { Text, View, StyleSheet, ScrollView, Animated, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon } from "react-native-paper";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "expo-router";
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { useTranslation } from "react-i18next";

import { Colors } from "@/constants/Colors";
import BASE_URL from "@/constants/api/BASE_URL";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);



export default function MyStatistics({ navigation }: { navigation: any }) {
  const { t } = useTranslation();
  const progressAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const [statistics, setStatistics] = useState({
    totalRides: 0,
    totalSpent: 0,
    averageRating: 0,
  });

  const [grades, setGrades] = useState({
    current: "Standard",
    next: "Bronze",
    revenue: 0,
    reviews: 0,
    referrals: 0,
    percentageToNext: 0,
    percentageRemaining: 100,
  });

  const [gradeOrder, setGradeOrder] = useState<string[]>([]);

  type CriterionDetail = { current: number; required: number; percentage: number; achieved: boolean };
  const [detailedProgress, setDetailedProgress] = useState<{
    total_count_rides: CriterionDetail;
    revenue: CriterionDetail;
    rating: CriterionDetail;
    referrals_count: CriterionDetail;
  } | null>(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    navigation.setOptions({ tabBarStyle: { display: "none" } });
    return () => navigation.setOptions({ tabBarStyle: { display: "flex" } });
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      fadeAnim.setValue(0);
      progressAnim.setValue(0);
      fetchData();
    }, [])
  );

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem("authToken");
      const headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      };

      const res = await fetch(`${BASE_URL}/drivers/grades/evolution`, { headers });
      const json = await res.json();


      const current = json["Current Position"];
      const nextPos  = json["Next Position"];
      const curData  = current?.Data ?? {};

      setStatistics({
        totalRides:    curData.total_count_rides ?? 0,
        totalSpent:    curData.revenue           ?? 0,
        averageRating: curData.rating            ?? 0,
      });

      setGradeOrder((json.grades ?? []).map((g: { name: string }) => g.name));
      setDetailedProgress(current?.detailed_progress ?? null);

      const isMaxGrade = !nextPos?.grade;
      const nextGrade  = isMaxGrade ? (curData.grade ?? "Platinum") : (nextPos?.grade ?? "Bronze");
      const percentage = isMaxGrade ? 100 : (current?.percentage_to_next_grade ?? 0);

      setGrades({
        current:            json.current_grade?.name ?? curData.grade ?? "Standard",
        next:               nextGrade,
        revenue:            curData.revenue          ?? 0,
        reviews:            curData.reviews          ?? 0,
        referrals:          curData.referrals_count  ?? 0,
        percentageToNext:   percentage,
        percentageRemaining: isMaxGrade ? 0 : Math.max(0, 100 - percentage),
      });

      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }).start();

      Animated.timing(progressAnim, {
        toValue: Math.min(100, percentage),
        duration: 1500,
        useNativeDriver: false,
      }).start();
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  };

  // Circle progress calculations
  const size = 130;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;

  const strokeDashoffset = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: [circumference, 0],
  });

  // Format number with spaces
  const formatNumber = (num: number) => {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  };

  if (loading) {
    return (
      <LinearGradient colors={['#fefefe', '#f8f8f8']} style={[styles.gradient, { justifyContent: 'center', alignItems: 'center' }]}>
        <Icon source="chart-bar" size={40} color={Colors.light.tint} />
        <Text style={{ marginTop: 12, color: '#666', fontSize: 14 }}>{t("loading")}</Text>
      </LinearGradient>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <View style={navStyles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={navStyles.backBtn}>
          <Icon source="arrow-left" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={navStyles.title}>{t("my_statistics")}</Text>
        <View style={navStyles.spacer} />
      </View>
    <LinearGradient
      colors={['#fefefe', '#f8f8f8']}
      style={styles.gradient}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        persistentScrollbar={true}
      >
        <Animated.View style={[styles.container, { opacity: fadeAnim }]}>

          {/* Progress Section with Circle */}
          <View style={styles.progressSection}>
            <Text style={styles.progressTitle}>{t("progress_towards")} {grades.next}</Text>

            <View style={styles.circleContainer}>
              <Svg width={size} height={size}>
                <Defs>
                  <SvgLinearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <Stop offset="0%" stopColor={Colors.light.gold} />
                    <Stop offset="100%" stopColor="#FFA500" />
                  </SvgLinearGradient>
                </Defs>

                <Circle
                  stroke="#e8e8e8"
                  fill="none"
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  strokeWidth={strokeWidth}
                />
                <AnimatedCircle
                  stroke="url(#goldGradient)"
                  fill="none"
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${circumference} ${circumference}`}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  rotation="-90"
                  origin={`${size / 2}, ${size / 2}`}
                />
              </Svg>

              <View style={styles.circleCenter}>
                <Text style={styles.circlePercent}>{Math.round(grades.percentageToNext)}%</Text>
                <Text style={styles.circleLabel}>{grades.current}</Text>
              </View>
            </View>

            {/* {grades.percentageToNext === 100 ? (
              <Text style={styles.nextGradeInfo}>
                🏆 <Text style={styles.nextGradeName}>{t("grade_platinum")}</Text> — {t("current_grade")}
              </Text>
            ) : (
              <Text style={styles.nextGradeInfo}>
                {t("to_reach_grade")} <Text style={styles.nextGradeName}>{grades.next}</Text>
                {" "}<Text style={styles.nextGradeHighlight}>{grades.percentageRemaining}%</Text>
              </Text>
            )} */}
          </View>

          {/* Jauges par critère */}
          {detailedProgress && (
            <View style={styles.gaugesSection}>
              <Text style={styles.gaugesSectionTitle}>{t("progress_by_criteria")}</Text>
              {[
                {
                  key: "total_count_rides",
                  icon: "car-side",
                  label: t("rides_label"),
                  color: "#6D56F2",
                  bg: "rgba(109, 86, 242, 0.1)",
                  current: detailedProgress.total_count_rides?.current ?? 0,
                  required: detailedProgress.total_count_rides?.required ?? 0,
                  pct: Math.min(100, detailedProgress.total_count_rides?.percentage ?? 0),
                },
                {
                  key: "revenue",
                  icon: "cash-multiple",
                  label: "XAF",
                  color: "#22c55e",
                  bg: "rgba(34, 197, 94, 0.1)",
                  current: detailedProgress.revenue?.current ?? 0,
                  required: detailedProgress.revenue?.required ?? 0,
                  pct: Math.min(100, detailedProgress.revenue?.percentage ?? 0),
                },
                {
                  key: "rating",
                  icon: "star",
                  label: t("average_rating"),
                  color: "#FFC107",
                  bg: "rgba(255, 193, 7, 0.15)",
                  current: detailedProgress.rating?.current ?? 0,
                  required: detailedProgress.rating?.required ?? 0,
                  pct: Math.min(100, detailedProgress.rating?.percentage ?? 0),
                },
                {
                  key: "referrals_count",
                  icon: "account-multiple-plus",
                  label: t("referrals_label"),
                  color: "#3b82f6",
                  bg: "rgba(59, 130, 246, 0.1)",
                  current: detailedProgress.referrals_count?.current ?? 0,
                  required: detailedProgress.referrals_count?.required ?? 0,
                  pct: Math.min(100, detailedProgress.referrals_count?.percentage ?? 0),
                },
              ].map((item) => (
                <View key={item.key} style={styles.gaugeRow}>
                  <View style={[styles.gaugeIconWrap, { backgroundColor: item.bg }]}>
                    <Icon source={item.icon} size={16} color={item.color} />
                  </View>
                  <View style={styles.gaugeContent}>
                    <View style={styles.gaugeLabelRow}>
                      <Text style={styles.gaugeLabel}>{item.label}</Text>
                      <Text style={[styles.gaugePct, { color: item.color }]}>
                        {Math.round(item.pct)}%
                      </Text>
                    </View>
                    <View style={styles.gaugeTrack}>
                      <View style={[styles.gaugeFill, { width: `${item.pct}%` as any, backgroundColor: item.color }]} />
                    </View>
                    <Text style={styles.gaugeValues}>{item.current} / {item.required}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Statistics Section */}
          <View style={styles.statisticsSection}>
            {/* First Row */}
            <View style={styles.statsRow}>
              {/* Total Rides */}
              <View style={styles.statCard}>
                <View style={[styles.statIconContainer, { backgroundColor: 'rgba(109, 86, 242, 0.1)' }]}>
                  <Icon source="car-side" size={26} color="#6D56F2" />
                </View>
                <Text style={styles.statValue}>{formatNumber(statistics.totalRides)}</Text>
                <Text style={styles.statLabel}>{t("rides_label")}</Text>
              </View>

              {/* Revenue */}
              <View style={styles.statCard}>
                <View style={[styles.statIconContainer, { backgroundColor: 'rgba(34, 197, 94, 0.1)' }]}>
                  <Icon source="cash-multiple" size={26} color="#22c55e" />
                </View>
                <Text style={styles.statValue}>{formatNumber(statistics.totalSpent)}</Text>
                <Text style={styles.statLabel}>XAF</Text>
              </View>
            </View>

            {/* Second Row */}
            <View style={styles.statsRow}>
              {/* Average Rating */}
              <View style={styles.statCard}>
                <View style={[styles.statIconContainer, { backgroundColor: 'rgba(255, 215, 0, 0.15)' }]}>
                  <Icon source="star" size={26} color={Colors.light.gold} />
                </View>
                <Text style={styles.statValue}>{Number(statistics.averageRating).toFixed(1)}/5</Text>
                <Text style={styles.statLabel}>{t("average_rating")}</Text>
              </View>

              {/* Reviews */}
              <View style={styles.statCard}>
                <View style={[styles.statIconContainer, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                  <Icon source="comment-text-outline" size={26} color="#ef4444" />
                </View>
                <Text style={styles.statValue}>{grades.reviews}</Text>
                <Text style={styles.statLabel}>{t("reviews_label")}</Text>
              </View>
            </View>

            {/* Third Row */}
            <View style={styles.statsRow}>
              {/* Referrals */}
              <View style={styles.statCard}>
                <View style={[styles.statIconContainer, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                  <Icon source="account-multiple-plus" size={26} color="#3b82f6" />
                </View>
                <Text style={styles.statValue}>{grades.referrals}</Text>
                <Text style={styles.statLabel}>{t("referrals_label")}</Text>
              </View>

              {/* Current Grade */}
              <View style={styles.statCard}>
                <View style={[styles.statIconContainer, { backgroundColor: 'rgba(255, 165, 0, 0.15)' }]}>
                  <Icon source="trophy" size={26} color="#FFA500" />
                </View>
                <Text style={styles.statValue}>{gradeOrder.indexOf(grades.current) + 1}/{gradeOrder.length}</Text>
                <Text style={styles.statLabel}>{grades.current}</Text>
              </View>
            </View>
          </View>

        </Animated.View>
      </ScrollView>
    </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingVertical: 15,
    paddingHorizontal: 14,
  },
  container: {
    flex: 1,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  progressSection: {
    backgroundColor: '#f5f5f5',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  progressTitle: {
    fontSize: 10,
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 14,
    textAlign: 'center',
  },
  circleContainer: {
    position: 'relative',
    marginBottom: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circlePercent: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.light.gold,
  },
  circleLabel: {
    fontSize: 10,
    color: '#666',
    marginTop: 3,
  },
  nextGradeInfo: {
    marginTop: 10,
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
  },
  nextGradeHighlight: {
    fontWeight: '700',
    color: '#000',
  },
  nextGradeName: {
    color: '#6D56F2',
    fontWeight: '600',
  },
  statisticsSection: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  statisticsTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
    color: '#333',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  statIconContainer: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 17,
    fontWeight: '700',
    color: '#333',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 10,
    color: '#666',
    textAlign: 'center',
    fontWeight: '500',
  },

  // Jauges par critère
  gaugesSection: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  gaugesSectionTitle: {
    fontSize: 10,
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 14,
    textAlign: 'center',
  },
  gaugeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  gaugeIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  gaugeContent: {
    flex: 1,
  },
  gaugeLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  gaugeLabel: {
    fontSize: 11,
    color: '#333',
    fontWeight: '600',
  },
  gaugePct: {
    fontSize: 11,
    fontWeight: '700',
  },
  gaugeTrack: {
    height: 7,
    backgroundColor: '#e8e8e8',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 3,
  },
  gaugeFill: {
    height: 7,
    borderRadius: 4,
  },
  gaugeValues: {
    fontSize: 10,
    color: '#999',
  },
});

const navStyles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { padding: 4 },
  title: { flex: 1, textAlign: "center", fontSize: 23, fontWeight: "bold", color: "#333" },
  spacer: { width: 32 },
});