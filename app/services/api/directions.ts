const GOOGLE_MAPS_API_KEY = "AIzaSyDk23cRpIB-7kdqSuaucS3p-_syAgKNgEM";

export const getDirections = async (
  origLat: number,
  origLon: number,
  destLat: number,
  destLon: number,
  lang: string = "fr"
): Promise<Response> => {
  const url =
    `https://maps.googleapis.com/maps/api/directions/json` +
    `?origin=${origLat},${origLon}` +
    `&destination=${destLat},${destLon}` +
    `&mode=driving&language=${lang}` +
    `&key=${GOOGLE_MAPS_API_KEY}`;
  return fetch(url);
};
