import { registerRootComponent } from 'expo';
import App from './App';
import { registerUalaHeadlessTask } from './src/services/UalaNotificationListener';

registerUalaHeadlessTask();
registerRootComponent(App);
