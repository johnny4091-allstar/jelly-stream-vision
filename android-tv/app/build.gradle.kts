plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// ---- Single source of truth for the app version. Bump both on every release. ----
val appVersionCode = 2
val appVersionName = "2.0.0"

// Signing comes from env vars set by CI (never committed).
val ksFile = System.getenv("ANDROID_TV_KEYSTORE_FILE")
val hasSigning = !ksFile.isNullOrBlank() && file(ksFile).exists()

android {
    namespace = "app.aurora.tv"
    compileSdk = 35

    defaultConfig {
        applicationId = "app.aurora.tv" // permanent — never change after release
        minSdk = 24
        targetSdk = 35
        versionCode = appVersionCode
        versionName = appVersionName
        buildConfigField("String", "SITE_URL", "\"https://jelly-stream-vision.lovable.app\"")
        buildConfigField("String", "VERSION_URL", "\"https://jelly-stream-vision.lovable.app/api/public/tv-version\"")
    }

    signingConfigs {
        if (hasSigning) {
            create("release") {
                storeFile = file(ksFile!!)
                storeType = "pkcs12"
                storePassword = System.getenv("ANDROID_TV_STORE_PASSWORD")
                keyAlias = System.getenv("ANDROID_TV_KEY_ALIAS")
                keyPassword = System.getenv("ANDROID_TV_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            if (hasSigning) signingConfig = signingConfigs.getByName("release")
        }
    }

    buildFeatures { buildConfig = true }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.leanback:leanback:1.0.0")
}
