import React, { useEffect, useState, useCallback } from "react";
import { Text, View, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon } from "react-native-paper";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "expo-router";
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from "react-i18next";

import { Colors } from "@/constants/Colors";
import BASE_URL from "@/constants/api/BASE_URL";

type CriterionProgress = {
  current: number;
  required: number;
  percentage: number;
  achieved: boolean;
};

type ApiGrade = {
  id: number;
  name: string;
  commission_rate: number;
  bonus_amount: number;
  requirements: {
    rating: number;
    total_count_rides: number;
    revenue: number;
    referrals_count: number;
  };
  unlocked: boolean;
  current: boolean;
};

type EvolutionData = {
  percentageToNext: number;
  nextGrade: string;
  details: Record<string, CriterionProgress> | null;
};

const GRADE_ICON: Record<string, string> = {
  Standard: "star",
  Platinum: "diamond",
};
const gradeIcon = (name: string) => GRADE_ICON[name] ?? "medal";

const gradeNameKey: Record<string, string> = {
  Standard: "grade_standard",
  Bronze:   "grade_bronze",
  Silver:   "grade_silver",
  Gold:     "grade_gold",
  Platinum: "grade_platinum",
};

const formatRevenue = (n: number) =>
  n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");

export default function MyGrades({ navigation }: { navigation: any }) {
  const { t } = useTranslation();

  const [profile, setProfile] = useState({ url: "", firstName: "", lastName: "" });
  const [currentGradeName, setCurrentGradeName] = useState("Standard");
  const [apiGrades, setApiGrades] = useState<ApiGrade[]>([]);
  const [evolution, setEvolution] = useState<EvolutionData>({
    percentageToNext: 0,
    nextGrade: "Bronze",
    details: null,
  });

  useEffect(() => {
    navigation.setOptions({ tabBarStyle: { display: "none" } });
    return () => navigation.setOptions({ tabBarStyle: { display: "flex" } });
  }, [navigation]);

  useFocusEffect(
    React.useCallback(() => {
      fetchUserData();
      fetchGrades();
    }, [])
  );

  const fetchUserData = async () => {
    try {
      const info = await AsyncStorage.getItem("Info");
      if (!info) return;
      const data = JSON.parse(info);
      setProfile({
        url: data?.profile_picture ?? "",
        firstName: data?.Data?.first_name ?? "",
        lastName: data?.Data?.last_name ?? "",
      });
    } catch {
      // silently ignore
    }
  };

  const fetchGrades = async () => {
    try {
      const token = await AsyncStorage.getItem("authToken");
      const headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      };

      const res = await fetch(`${BASE_URL}/drivers/grades/evolution`, { headers });
      const json = await res.json();

      const current = json["Current Position"];
      const nextPos = json["Next Position"];
      const isMaxGrade = typeof nextPos?.Data === "string";

      setCurrentGradeName(json.current_grade?.name ?? current?.Data?.grade ?? "Standard");
      setApiGrades(json.grades ?? []);
      setEvolution({
        percentageToNext: current?.percentage_to_next_grade ?? 0,
        nextGrade: isMaxGrade ? "Platinum" : (nextPos?.grade ?? "Bronze"),
        details: isMaxGrade ? null : (current?.detailed_progress ?? null),
      });
    } catch {
      // silently ignore
    }
  };


  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <View style={navStyles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={navStyles.backBtn}>
          <Icon source="arrow-left" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={navStyles.title}>{t("my_grades")}</Text>
        <View style={navStyles.spacer} />
      </View>
    <LinearGradient
      colors={['#fefefe', '#f8f8f8']}
      style={styles.gradient}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          
          {/* Introduction Texts */}
          <View style={styles.introSection}>
            <Text style={styles.introText}>
              {t("grades_intro_text")}
            </Text>
            <Text style={styles.introTextHighlight}>
              {t("grades_commission_highlight")}
            </Text>
          </View>

          {/* Header Section */}
          <View style={styles.header}>
            <Text style={styles.driverName} numberOfLines={1} adjustsFontSizeToFit>
              {profile.firstName} {profile.lastName}
            </Text>
            <View style={styles.currentGradeBadge}>
              <Text style={styles.badgeText}>{currentGradeName}</Text>
            </View>
          </View>

          {/* Grades List */}
          <View style={styles.gradesList}>
            <Text style={styles.gradesTitle}>{t("your_achievements")}</Text>

            {apiGrades.map((grade) => {
              const isStandard = grade.requirements.total_count_rides === 0
                && grade.requirements.revenue === 0
                && grade.requirements.rating === 0;
              return (
                <View
                  key={grade.id}
                  style={[
                    styles.gradeItem,
                    grade.unlocked && styles.gradeItemUnlocked,
                    grade.current && styles.gradeItemCurrent,
                  ]}
                >
                  <View style={styles.gradeIcon}>
                    <Icon
                      source={gradeIcon(grade.name)}
                      size={20}
                      color={grade.unlocked ? Colors.light.gold : '#666'}
                    />
                  </View>
                  <View style={styles.gradeInfoExpanded}>
                    <Text style={[styles.gradeName, grade.current && styles.gradeNameCurrent]}>
                      {t(gradeNameKey[grade.name] ?? grade.name)}
                    </Text>

                    <View style={styles.requirementsRow}>
                      {!isStandard && (
                        <>
                          {grade.requirements.total_count_rides > 0 && (
                            <>
                              <Icon source="car" size={8} color="#666" />
                              <Text style={styles.requirementText}>
                                {grade.requirements.total_count_rides} {t("rides")}
                              </Text>
                              <Text style={styles.separator}>•</Text>
                            </>
                          )}
                          {grade.requirements.revenue > 0 && (
                            <>
                              <Icon source="cash" size={8} color="#666" />
                              <Text style={styles.requirementText}>
                                {formatRevenue(grade.requirements.revenue)} FCFA
                              </Text>
                              <Text style={styles.separator}>•</Text>
                            </>
                          )}
                          {grade.requirements.rating > 0 && (
                            <>
                              <View style={styles.starsContainer}>
                                {Array.from({ length: Math.round(grade.requirements.rating) }).map((_, i) => (
                                  <Icon key={i} source="star" size={8} color={Colors.light.gold} />
                                ))}
                              </View>
                              <Text style={styles.separator}>•</Text>
                            </>
                          )}
                        </>
                      )}
                      <Text style={styles.requirementText}>
                        {grade.commission_rate}% {t("commission")}
                      </Text>
                    </View>

                    {!isStandard && grade.requirements.referrals_count > 0 && (
                      <View style={styles.sponsorshipRow}>
                        <Icon source="account-multiple" size={8} color="#666" />
                        <Text style={styles.requirementText}>
                          {grade.requirements.referrals_count}{" "}
                          {grade.requirements.referrals_count <= 1 ? t("sponsorship") : t("sponsorships")}
                        </Text>
                      </View>
                    )}

                    <Text style={[styles.gradeStatus, grade.unlocked && styles.gradeStatusUnlocked]}>
                      {grade.current
                        ? t("current_grade")
                        : grade.unlocked
                        ? t("unlocked")
                        : t("to_unlock")}
                    </Text>
                  </View>
                  {grade.unlocked && (
                    <View style={styles.checkmarkContainer}>
                      <View style={styles.checkmark}>
                        <Icon source="check" size={11} color="#0f0f0f" />
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </View>

        </View>
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
  introSection: {
    marginBottom: 14,
    paddingHorizontal: 8,
  },
  introText: {
    fontSize: 12,
    color: '#000',
    textAlign: 'center',
    lineHeight: 17,
    marginBottom: 8,
    fontWeight: '500',
  },
  introTextHighlight: {
    fontSize: 12,
    color: '#000',
    textAlign: 'center',
    lineHeight: 17,
    fontWeight: '600',
  },
  header: {
    alignItems: 'center',
    marginBottom: 18,
    backgroundColor: '#6D56F2',
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderRadius: 16,
  },
  profileImageContainer: {
    marginBottom: 10,
  },
  profileImage: {
    width: 65,
    height: 65,
    borderRadius: 32.5,
    borderWidth: 3,
    borderColor: '#fff',
  },
  driverName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 7,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  currentGradeBadge: {
    paddingVertical: 5,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 2,
    borderColor: '#fff',
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  evolutionSection: {
    width: '100%',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  evolutionTitle: {
    fontSize: 10,
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
    textAlign: 'center',
    fontWeight: '600',
  },
  criterionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  criterionInfo: {
    flex: 1,
  },
  criterionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  criterionLabel: {
    fontSize: 10,
    color: '#333',
    fontWeight: '500',
  },
  criterionValues: {
    fontSize: 10,
    color: '#666',
  },
  barTrack: {
    height: 5,
    backgroundColor: '#e0e0e0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: 5,
    borderRadius: 3,
  },
  gradesList: {
    width: '100%',
  },
  gradesTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
    color: '#333',
  },
  gradeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#d0d0d0',
    minHeight: 70,
  },
  gradeItemUnlocked: {
    borderColor: 'rgba(255, 215, 0, 0.5)',
    backgroundColor: 'rgba(255, 215, 0, 0.08)',
  },
  gradeItemCurrent: {
    borderColor: '#6D56F2',
    borderWidth: 2,
    backgroundColor: 'rgba(109, 86, 242, 0.08)',
  },
  gradeIcon: {
    width: 32,
    height: 32,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradeInfoExpanded: {
    flex: 1,
  },
  gradeName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 3,
    color: '#000',
  },
  gradeNameCurrent: {
    color: '#6D56F2',
  },
  requirementsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
    gap: 2,
    marginBottom: 3,
  },
  sponsorshipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginBottom: 3,
    marginTop: 1,
  },
  requirementText: {
    fontSize: 8,
    color: '#666',
    fontWeight: '500',
  },
  separator: {
    fontSize: 7,
    color: '#999',
    marginHorizontal: 1,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 0.5,
  },
  gradeStatus: {
    fontSize: 8,
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginTop: 1,
  },
  gradeStatusUnlocked: {
    color: Colors.light.gold,
  },
  checkmarkContainer: {
    alignSelf: 'flex-start',
    marginLeft: 6,
  },
  checkmark: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.light.gold,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

const navStyles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { padding: 4 },
  title: { flex: 1, textAlign: "center", fontSize: 23, fontWeight: "bold", color: "#333" },
  spacer: { width: 32 },
});