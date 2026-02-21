const IS_DEV = process.env.APP_VARIANT === 'development';

module.exports = {
    expo: {
        name: IS_DEV ? "DigitalBoostEmpire DEV" : "DigitalBoostEmpire",
        slug: "DigitalBoostEmpire-app",
        version: "1.0.0",
        orientation: "portrait",
        icon: "./assets/logo_imperial.png",
        userInterfaceStyle: "light",
        newArchEnabled: true,
        splash: {
            image: "./assets/logo_imperial.png",
            resizeMode: "contain",
            backgroundColor: "#000000"
        },
        ios: {
            supportsTablet: true
        },
        android: {
            package: IS_DEV ? "com.guille.digitalboostempire.dev" : "com.guille.digitalboostempire",
            adaptiveIcon: {
                foregroundImage: "./assets/logo_imperial.png",
                backgroundColor: "#000000"
            },
            edgeToEdgeEnabled: true
        },
        web: {
            favicon: "./assets/favicon.png"
        },
        extra: {
            eas: {
                projectId: "bba879b7-d1c1-4e54-bfd8-21f57abf4f85"
            }
        },
        updates: {
            url: "https://u.expo.dev/bba879b7-d1c1-4e54-bfd8-21f57abf4f85"
        },
        runtimeVersion: {
            policy: "appVersion"
        },
        plugins: [
            [
                "expo-image-picker",
                {
                    "photosPermission": "The app accesses your photos to let you upload product images."
                }
            ],
            [
                "expo-build-properties",
                {
                    "android": {
                        "enableProguardInReleaseBuilds": true,
                        "enableShrinkResourcesInReleaseBuilds": true,
                        "extraProguardRules": "-keep class com.google.android.gms.** { *; }"
                    }
                }
            ],
            "expo-asset",
            "@react-native-community/datetimepicker"
        ]
    }
};
