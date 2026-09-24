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

export default function DriverProfileDesign2({ navigation }: { navigation: any }) {
  const { t } = useTranslation();
  const fadeAnims = useRef([...Array(5)].map(() => new Animated.Value(0))).current;

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
    progression: 68,
  });

  useEffect(() => {
    navigation.setOptions({ tabBarStyle: { display: "none" } });
    return () => navigation.setOptions({ tabBarStyle: { display: "flex" } });
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      // Stagger animations
      fadeAnims.forEach((anim, index) => {
        Animated.timing(anim, {
          toValue: 1,
          duration: 600,
          delay: index * 100,
          useNativeDriver: true,
        }).start();
      });

      // Uncomment to fetch real data
      // fetchEvolution();
      // fetchUserData();
    }, [])
  );

  const gradesList = [
    { 
      name: "Silver", 
      icon: "medal", 
      description: "Excellent service client et conduite sécurisée",
      unlocked: true, 
      current: true,
      progress: 68,
      alignment: 'left'
    },
    { 
      name: "Bronze", 
      icon: "medal", 
      description: "Maîtrise des fondamentaux confirmée",
      unlocked: true,
      alignment: 'right'
    },
    { 
      name: "Standard", 
      icon: "star", 
      description: "Premier pas vers l'excellence",
      unlocked: true,
      alignment: 'left'
    },
    { 
      name: "Gold", 
      icon: "medal", 
      description: "Performance exceptionnelle maintenue",
      unlocked: false,
      alignment: 'right'
    },
    { 
      name: "Platinum", 
      icon: "diamond", 
      description: "Élite des chauffeurs - Excellence absolue",
      unlocked: false,
      alignment: 'left'
    },
  ];

  return (
    <ScrollView style={styles.container}>
      <LinearGradient
        colors={[Colors.light.tint, '#764ba2']}
        style={styles.header}
      >
        <View style={styles.profileSection}>
          <Image
            style={styles.profileImage}
            source={
              profile.url
                ? { uri: profile.url }
                : require("../../assets/images/profile.jpg")
            }
          />
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>
              {profile.firstName} {profile.lastName}
            </Text>
            <Text style={styles.profileSubtitle}>
              {t("chauffeur_certifie") || "Chauffeur Certifié depuis 2 ans"}
            </Text>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.courses}</Text>
            <Text style={styles.statLabel}>{t("courses") || "Courses"}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.rating}★</Text>
            <Text style={styles.statLabel}>{t("note_moyenne") || "Note Moyenne"}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.progression}%</Text>
            <Text style={styles.statLabel}>{t("progression") || "Progression"}</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.journeyContainer}>
        <Text style={styles.journeyTitle}>🏆 {t("votre_parcours") || "Votre Parcours d'Excellence"}</Text>

        <View style={styles.journeyPath}>
          {/* Journey line */}
          <View style={styles.journeyLine} />

          {gradesList.map((grade, index) => (
            <Animated.View
              key={grade.name}
              style={[
                styles.gradeCard,
                grade.alignment === 'left' ? styles.gradeCardLeft : styles.gradeCardRight,
                { opacity: fadeAnims[index] }
              ]}
            >
              {grade.alignment === 'left' ? (
                <>
                  <View style={[
                    styles.gradeContent,
                    grade.unlocked && styles.gradeContentUnlocked,
                    grade.current && styles.gradeContentCurrent,
                    !grade.unlocked && styles.gradeContentLocked,
                  ]}>
                    <Text style={[
                      styles.gradeName,
                      grade.current && styles.gradeNameCurrent,
                    ]}>
                      {grade.name}
                    </Text>
                    <Text style={[
                      styles.gradeDescription,
                      grade.current && styles.gradeDescriptionCurrent,
                    ]}>
                      {grade.description}
                    </Text>
                    {grade.current && (
                      <View style={styles.gradeProgress}>
                        <Text style={styles.progressText}>{grade.progress}%</Text>
                        <View style={styles.miniProgressBar}>
                          <View style={[styles.miniProgressFill, { width: `${grade.progress}%` }]} />
                        </View>
                        <Text style={styles.progressText}>→ {grades.next}</Text>
                      </View>
                    )}
                    <View style={[
                      styles.badge,
                      grade.current && styles.badgeCurrent,
                    ]}>
                      <Text style={[
                        styles.badgeText,
                        grade.current && styles.badgeTextCurrent,
                      ]}>
                        {grade.current
                          ? t("grade_actuel") || "Grade Actuel"
                          : grade.unlocked
                          ? t("debloque") || "✓ Débloqué"
                          : t("objectif_suivant") || "Objectif Suivant"}
                      </Text>
                    </View>
                  </View>
                  <View style={[
                    styles.gradeIconContainer,
                    grade.unlocked && styles.gradeIconUnlocked,
                    grade.current && styles.gradeIconCurrent,
                  ]}>
                    <Icon
                      source={grade.icon}
                      size={40}
                      color={grade.unlocked ? '#fff' : '#ccc'}
                    />
                  </View>
                </>
              ) : (
                <>
                  <View style={[
                    styles.gradeIconContainer,
                    grade.unlocked && styles.gradeIconUnlocked,
                    grade.current && styles.gradeIconCurrent,
                  ]}>
                    <Icon
                      source={grade.icon}
                      size={40}
                      color={grade.unlocked ? '#fff' : '#ccc'}
                    />
                  </View>
                  <View style={[
                    styles.gradeContent,
                    grade.unlocked && styles.gradeContentUnlocked,
                    grade.current && styles.gradeContentCurrent,
                    !grade.unlocked && styles.gradeContentLocked,
                  ]}>
                    <Text style={[
                      styles.gradeName,
                      grade.current && styles.gradeNameCurrent,
                    ]}>
                      {grade.name}
                    </Text>
                    <Text style={[
                      styles.gradeDescription,
                      grade.current && styles.gradeDescriptionCurrent,
                    ]}>
                      {grade.description}
                    </Text>
                    {grade.current && (
                      <View style={styles.gradeProgress}>
                        <Text style={styles.progressText}>{grade.progress}%</Text>
                        <View style={styles.miniProgressBar}>
                          <View style={[styles.miniProgressFill, { width: `${grade.progress}%` }]} />
                        </View>
                        <Text style={styles.progressText}>→ {grades.next}</Text>
                      </View>
                    )}
                    <View style={[
                      styles.badge,
                      grade.current && styles.badgeCurrent,
                    ]}>
                      <Text style={[
                        styles.badgeText,
                        grade.current && styles.badgeTextCurrent,
                      ]}>
                        {grade.current
                          ? t("grade_actuel") || "Grade Actuel"
                          : grade.unlocked
                          ? t("debloque") || "✓ Débloqué"
                          : `${grades.percentageRemaining}% ${t("restants") || "restants"}`}
                      </Text>
                    </View>
                  </View>
                </>
              )}
            </Animated.View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  header: {
    borderRadius: 30,
    padding: 30,
    margin: 20,
    marginBottom: 30,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#fff',
    marginRight: 20,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 5,
  },
  profileSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 15,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 15,
    padding: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  journeyContainer: {
    padding: 20,
  },
  journeyTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#2d3748',
    textAlign: 'center',
    marginBottom: 30,
  },
  journeyPath: {
    position: 'relative',
    paddingVertical: 20,
  },
  journeyLine: {
    position: 'absolute',
    left: '50%',
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: Colors.light.tint,
    marginLeft: -2,
  },
  gradeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
    zIndex: 1,
  },
  gradeCardLeft: {
    paddingRight: 50,
  },
  gradeCardRight: {
    paddingLeft: 50,
  },
  gradeContent: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 25,
    borderWidth: 2,
    borderColor: 'transparent',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  gradeContentUnlocked: {
    borderColor: Colors.light.tint,
    backgroundColor: '#f8f9ff',
  },
  gradeContentCurrent: {
    borderColor: Colors.light.tint,
    backgroundColor: Colors.light.tint,
  },
  gradeContentLocked: {
    opacity: 0.5,
  },
  gradeName: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
    color: '#2d3748',
  },
  gradeNameCurrent: {
    color: '#fff',
  },
  gradeDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  gradeDescriptionCurrent: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  gradeProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  progressText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  miniProgressBar: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 10,
    overflow: 'hidden',
  },
  miniProgressFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 10,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(102, 126, 234, 0.2)',
    borderRadius: 20,
  },
  badgeCurrent: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.light.tint,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  badgeTextCurrent: {
    color: '#fff',
  },
  gradeIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#f5f7fa',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  gradeIconUnlocked: {
    backgroundColor: Colors.light.tint,
    borderColor: Colors.light.tint,
  },
  gradeIconCurrent: {
    backgroundColor: Colors.light.gold,
    borderColor: Colors.light.gold,
  },
});
