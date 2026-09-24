const BASE_URL = "https://toya-backend-production.up.railway.app/api";
// const BASE_URL = "https://pre-prod.toya-vtc.com/api";

// Clé Maps (Weather API activée dessus). Repli sur la valeur du projet si l'env n'est pas fourni.
export const GOOGLE_WEATHER_API_KEY =
  process.env.EXPO_PUBLIC_GOOGLE_WEATHER_API_KEY || "AIzaSyDk23cRpIB-7kdqSuaucS3p-_syAgKNgEM";

export default BASE_URL;
