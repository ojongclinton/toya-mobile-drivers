import React, { useEffect, useState, useCallback, useRef } from "react";
import { Image, Text, View, StyleSheet, ScrollView, Animated } from "react-native";
import { Icon } from "react-native-paper";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';

import stylesGlobal from "../../assets/styles/global_styles";
import { Colors } from "@/constants/Colors";
import BASE_URL from "@/constants/api/BASE_URL";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function DriverProfileDesign3({ navigation }: { navigation: any }) {
  const { t } = useTranslation();
  const progressAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Mock data
  const [profile, setProfile] = useState({
    url: "",
    firstName: "Jean",
    lastName: "Dupont",
  });

  const [grades, setGrades] = useState({
    current: "Silver",
    next: "Gold",
    percentageToNext: 68,
    percentageRemaining: 32,
  });

  const [stats] = useState({
    courses: 1247,
    rating: 4.8,
    success: 95,
    gradesUnlocked: 3,
    totalGrades: 5,
  });

  useEffect(() => {
    navigation.setOptions({ tabBarStyle: { display: "none" } });
    return () => navigation.setOptions({ tabBarStyle: { display: "flex" } });
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      // Reset and animate
      progressAnim.setValue(0);
      fadeAnim.setValue(0);

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(progressAnim, {
          toValue: grades.percentageToNext,
          duration: 2000,
          useNativeDriver: true,
        }),
      ]).start();

      // Uncomment to fetch real data
      // fetchEvolution();
      // fetchUserData();
    }, [])
  );

  const gradesList = [
    { name: "Standard", icon: "star", unlocked: true },
    { name: "Bronze", icon: "medal", unlocked: true },
    { name: "Silver", icon: "medal", unlocked: true, current: true },
    { name: "Gold", icon: "medal", unlocked: false },
    { name: "Platinum", icon: "diamond", unlocked: false },
  ];

  // Calculate circle progress
  const radius = 90;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: [circumference, 0],
  });

  return (
    <LinearGradient
      colors={['#1e3c72', '#2a5298', '#7e22ce']}
      style={styles.gradient}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Animated.View style={{ opacity: fadeAnim }}>
          
          {/* Top Bar */}
          <View style={styles.topBar}>
            <View style={styles.profileCompact}>
              <Image
                style={styles.profileImage}
                source={
                  profile.url
                    ? { uri: profile.url }
                    : require("../../assets/images/profile.jpg")
                }
              />
              <View style={styles.profileCompactInfo}>
                <Text style={styles.profileName}>
                  {profile.firstName} {profile.lastName}
                </Text>
                <Text style={styles.profileSubtitle}>
                  {t("membre_depuis") || "Membre depuis 2022"}
                </Text>
              </View>
            </View>
            <View style={styles.notificationBadge}>
              <Icon source="bell" size={24} color="#fff" />
            </View>
          </View>

          {/* Main Grid */}
          <View style={styles.mainGrid}>
            
            {/* Progress Card */}
            <View style={styles.card}>
              <View style={styles.currentBadgeLarge}>
                <Text style={styles.badgeLargeText}>🥈 {grades.current}</Text>
              </View>
              
              <View style={styles.circularProgress}>
                <Svg width={220} height={220}>
                  <Defs>
                    <SvgLinearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <Stop offset="0%" stopColor={Colors.light.gold} />
                      <Stop offset="100%" stopColor="#ff8c00" />
                    </SvgLinearGradient>
                  </Defs>
                  
                  {/* Background circle */}
                  <Circle
                    cx="110"
                    cy="110"
                    r={radius}
                    stroke="rgba(255, 255, 255, 0.1)"
                    strokeWidth="18"
                    fill="none"
                  />
                  
                  {/* Progress circle */}
                  <AnimatedCircle
                    cx="110"
                    cy="110"
                    r={radius}
                    stroke="url(#gradient)"
                    strokeWidth="18"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    transform={`rotate(-90, 110, 110)`}
                  />
                </Svg>
                
                <View style={styles.progressCenter}>
                  <Text style={styles.progressPercentLarge}>{grades.percentageToNext}%</Text>
                  <Text style={styles.progressLabelSmall}>{t("complete") || "COMPLÉTÉ"}</Text>
                </View>
              </View>

              <Text style={styles.nextGoal}>
                <Text style={styles.nextGoalBold}>{grades.percentageRemaining}%</Text>{" "}
                {t("avant_le_grade") || "avant le grade"}{" "}
                <Text style={styles.nextGoalGold}>{grades.next} 🥇</Text>
              </Text>
            </View>

            {/* Stats Card */}
            <View style={styles.card}>
              <View style={styles.statsGrid}>
                <View style={styles.statBox}>
                  <Text style={styles.statIcon}>🚗</Text>
                  <Text style={styles.statValueBig}>{stats.courses}</Text>
                  <Text style={styles.statLabelBig}>{t("courses") || "Courses"}</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statIcon}>⭐</Text>
                  <Text style={styles.statValueBig}>{stats.rating}</Text>
                  <Text style={styles.statLabelBig}>{t("note") || "Note"}</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statIcon}>🎯</Text>
                  <Text style={styles.statValueBig}>{stats.success}%</Text>
                  <Text style={styles.statLabelBig}>{t("reussite") || "Réussite"}</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statIcon}>🏆</Text>
                  <Text style={styles.statValueBig}>{stats.gradesUnlocked}/{stats.totalGrades}</Text>
                  <Text style={styles.statLabelBig}>{t("grades") || "Grades"}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Grades Grid */}
          <View style={styles.gradesGrid}>
            {gradesList.map((grade, index) => (
              <View
                key={grade.name}
                style={[
                  styles.gradeTile,
                  grade.unlocked && styles.gradeTileUnlocked,
                  grade.current && styles.gradeTileCurrent,
                  !grade.unlocked && styles.gradeTileLocked,
                ]}
              >
                {grade.unlocked && (
                  <View style={styles.checkmarkBadge}>
                    <Icon source="check" size={14} color="#1e3c72" />
                  </View>
                )}
                <Text style={styles.gradeTileIcon}>
                  {grade.icon === 'star' ? '⭐' : 
                   grade.icon === 'medal' ? (
                     grade.name === 'Bronze' ? '🥉' :
                     grade.name === 'Silver' ? '🥈' : '🥇'
                   ) : '💎'}
                </Text>
                <Text style={[
                  styles.gradeTileName,
                  grade.current && styles.gradeTileNameCurrent,
                ]}>
                  {grade.name}
                </Text>
                <Text style={[
                  styles.gradeTileStatus,
                  grade.current && styles.gradeTileStatusCurrent,
                ]}>
                  {grade.current
                    ? t("actuel") || "ACTUEL"
                    : grade.unlocked
                    ? t("debloque") || "Débloqué"
                    : `${grades.percentageRemaining}% ${t("restants") || "restants"}`}
                </Text>
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
    padding: 20,
    paddingTop: 30,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
  },
  profileCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  profileImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    marginRight: 15,
  },
  profileCompactInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 3,
  },
  profileSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  notificationBadge: {
    width: 50,
    height: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainGrid: {
    gap: 20,
    marginBottom: 30,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 25,
    padding: 25,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
  },
  currentBadgeLarge: {
    backgroundColor: Colors.light.gold,
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 30,
    marginBottom: 20,
    elevation: 5,
    shadowColor: Colors.light.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  badgeLargeText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1e3c72',
  },
  circularProgress: {
    width: 220,
    height: 220,
    marginBottom: 20,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressCenter: {
    position: 'absolute',
    alignItems: 'center',
  },
  progressPercentLarge: {
    fontSize: 48,
    fontWeight: '800',
    color: Colors.light.gold,
    marginBottom: 5,
  },
  progressLabelSmall: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  nextGoal: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
  nextGoalBold: {
    fontWeight: '700',
    color: '#fff',
  },
  nextGoalGold: {
    fontWeight: '700',
    color: Colors.light.gold,
  },
  statsGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 15,
  },
  statBox: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 18,
    padding: 20,
    alignItems: 'center',
  },
  statIcon: {
    fontSize: 36,
    marginBottom: 12,
  },
  statValueBig: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 5,
  },
  statLabelBig: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  gradesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 15,
  },
  gradeTile: {
    flex: 1,
    minWidth: '28%',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    position: 'relative',
  },
  gradeTileUnlocked: {
    borderColor: Colors.light.gold,
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
  },
  gradeTileCurrent: {
    borderColor: Colors.light.gold,
    backgroundColor: Colors.light.gold,
    transform: [{ scale: 1.05 }],
    elevation: 8,
    shadowColor: Colors.light.gold,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
  },
  gradeTileLocked: {
    opacity: 0.4,
  },
  gradeTileIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  gradeTileName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  gradeTileNameCurrent: {
    color: '#1e3c72',
  },
  gradeTileStatus: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  gradeTileStatusCurrent: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 10,
    color: '#fff',
    marginTop: 5,
  },
  checkmarkBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    backgroundColor: Colors.light.gold,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
});
