import BASE_URL from "../constants/api/BASE_URL";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useState,useEffect } from "react";
import { Text,View} from "react-native";

export default function Session({navigation}: {navigation: any}){
//const [IsAuthenticated, setIsAuthenticated]= useState(false);
const checkSession = async () => {
    const token = await AsyncStorage.getItem('authToken');

    // console.log("session",token)

    navigation.navigate('index');
    // if (token) {
    //     navigation.navigate('MainTabs');
    // } else {
    //     navigation.navigate('index');
    // }
  };
  useEffect(() => {
    checkSession();
  }, []);
  return (
    <>
         {/* <Text>Verification de session...</Text> */}
    </>
  );
}