// app.config.js — Dynamic Expo config
// This file is loaded instead of app.json when present.
// It reads secret tokens from environment variables, so they are
// NEVER hardcoded in source control.
//
// Local dev:  values come from .env (gitignored)
// EAS Build:  values come from EAS Environment Variables / Secrets

import "dotenv/config"; // loads .env into process.env for local dev

const MAPBOX_DOWNLOAD_TOKEN = process.env.MAPBOX_DOWNLOADS_TOKEN || "";
const RV_API_KEY = process.env.RV_API_KEY || "";
const RV_PROJECT_ID = process.env.RV_PROJECT_ID || "";

if (!MAPBOX_DOWNLOAD_TOKEN) {
  console.warn(
    "⚠️  RNMAPBOX_MAPS_DOWNLOAD_TOKEN is not set. " +
    "Mapbox SDK download will fail during native builds. " +
    "Set it in .env or as an EAS Secret."
  );
}

export default {
  expo: {
    name: "BillboardAR",
    slug: "viroreact-starter-kit",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "billboardscanner",
    userInterfaceStyle: "light",
    newArchEnabled: true,

    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.fyp.billboardscanner",
      infoPlist: {
        NSCameraUsageDescription:
          "BillboardAR needs your camera to scan billboards and QR codes.",
        NSLocationWhenInUseUsageDescription:
          "BillboardAR uses your location to discover premium billboard offers near you.",
        NSLocationAlwaysAndWhenInUseUsageDescription:
          "BillboardAR uses background location to notify you of exclusive deals as you travel through the city.",
        UIBackgroundModes: ["location"],
      },
    },

    android: {
      package: "com.fyp.billboardscanner",
      adaptiveIcon: {
        backgroundColor: "#FFFFFF",
        foregroundImage: "./assets/images/android-icon-foreground.png",
        backgroundImage: "./assets/images/android-icon-background.png",
        monochromeImage: "./assets/images/android-icon-monochrome.png",
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      permissions: [
        "CAMERA",
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION",
        "ACCESS_BACKGROUND_LOCATION",
        "VIBRATE",
      ],
    },

    web: {
      output: "static",
      favicon: "./assets/images/favicon.png",
    },

    plugins: [
      "expo-router",
      [
        "@reactvision/react-viro",
        {
          provider: "reactvision",
          rvApiKey: RV_API_KEY,
          rvProjectId: RV_PROJECT_ID,
          ios: {
            includeSemantics: true,
          },
        },
      ],
      [
        "expo-splash-screen",
        {
          image: "./assets/images/splash-icon.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#000000",
        },
      ],
      [
        "expo-camera",
        {
          cameraPermission:
            "Billboard Scanner needs your camera to scan QR codes.",
        },
      ],
      [
        "expo-location",
        {
          locationWhenInUsePermission:
            "Billboard Scanner uses your location to show nearby offers.",
          locationBackgroundPermission:
            "Billboard Scanner needs background location to notify you of nearby offers even when the app is closed.",
        },
      ],
      [
        "@rnmapbox/maps",
        {
          RNMapboxMapsImpl: "mapbox",
          RNMapboxMapsDownloadToken: MAPBOX_DOWNLOAD_TOKEN,
          RNMapboxMapsAccessToken: process.env.EXPO_PUBLIC_MAPBOX_TOKEN || "",
        },
      ],
      [
        "expo-build-properties",
        {
          android: {
            gradleProperties: {
              MAPBOX_DOWNLOADS_TOKEN: MAPBOX_DOWNLOAD_TOKEN,
            },
          },
        },
      ],
      "expo-audio",
      "expo-video",
      "expo-notifications",
    ],

    experiments: {
      typedRoutes: false,
    },

    extra: {
      router: {},
      eas: {
        projectId: "99ecce4f-607b-4e37-b84a-cf0b9efa7a86",
      },
    },
  },
};
