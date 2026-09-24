import { AppRegistry } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import { name as appName } from './app.json';

// ✅ Configuration du background handler AVANT l'enregistrement de l'app
messaging().setBackgroundMessageHandler(async remoteMessage => {
  console.log('📩 Message reçu en background:', remoteMessage);
  // Vous pouvez traiter la notification ici si nécessaire
});

// Import de l'app après la configuration du handler
import App from './app/_layout';

AppRegistry.registerComponent(appName, () => App);