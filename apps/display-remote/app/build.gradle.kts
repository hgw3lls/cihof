plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "org.cihof.remote"
    compileSdk = 35

    defaultConfig {
        applicationId = "org.cihof.remote"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
    }

    // A release build is signed with the museum's own key, kept off this
    // repository: npm run package:display-remote -- --release reads where it is
    // from CIHOF_ANDROID_KEYSTORE, _KEYSTORE_PASSWORD, _KEY_ALIAS and _KEY_PASSWORD.
    val keystore = System.getenv("CIHOF_ANDROID_KEYSTORE")
    signingConfigs {
        if (keystore != null) {
            create("museum") {
                storeFile = file(keystore)
                storePassword = System.getenv("CIHOF_ANDROID_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("CIHOF_ANDROID_KEY_ALIAS")
                keyPassword = System.getenv("CIHOF_ANDROID_KEY_PASSWORD")
            }
        }
    }
    buildTypes {
        release {
            isMinifyEnabled = false
            if (keystore != null) signingConfig = signingConfigs.getByName("museum")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    testOptions {
        unitTests.all { it.systemProperty("cihof.root", rootProject.projectDir.resolve("../..").canonicalPath) }
    }
}

dependencies {
    // scrypt, for turning the pairing code into the key, as the display does (connection-auth.mjs).
    implementation("org.bouncycastle:bcprov-jdk18on:1.79")
    testImplementation("junit:junit:4.13.2")
    // Android's own org.json is only a stub off a phone.
    testImplementation("org.json:json:20240303")
}
