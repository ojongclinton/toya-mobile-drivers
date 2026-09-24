import React, { useEffect, useState, useCallback, useRef } from "react";
import { Image, Text, View, StyleSheet, ScrollView, Animated } from "react-native";
import { Icon } from "react-native-paper";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";
import { LinearGradient } from 'expo-linear-gradient';

import stylesGlobal from "../../assets/styles/global_styles";
import { Colors } from "@/constants/Colors";
import BASE_URL from "@/constants/api/BASE_URL";

export default function DriverProfileDesign1({ navigation }: { navigation: any }) {
  const { t } = useTranslation();
  const progressAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Mock data - replace with real data from API
  const [profile, setProfile] = useState({
    url: "",
    firstName: "Evrard",
    lastName: "Tchouks",
  });

  const [grades, setGrades] = useState({
    current: "Silver",
    next: "Gold",
    percentageToNext: 68,
    percentageRemaining: 32,
  });

  useEffect(() => {
    navigation.setOptions({ tabBarStyle: { display: "none" } });
    return () => navigation.setOptions({ tabBarStyle: { display: "flex" } });
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      // Animate on focus
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(progressAnim, {
          toValue: grades.percentageToNext,
          duration: 1500,
          useNativeDriver: false,
        }),
      ]).start();

      // Uncomment to fetch real data
      // fetchEvolution();
      // fetchUserData();
    }, [])
  );

  const fetchUserData = async () => {
    try {
      const info = await AsyncStorage.getItem("Info");
      if (!info) return;
      const data = JSON.parse(info);
      setProfile({
        url: data.profile_picture,
        firstName: data.Data.first_name,
        lastName: data.Data.last_name,
      });
    } catch (error) {
      console.error("Erreur lors de la récupération des infos :", error);
    }
  };

  const fetchEvolution = async () => {
    try {
      const token = await AsyncStorage.getItem("authToken");
      const response = await fetch(`${BASE_URL}/drivers/grades/evolution`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });

      const { Data } = await response.json();
      const current = Data.Evelotion["Current Position"];
      const next = Data.Evelotion["Next Position"];

      setGrades({
        current: current.Data.grade,
        next: next.grade,
        percentageToNext: current.percentage_to_next_grade,
        percentageRemaining: next.percentage_remaining_to_next_grade,
      });
    } catch (error) {
      console.error("Erreur lors de la récupération de l'évolution :", error);
    }
  };

  const gradesList = [
    { name: "Standard", icon: "star", unlocked: true },
    { name: "Bronze", icon: "medal", unlocked: true },
    { name: "Silver", icon: "medal", unlocked: true, current: true },
    { name: "Gold", icon: "medal", unlocked: false },
    { name: "Platinum", icon: "diamond", unlocked: false },
  ];

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <LinearGradient
      colors={['#0f0f0f', '#1a1a1a']}
      style={styles.gradient}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
          
          {/* Header Section */}
          <View style={styles.header}>
            <View style={styles.profileImageContainer}>
              <Image
                style={styles.profileImage}
                source={
                  profile.url
                    ? { uri: profile.url }
                    : require("../../assets/images/profile.jpg")
                }
              />
            </View>
            <Text style={styles.driverName}>
              {profile.firstName} {profile.lastName}
            </Text>
            <View style={styles.currentGradeBadge}>
              <Text style={styles.badgeText}>{grades.current}</Text>
            </View>
          </View>

          {/* Progress Section */}
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>
                {t("progression_vers") || "PROGRESSION VERS"} {grades.next}
              </Text>
              <Text style={styles.progressPercent}>{grades.percentageToNext}%</Text>
            </View>
            
            <View style={styles.progressBarContainer}>
              <Animated.View style={[styles.progressBar, { width: progressWidth }]}>
                <LinearGradient
                  colors={[Colors.light.gold, '#FFA500']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.progressGradient}
                />
              </Animated.View>
            </View>

            <Text style={styles.nextGradeInfo}>
              {t("plus_que") || "Plus que"} <Text style={styles.nextGradeHighlight}>{grades.percentageRemaining}%</Text> {t("pour_atteindre") || "pour atteindre le grade"}{" "}
              <Text style={styles.nextGradeName}>{grades.next}</Text>
            </Text>
          </View>

          {/* Grades List */}
          <View style={styles.gradesList}>
            <Text style={styles.gradesTitle}>{t("vos_realisations") || "Vos Réalisations"}</Text>
            
            {gradesList.map((grade, index) => (
              <View
                key={grade.name}
                style={[
                  styles.gradeItem,
                  grade.unlocked && styles.gradeItemUnlocked,
                  grade.current && styles.gradeItemCurrent,
                ]}
              >
                <View style={styles.gradeIcon}>
                  <Icon
                    source={grade.icon}
                    size={30}
                    color={grade.unlocked ? Colors.light.gold : '#666'}
                  />
                </View>
                <View style={styles.gradeInfo}>
                  <Text style={[
                    styles.gradeName,
                    grade.current && styles.gradeNameCurrent,
                  ]}>
                    {grade.name}
                  </Text>
                  <Text style={[
                    styles.gradeStatus,
                    grade.unlocked && styles.gradeStatusUnlocked,
                  ]}>
                    {grade.current
                      ? t("grade_actuel") || "GRADE ACTUEL"
                      : grade.unlocked
                      ? t("debloque") || "DÉBLOQUÉ"
                      : t("a_debloquer") || "À DÉBLOQUER"}
                  </Text>
                </View>
                {grade.unlocked && (
                  <View style={styles.checkmark}>
                    <Icon source="check" size={16} color="#0f0f0f" />
                  </View>
                )}
              </View>
            ))}
          </View>

        </Animated.View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  container: {
    flex: 1,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 60,
  },
  profileImageContainer: {
    marginBottom: 20,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: Colors.light.gold,
  },
  driverName: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.light.gold,
    marginBottom: 10,
    textAlign: 'center',
  },
  currentGradeBadge: {
    paddingVertical: 8,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    borderWidth: 2,
    borderColor: Colors.light.gold,
    borderRadius: 25,
  },
  badgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  progressSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    padding: 30,
    marginBottom: 40,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  progressLabel: {
    fontSize: 12,
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 1,
    flex: 1,
  },
  progressPercent: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.light.gold,
  },
  progressBarContainer: {
    height: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 10,
  },
  progressGradient: {
    flex: 1,
  },
  nextGradeInfo: {
    marginTop: 15,
    fontSize: 14,
    color: '#aaa',
  },
  nextGradeHighlight: {
    fontWeight: '700',
    color: '#fff',
  },
  nextGradeName: {
    color: Colors.light.gold,
    fontWeight: '600',
  },
  gradesList: {
    width: '100%',
  },
  gradesTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 30,
    textAlign: 'center',
    color: '#fff',
  },
  gradeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  gradeItemUnlocked: {
    borderColor: 'rgba(255, 215, 0, 0.3)',
    backgroundColor: 'rgba(255, 215, 0, 0.05)',
  },
  gradeItemCurrent: {
    borderColor: Colors.light.gold,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
  },
  gradeIcon: {
    width: 50,
    height: 50,
    marginRight: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradeInfo: {
    flex: 1,
  },
  gradeName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 5,
    color: '#fff',
  },
  gradeNameCurrent: {
    color: Colors.light.gold,
  },
  gradeStatus: {
    fontSize: 11,
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  gradeStatusUnlocked: {
    color: Colors.light.gold,
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.light.gold,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
