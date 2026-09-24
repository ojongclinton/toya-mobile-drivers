// import React, { useEffect, useState, useCallback } from "react";
// import { Image, Text, View, StyleSheet, ScrollView } from "react-native";
// import { Icon } from "react-native-paper";
// import PieChart from "react-native-pie-chart";
// import AsyncStorage from "@react-native-async-storage/async-storage";
// import { useFocusEffect } from "expo-router";
// import { useTranslation } from "react-i18next";

// import stylesGlobal from "../../assets/styles/global_styles";
// import { Colors } from "@/constants/Colors";
// import BASE_URL from "@/constants/api/BASE_URL";

// export default function DriverProfile({ navigation }: { navigation: any }) {
//   const { t } = useTranslation();

//   const [profile, setProfile] = useState({
//     url: "",
//     firstName: "",
//     lastName: "",
//   });

//   const [grades, setGrades] = useState({
//     current: "",
//     next: "",
//     percentageToNext: 1,
//     percentageRemaining: 1,
//   });

//   useEffect(() => {
//     navigation.setOptions({ tabBarStyle: { display: "none" } });
//     return () => navigation.setOptions({ tabBarStyle: { display: "flex" } });
//   }, [navigation]);

//   useFocusEffect(
//     useCallback(() => {
//       fetchEvolution();
//       fetchUserData();
//     }, [])
//   );

//   const fetchUserData = async () => {
//     try {
//       const info = await AsyncStorage.getItem("Info");
//       if (!info) return;
//       const data = JSON.parse(info);
//       setProfile({
//         url: data.profile_picture,
//         firstName: data.Data.first_name,
//         lastName: data.Data.last_name,
//       });
//     } catch (error) {
//       console.error("Erreur lors de la récupération des infos :", error);
//     }
//   };

//   const fetchEvolution = async () => {
//     try {
//       const token = await AsyncStorage.getItem("authToken");
//       const response = await fetch(`${BASE_URL}/drivers/grades/evolution`, {
//         headers: {
//           Authorization: `Bearer ${token}`,
//           "Content-Type": "application/json",
//           Accept: "application/json",
//         },
//       });

//       const { Data } = await response.json();
//       const current = Data.Evelotion["Current Position"];
//       const next = Data.Evelotion["Next Position"];

//       setGrades({
//         current: current.Data.grade,
//         next: next.grade,
//         percentageToNext: current.percentage_to_next_grade,
//         percentageRemaining: next.percentage_remaining_to_next_grade,
//       });
//     } catch (error) {
//       console.error("Erreur lors de la récupération de l’évolution :", error);
//     }
//   };

//   const gradesList = ["Standard", "Bronze", "Silver", "Gold", "Platinum"];

//   const getGradeIndex = (grade: string) => gradesList.indexOf(grade);
//   const getTextForGrade = (grade: string) =>
//     getGradeIndex(grade) <= getGradeIndex(grades.current)
//       ? t("obtained")
//       : t("get");
//   const getIconColor = (grade: string) =>
//     getTextForGrade(grade) === t("obtained")
//       ? Colors.light.gold
//       : Colors.dark.icon;

//   const chartData = {
//     widthAndHeight: 200,
//     series: [grades.percentageToNext, grades.percentageRemaining],
//     sliceColor: [Colors.light.tint, "#ecebff"],
//     labels: [t("achieved"), t("remaining")],
//   };

//   const trophies = [
//     { grade: "Bronze", label: t("chauffeur_bronze") },
//     { grade: "Silver", label: t("chauffeur_silver") },
//     { grade: "Gold", label: t("chauffeur_gold") },
//     { grade: "Platinum", label: t("chauffeur_platinum") },
//   ];

//   return (
//     <ScrollView>
//       <View style={styles.container}>
//         <Text style={styles.pageIntro}>{t("driverprofile")}</Text>

//         <View style={styles.profileContainer}>
//           <Image
//             style={stylesGlobal.headerImage}
//             source={
//               profile.url
//                 ? { uri: profile.url }
//                 : require("../../assets/images/profile.jpg")
//             }
//           />
//           <Text style={stylesGlobal.headerText}>
//             {profile.firstName} {profile.lastName}
//           </Text>
//         </View>

//         <View style={styles.chartContainer}>
//           <PieChart
//             widthAndHeight={chartData.widthAndHeight}
//             series={chartData.series}
//             sliceColor={chartData.sliceColor}
//           />
//           <View style={styles.legendContainer}>
//             {chartData.labels.map((label, index) => (
//               <View key={index} style={styles.legendItem}>
//                 <View
//                   style={[
//                     styles.colorBox,
//                     { backgroundColor: chartData.sliceColor[index] },
//                   ]}
//                 />
//                 <Text style={styles.legendText}>
//                   {label}: {chartData.series[index]}%
//                 </Text>
//               </View>
//             ))}
//           </View>
//         </View>

//         <View style={styles.trophiesContainer}>
//           <Text style={stylesGlobal.heading_2}>{t("trophy_title")}:</Text>
//           <View style={styles.section}>
//             {trophies.map(({ grade, label }) => (
//               <View key={grade} style={styles.trophyRow}>
//                 <View style={styles.trophyLabel}>
//                   <Icon source="trophy" color={getIconColor(grade)} size={24} />
//                   <Text style={styles.trophyText}>{label}</Text>
//                 </View>
//               </View>
//             ))}
//           </View>
//         </View>
//       </View>
//     </ScrollView>
//   );
// }

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     alignItems: "center",
//   },
//   pageIntro: {
//     paddingHorizontal: 30,
//     paddingVertical: 20,
//     textAlign: "center",
//     fontSize: 14,
//     lineHeight: 26,
//     color: "#333",
//     fontWeight: "400",
//   },
//   profileContainer: {
//     alignItems: "center",
//   },
//   chartContainer: {
//     marginTop: 50,
//   },
//   legendContainer: {
//     flexDirection: "row",
//     alignItems: "center",
//     justifyContent: "space-between",
//   },
//   legendItem: {
//     flexDirection: "row",
//     alignItems: "center",
//     marginVertical: 5,
//   },
//   colorBox: {
//     width: 15,
//     height: 15,
//     marginRight: 10,
//   },
//   legendText: {
//     fontSize: 14,
//     color: "#333",
//   },
//   trophiesContainer: {
//     width: "100%",
//     padding: 30,
//   },
//   section: {
//     width: "100%",
//     paddingHorizontal: 30,
//     marginTop: 20,
//   },
//   trophyRow: {
//     flexDirection: "row",
//     alignItems: "center",
//     justifyContent: "space-between",
//     marginBottom: 15,
//   },
//   trophyLabel: {
//     flexDirection: "row",
//     alignItems: "center",
//     gap: 10,
//   },
//   trophyText: {
//     fontSize: 16,
//     color: "#444",
//     marginLeft: 8,
//   },
// });
// import React, { useEffect, useState, useCallback, useRef } from "react";
// import { Image, Text, View, StyleSheet, ScrollView, Animated } from "react-native";
// import { Icon } from "react-native-paper";
// import AsyncStorage from "@react-native-async-storage/async-storage";
// import { useFocusEffect } from "expo-router";
// import { LinearGradient } from 'expo-linear-gradient';

// import stylesGlobal from "../../assets/styles/global_styles";
// import { Colors } from "@/constants/Colors";
// import BASE_URL from "@/constants/api/BASE_URL";

// export default function DriverProfileDesign1({ navigation }: { navigation: any }) {
//   const progressAnim = useRef(new Animated.Value(0)).current;
//   const fadeAnim = useRef(new Animated.Value(0)).current;

//   // Mock data - replace with real data from API
//   const [profile, setProfile] = useState({
//     url: "",
//     firstName: "Evrard",
//     lastName: "Tchouks",
//   });

//   const [grades, setGrades] = useState({
//     current: "Silver",
//     next: "Gold",
//     percentageToNext: 68,
//     percentageRemaining: 32,
//   });

//   useEffect(() => {
//     navigation.setOptions({ tabBarStyle: { display: "none" } });
//     return () => navigation.setOptions({ tabBarStyle: { display: "flex" } });
//   }, [navigation]);

//   useFocusEffect(
//     useCallback(() => {
//       // Animate on focus
//       Animated.parallel([
//         Animated.timing(fadeAnim, {
//           toValue: 1,
//           duration: 800,
//           useNativeDriver: true,
//         }),
//         Animated.timing(progressAnim, {
//           toValue: grades.percentageToNext,
//           duration: 1500,
//           useNativeDriver: false,
//         }),
//       ]).start();

//       // Uncomment to fetch real data
//       // fetchEvolution();
//       // fetchUserData();
//     }, [])
//   );

//   const fetchUserData = async () => {
//     try {
//       const info = await AsyncStorage.getItem("Info");
//       if (!info) return;
//       const data = JSON.parse(info);
//       setProfile({
//         url: data.profile_picture,
//         firstName: data.Data.first_name,
//         lastName: data.Data.last_name,
//       });
//     } catch (error) {
//       console.error("Erreur lors de la récupération des infos :", error);
//     }
//   };

//   const fetchEvolution = async () => {
//     try {
//       const token = await AsyncStorage.getItem("authToken");
//       const response = await fetch(`${BASE_URL}/drivers/grades/evolution`, {
//         headers: {
//           Authorization: `Bearer ${token}`,
//           "Content-Type": "application/json",
//           Accept: "application/json",
//         },
//       });

//       const { Data } = await response.json();
//       const current = Data.Evelotion["Current Position"];
//       const next = Data.Evelotion["Next Position"];

//       setGrades({
//         current: current.Data.grade,
//         next: next.grade,
//         percentageToNext: current.percentage_to_next_grade,
//         percentageRemaining: next.percentage_remaining_to_next_grade,
//       });
//     } catch (error) {
//       console.error("Erreur lors de la récupération de l'évolution :", error);
//     }
//   };

//   const gradesList = [
//     { name: "Standard", icon: "star", unlocked: true },
//     { name: "Bronze", icon: "medal", unlocked: true },
//     { name: "Silver", icon: "medal", unlocked: true, current: true },
//     { name: "Gold", icon: "medal", unlocked: false },
//     { name: "Platinum", icon: "diamond", unlocked: false },
//   ];

//   const progressWidth = progressAnim.interpolate({
//     inputRange: [0, 100],
//     outputRange: ['0%', '100%'],
//   });

//   return (
//     <LinearGradient
//       colors={['#fefefe', '#f8f8f8']}
//       style={styles.gradient}
//     >
//       <ScrollView contentContainerStyle={styles.scrollContent}>
//         <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
          
//           {/* Header Section */}
//           <View style={styles.header}>
//             <View style={styles.profileImageContainer}>
//               <Image
//                 style={styles.profileImage}
//                 source={
//                   profile.url
//                     ? { uri: profile.url }
//                     : require("../../assets/images/profile.jpg")
//                 }
//               />
//             </View>
//             <Text style={styles.driverName}>
//               {profile.firstName} {profile.lastName}
//             </Text>
//             <View style={styles.currentGradeBadge}>
//               <Text style={styles.badgeText}>{grades.current}</Text>
//             </View>
//           </View>

//           {/* Progress Section */}
//           <View style={styles.progressSection}>
//             <View style={styles.progressHeader}>
//               <Text style={styles.progressLabel}>
//                 PROGRESSION VERS {grades.next}
//               </Text>
//               <Text style={styles.progressPercent}>{grades.percentageToNext}%</Text>
//             </View>
            
//             <View style={styles.progressBarContainer}>
//               <Animated.View style={[styles.progressBar, { width: progressWidth }]}>
//                 <LinearGradient
//                   colors={[Colors.light.gold, '#FFA500']}
//                   start={{ x: 0, y: 0 }}
//                   end={{ x: 1, y: 0 }}
//                   style={styles.progressGradient}
//                 />
//               </Animated.View>
//             </View>

//             <Text style={styles.nextGradeInfo}>
//               Plus que <Text style={styles.nextGradeHighlight}>{grades.percentageRemaining}%</Text> pour atteindre le grade{" "}
//               <Text style={styles.nextGradeName}>{grades.next}</Text>
//             </Text>
//           </View>

//           {/* Grades List */}
//           <View style={styles.gradesList}>
//             <Text style={styles.gradesTitle}>Vos Réalisations</Text>
            
//             {gradesList.map((grade, index) => (
//               <View
//                 key={grade.name}
//                 style={[
//                   styles.gradeItem,
//                   grade.unlocked && styles.gradeItemUnlocked,
//                   grade.current && styles.gradeItemCurrent,
//                 ]}
//               >
//                 <View style={styles.gradeIcon}>
//                   <Icon
//                     source={grade.icon}
//                     size={24}
//                     color={grade.unlocked ? Colors.light.gold : '#666'}
//                   />
//                 </View>
//                 <View style={styles.gradeInfo}>
//                   <Text style={[
//                     styles.gradeName,
//                     grade.current && styles.gradeNameCurrent,
//                   ]}>
//                     {grade.name}
//                   </Text>
//                   <Text style={[
//                     styles.gradeStatus,
//                     grade.unlocked && styles.gradeStatusUnlocked,
//                   ]}>
//                     {grade.current
//                       ? "GRADE ACTUEL"
//                       : grade.unlocked
//                       ? "DÉBLOQUÉ"
//                       : "À DÉBLOQUER"}
//                   </Text>
//                 </View>
//                 {grade.unlocked && (
//                   <View style={styles.checkmark}>
//                     <Icon source="check" size={14} color="#0f0f0f" />
//                   </View>
//                 )}
//               </View>
//             ))}
//           </View>

//         </Animated.View>
//       </ScrollView>
//     </LinearGradient>
//   );
// }

// const styles = StyleSheet.create({
//   gradient: {
//     flex: 1,
//   },
//   scrollContent: {
//     flexGrow: 1,
//     paddingVertical: 20,  // Réduit de 40 à 20
//     paddingHorizontal: 16,  // Réduit de 20 à 16
//   },
//   container: {
//     flex: 1,
//     maxWidth: 600,
//     width: '100%',
//     alignSelf: 'center',
//   },
//   header: {
//     alignItems: 'center',
//     marginBottom: 30,  // Réduit de 60 à 30
//   },
//   profileImageContainer: {
//     marginBottom: 12,  // Réduit de 20 à 12
//   },
//   profileImage: {
//     width: 80,  // Réduit de 100 à 80
//     height: 80,  // Réduit de 100 à 80
//     borderRadius: 40,  // Réduit de 50 à 40
//     borderWidth: 3,  // Réduit de 4 à 3
//     borderColor: '#6D56F2',
//   },
//   driverName: {
//     fontSize: 26,  // Réduit de 32 à 26
//     fontWeight: '700',
//     color: '#000',
//     marginBottom: 8,  // Réduit de 10 à 8
//     textAlign: 'center',
//   },
//   currentGradeBadge: {
//     paddingVertical: 6,  // Réduit de 8 à 6
//     paddingHorizontal: 20,  // Réduit de 24 à 20
//     backgroundColor: 'rgba(109, 86, 242, 0.15)',
//     borderWidth: 2,
//     borderColor: '#6D56F2',
//     borderRadius: 25,
//   },
//   badgeText: {
//     fontSize: 12,  // Réduit de 14 à 12
//     fontWeight: '600',
//     color: '#6D56F2',
//     letterSpacing: 1,
//     textTransform: 'uppercase',
//   },
//   progressSection: {
//     backgroundColor: '#f5f5f5',
//     borderRadius: 16,  // Réduit de 20 à 16
//     padding: 20,  // Réduit de 30 à 20
//     marginBottom: 24,  // Réduit de 40 à 24
//     borderWidth: 1,
//     borderColor: '#e0e0e0',
//   },
//   progressHeader: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     marginBottom: 14,  // Réduit de 20 à 14
//   },
//   progressLabel: {
//     fontSize: 11,  // Réduit de 12 à 11
//     color: '#666',
//     textTransform: 'uppercase',
//     letterSpacing: 1,
//     flex: 1,
//   },
//   progressPercent: {
//     fontSize: 24,  // Réduit de 28 à 24
//     fontWeight: '700',
//     color: '#6D56F2',
//   },
//   progressBarContainer: {
//     height: 10,  // Réduit de 12 à 10
//     backgroundColor: '#e8e8e8',
//     borderRadius: 10,
//     overflow: 'hidden',
//   },
//   progressBar: {
//     height: '100%',
//     borderRadius: 10,
//   },
//   progressGradient: {
//     flex: 1,
//   },
//   nextGradeInfo: {
//     marginTop: 12,  // Réduit de 15 à 12
//     fontSize: 13,  // Réduit de 14 à 13
//     color: '#666',
//   },
//   nextGradeHighlight: {
//     fontWeight: '700',
//     color: '#000',
//   },
//   nextGradeName: {
//     color: '#6D56F2',
//     fontWeight: '600',
//   },
//   gradesList: {
//     width: '100%',
//   },
//   gradesTitle: {
//     fontSize: 18,  // Réduit de 20 à 18
//     fontWeight: '700',
//     marginBottom: 16,  // Réduit de 30 à 16
//     textAlign: 'center',
//     color: '#333',
//   },
//   gradeItem: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     padding: 14,  // Réduit de 20 à 14
//     backgroundColor: 'rgba(0, 0, 0, 0.02)',
//     borderRadius: 12,  // Réduit de 15 à 12
//     marginBottom: 10,  // Réduit de 15 à 10
//     borderWidth: 1,
//     borderColor: '#d0d0d0',
//   },
//   gradeItemUnlocked: {
//     borderColor: 'rgba(255, 215, 0, 0.5)',
//     backgroundColor: 'rgba(255, 215, 0, 0.08)',
//   },
//   gradeItemCurrent: {
//     borderColor: '#6D56F2',
//     borderWidth: 2,
//     backgroundColor: 'rgba(109, 86, 242, 0.08)',
//   },
//   gradeIcon: {
//     width: 40,  // Réduit de 50 à 40
//     height: 40,  // Réduit de 50 à 40
//     marginRight: 14,  // Réduit de 20 à 14
//     justifyContent: 'center',
//     alignItems: 'center',
//   },
//   gradeInfo: {
//     flex: 1,
//   },
//   gradeName: {
//     fontSize: 16,  // Réduit de 18 à 16
//     fontWeight: '600',
//     marginBottom: 3,  // Réduit de 5 à 3
//     color: '#000',
//   },
//   gradeNameCurrent: {
//     color: '#6D56F2',
//   },
//   gradeStatus: {
//     fontSize: 10,  // Réduit de 11 à 10
//     color: '#888',
//     textTransform: 'uppercase',
//     letterSpacing: 1,
//   },
//   gradeStatusUnlocked: {
//     color: Colors.light.gold,
//   },
//   checkmark: {
//     width: 20,  // Réduit de 24 à 20
//     height: 20,  // Réduit de 24 à 20
//     borderRadius: 10,  // Réduit de 12 à 10
//     backgroundColor: Colors.light.gold,
//     justifyContent: 'center',
//     alignItems: 'center',
//   },
// });
import React, { useEffect, useState, useCallback, useRef } from "react";
import { Image, Text, View, StyleSheet, ScrollView, Animated, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon } from "react-native-paper";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "expo-router";
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';

import stylesGlobal from "../../assets/styles/global_styles";
import { Colors } from "@/constants/Colors";
import BASE_URL from "@/constants/api/BASE_URL";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function DriverProfileDesign1({ navigation }: { navigation: any }) {
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

  // Statistics data - replace with real data from API
  const [statistics, setStatistics] = useState({
    totalRides: 245,
    revenue: 1542000,
    averageRating: 4.8,
    currentGrade: 3,
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
          useNativeDriver: true,
        }),
      ]).start();

      // Uncomment to fetch real data
      // fetchEvolution();
      // fetchUserData();
      // fetchStatistics();
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
    } catch {
      // silently ignore
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
    } catch {
      // silently ignore
    }
  };

  const fetchStatistics = async () => {
    try {
      const token = await AsyncStorage.getItem("authToken");
      const response = await fetch(`${BASE_URL}/drivers/statistics`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });

      const { Data } = await response.json();
      setStatistics({
        totalRides: Data.total_rides,
        revenue: Data.revenue,
        averageRating: Data.average_rating,
        currentGrade: Data.current_grade,
      });
    } catch {
      // silently ignore
    }
  };

  const gradesList = [
    { 
      name: "Standard", 
      icon: "star", 
      unlocked: true,
      requirements: {
        rides: 0,
        revenue: "0",
        rating: 0,
        commission: "15"
      }
    },
    { 
      name: "Bronze", 
      icon: "medal", 
      unlocked: true,
      requirements: {
        rides: 100,
        revenue: "750K",
        rating: 4,
        commission: "15"
      }
    },
    { 
      name: "Silver", 
      icon: "medal", 
      unlocked: true, 
      current: true,
      requirements: {
        rides: 300,
        revenue: "2M",
        rating: 4,
        commission: "14"
      }
    },
    { 
      name: "Gold", 
      icon: "medal", 
      unlocked: false,
      requirements: {
        rides: 500,
        revenue: "4M",
        rating: 4,
        commission: "13"
      }
    },
    { 
      name: "Platinum", 
      icon: "diamond", 
      unlocked: false,
      requirements: {
        rides: 700,
        revenue: "6M",
        rating: 4,
        commission: "12"
      }
    },
  ];

  // Circle progress calculations
  const size = 130;  // Réduit de 160 à 130
  const strokeWidth = 10;  // Réduit de 12 à 10
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

  // Render 4 gold stars
  const renderGradeStars = () => {
    const stars = [];
    for (let i = 0; i < 4; i++) {
      stars.push(
        <Icon key={`grade-star-${i}`} source="star" size={8} color={Colors.light.gold} />
      );
    }
    return stars;
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <View style={dpNavStyles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={dpNavStyles.backBtn}>
          <Icon source="arrow-left" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={dpNavStyles.title}>Mon Profil</Text>
        <View style={dpNavStyles.spacer} />
      </View>
    <LinearGradient
      colors={['#fefefe', '#f8f8f8']}
      style={styles.gradient}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
          
          {/* Introduction Texts */}
          <View style={styles.introSection}>
            <Text style={styles.introText}>
              Remporte un Trophée TOYA et Monte en grade ! Atteins tes objectifs, Baisse ta commission et Augmente tes revenus !
            </Text>
            <Text style={styles.introTextHighlight}>
              Profite des commissions exceptionnelles TOYA de 15% à 12% ! Les plus basses du marché !
            </Text>
          </View>

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

          {/* Progress Section with Circle */}
          <View style={styles.progressSection}>
            <Text style={styles.progressTitle}>PROGRESSION VERS {grades.next}</Text>
            
            <View style={styles.circleContainer}>
              <Svg width={size} height={size}>
                {/* Gradient Definition */}
                <Defs>
                  <SvgLinearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <Stop offset="0%" stopColor={Colors.light.gold} />
                    <Stop offset="100%" stopColor="#FFA500" />
                  </SvgLinearGradient>
                </Defs>
                
                {/* Background Circle */}
                <Circle
                  stroke="#e8e8e8"
                  fill="none"
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  strokeWidth={strokeWidth}
                />
                {/* Progress Circle with Gold Gradient */}
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
              
              {/* Center Content */}
              <View style={styles.circleCenter}>
                <Text style={styles.circlePercent}>{grades.percentageToNext}%</Text>
                <Text style={styles.circleLabel}>Complété</Text>
              </View>
            </View>

            <Text style={styles.nextGradeInfo}>
              Plus que <Text style={styles.nextGradeHighlight}>{grades.percentageRemaining}%</Text> pour atteindre le grade{" "}
              <Text style={styles.nextGradeName}>{grades.next}</Text>
            </Text>
          </View>

          {/* Statistics Section */}
          <View style={styles.statisticsSection}>
            <Text style={styles.statisticsTitle}>Mes Statistiques</Text>
            
            {/* First Row */}
            <View style={styles.statsRow}>
              {/* Total Rides */}
              <View style={styles.statCard}>
                <View style={[styles.statIconContainer, { backgroundColor: 'rgba(109, 86, 242, 0.1)' }]}>
                  <Icon source="car-side" size={26} color="#6D56F2" />
                </View>
                <Text style={styles.statValue}>{formatNumber(statistics.totalRides)}</Text>
                <Text style={styles.statLabel}>Courses</Text>
              </View>

              {/* Revenue */}
              <View style={styles.statCard}>
                <View style={[styles.statIconContainer, { backgroundColor: 'rgba(34, 197, 94, 0.1)' }]}>
                  <Icon source="cash-multiple" size={26} color="#22c55e" />
                </View>
                <Text style={styles.statValue}>{formatNumber(statistics.revenue)}</Text>
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
                <Text style={styles.statValue}>{statistics.averageRating}/5</Text>
                <Text style={styles.statLabel}>Note moyenne</Text>
              </View>

              {/* Current Grade */}
              <View style={styles.statCard}>
                <View style={[styles.statIconContainer, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                  <Icon source="trophy" size={26} color="#ef4444" />
                </View>
                <Text style={styles.statValue}>{statistics.currentGrade}/5</Text>
                <Text style={styles.statLabel}>Grades</Text>
              </View>
            </View>
          </View>

          {/* Grades List */}
          <View style={styles.gradesList}>
            <Text style={styles.gradesTitle}>Vos Réalisations</Text>
            
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
                    size={20}
                    color={grade.unlocked ? Colors.light.gold : '#666'}
                  />
                </View>
                <View style={styles.gradeInfoExpanded}>
                  <Text style={[
                    styles.gradeName,
                    grade.current && styles.gradeNameCurrent,
                  ]}>
                    {grade.name}
                  </Text>
                  
                  {/* Requirements Row - Single Line */}
                  {grade.name !== "Standard" && (
                    <View style={styles.requirementsRow}>
                      {/* Rides with icon */}
                      <Icon source="car" size={8} color="#666" />
                      <Text style={styles.requirementText}>{grade.requirements.rides} courses</Text>
                      
                      <Text style={styles.separator}>•</Text>
                      
                      {/* Revenue with icon */}
                      <Icon source="cash" size={8} color="#666" />
                      <Text style={styles.requirementText}>{grade.requirements.revenue} FCFA</Text>
                      
                      <Text style={styles.separator}>•</Text>
                      
                      {/* Rating - 4 gold stars */}
                      <View style={styles.starsContainer}>
                        {renderGradeStars()}
                      </View>
                      
                      <Text style={styles.separator}>•</Text>
                      
                      {/* Commission */}
                      <Text style={styles.requirementText}>{grade.requirements.commission}% commission</Text>
                    </View>
                  )}
                  
                  <Text style={[
                    styles.gradeStatus,
                    grade.unlocked && styles.gradeStatusUnlocked,
                  ]}>
                    {grade.current
                      ? "GRADE ACTUEL"
                      : grade.unlocked
                      ? "DÉBLOQUÉ"
                      : "À DÉBLOQUER"}
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
            ))}
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
    paddingVertical: 15,  // Réduit de 20 à 15
    paddingHorizontal: 14,  // Réduit de 16 à 14
  },
  container: {
    flex: 1,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  introSection: {
    marginBottom: 14,  // Réduit de 20 à 14
    paddingHorizontal: 8,
  },
  introText: {
    fontSize: 12,  // Réduit de 14 à 12
    color: '#000',
    textAlign: 'center',
    lineHeight: 17,  // Réduit de 20 à 17
    marginBottom: 8,  // Réduit de 10 à 8
    fontWeight: '500',
  },
  introTextHighlight: {
    fontSize: 12,  // Réduit de 14 à 12
    color: '#000',
    textAlign: 'center',
    lineHeight: 17,  // Réduit de 20 à 17
    fontWeight: '600',
  },
  header: {
    alignItems: 'center',
    marginBottom: 18,  // Réduit de 30 à 18
    backgroundColor: '#6D56F2',
    paddingVertical: 20,  // Réduit de 30 à 20
    paddingHorizontal: 16,  // Réduit de 20 à 16
    borderRadius: 16,  // Réduit de 20 à 16
  },
  profileImageContainer: {
    marginBottom: 10,  // Réduit de 12 à 10
  },
  profileImage: {
    width: 65,  // Réduit de 80 à 65
    height: 65,  // Réduit de 80 à 65
    borderRadius: 32.5,
    borderWidth: 3,
    borderColor: '#fff',
  },
  driverName: {
    fontSize: 22,  // Réduit de 26 à 22
    fontWeight: '700',
    color: '#fff',
    marginBottom: 7,  // Réduit de 8 à 7
    textAlign: 'center',
  },
  currentGradeBadge: {
    paddingVertical: 5,  // Réduit de 6 à 5
    paddingHorizontal: 16,  // Réduit de 20 à 16
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 2,
    borderColor: '#fff',
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 11,  // Réduit de 12 à 11
    fontWeight: '600',
    color: '#fff',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  progressSection: {
    backgroundColor: '#f5f5f5',
    borderRadius: 14,  // Réduit de 16 à 14
    padding: 16,  // Réduit de 20 à 16
    marginBottom: 14,  // Réduit de 20 à 14
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  progressTitle: {
    fontSize: 10,  // Réduit de 11 à 10
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 14,  // Réduit de 20 à 14
    textAlign: 'center',
  },
  circleContainer: {
    position: 'relative',
    marginBottom: 14,  // Réduit de 20 à 14
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circlePercent: {
    fontSize: 28,  // Réduit de 36 à 28
    fontWeight: '700',
    color: Colors.light.gold,
  },
  circleLabel: {
    fontSize: 10,  // Réduit de 12 à 10
    color: '#666',
    marginTop: 3,
  },
  nextGradeInfo: {
    marginTop: 10,  // Réduit de 12 à 10
    fontSize: 11,  // Réduit de 13 à 11
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
    borderRadius: 14,  // Réduit de 16 à 14
    padding: 14,  // Réduit de 20 à 14
    marginBottom: 14,  // Réduit de 20 à 14
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  statisticsTitle: {
    fontSize: 16,  // Réduit de 18 à 16
    fontWeight: '700',
    marginBottom: 12,  // Réduit de 16 à 12
    textAlign: 'center',
    color: '#333',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,  // Réduit de 12 à 10
  },
  statCard: {
    width: '48%',
    backgroundColor: '#f9f9f9',
    borderRadius: 10,  // Réduit de 12 à 10
    padding: 10,  // Réduit de 14 à 10
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  statIconContainer: {
    width: 46,  // Réduit de 56 à 46
    height: 46,  // Réduit de 56 à 46
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,  // Réduit de 10 à 8
  },
  statValue: {
    fontSize: 17,  // Réduit de 20 à 17
    fontWeight: '700',
    color: '#333',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 10,  // Réduit de 11 à 10
    color: '#666',
    textAlign: 'center',
    fontWeight: '500',
  },
  gradesList: {
    width: '100%',
  },
  gradesTitle: {
    fontSize: 16,  // Réduit de 18 à 16
    fontWeight: '700',
    marginBottom: 12,  // Réduit de 16 à 12
    textAlign: 'center',
    color: '#333',
  },
  gradeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,  // Réduit de 12 à 10
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    borderRadius: 10,  // Réduit de 12 à 10
    marginBottom: 8,  // Réduit de 10 à 8
    borderWidth: 1,
    borderColor: '#d0d0d0',
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
    width: 32,  // Réduit de 35 à 32
    height: 32,  // Réduit de 35 à 32
    marginRight: 9,  // Réduit de 10 à 9
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradeInfoExpanded: {
    flex: 1,
  },
  gradeName: {
    fontSize: 14,  // Réduit de 15 à 14
    fontWeight: '600',
    marginBottom: 2,  // Réduit de 3 à 2
    color: '#000',
  },
  gradeNameCurrent: {
    color: '#6D56F2',
  },
  requirementsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
    gap: 2,  // Réduit de 3 à 2
    marginBottom: 2,  // Réduit de 3 à 2
  },
  requirementText: {
    fontSize: 8,  // Réduit de 9 à 8
    color: '#666',
    fontWeight: '500',
  },
  separator: {
    fontSize: 7,  // Réduit de 8 à 7
    color: '#999',
    marginHorizontal: 1,  // Réduit de 2 à 1
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 0.5,  // Réduit de 1 à 0.5
  },
  gradeStatus: {
    fontSize: 8,  // Réduit de 9 à 8
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.3,  // Réduit de 0.5 à 0.3
  },
  gradeStatusUnlocked: {
    color: Colors.light.gold,
  },
  checkmarkContainer: {
    alignSelf: 'flex-start',
    marginLeft: 6,  // Réduit de 8 à 6
  },
  checkmark: {
    width: 16,  // Réduit de 18 à 16
    height: 16,  // Réduit de 18 à 16
    borderRadius: 8,
    backgroundColor: Colors.light.gold,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

const dpNavStyles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { padding: 4 },
  title: { flex: 1, textAlign: "center", fontSize: 18, fontWeight: "bold", color: "#333" },
  spacer: { width: 32 },
});