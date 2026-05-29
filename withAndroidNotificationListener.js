const { withAndroidManifest } = require('@expo/config-plugins');

function withAndroidNotificationListener(config) {
  return withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults;
    const app = androidManifest.manifest.application[0];

    const service = {
      $: {
        'android:name': 'com.jhagoba.RNAndroidNotificationListener.RNAndroidNotificationListener',
        'android:label': '@string/app_name',
        'android:permission': 'android.permission.BIND_NOTIFICATION_LISTENER_SERVICE',
        'android:exported': 'true'
      },
      'intent-filter': [
        {
          action: [
            {
              $: {
                'android:name': 'android.service.notification.NotificationListenerService'
              }
            }
          ]
        }
      ]
    };

    if (!app.service) {
      app.service = [];
    }

    const serviceExists = app.service.some(s => s.$ && s.$['android:name'] === 'com.jhagoba.RNAndroidNotificationListener.RNAndroidNotificationListener');
    if (!serviceExists) {
      app.service.push(service);
    }

    return config;
  });
}

module.exports = withAndroidNotificationListener;
