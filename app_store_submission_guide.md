# App Store Submission Guide: Neon Surge 3D

To publish **Neon Surge 3D** on the Apple App Store, you need to "wrap" your web code (HTML/JS/CSS) into a native iOS container. The modern industry standard for this is **Capacitor**.

## 1. Prerequisites
- **Apple Developer Program**: You must enroll ($99 USD/year) at [developer.apple.com](https://developer.apple.com/).
- **Hardware**: You MUST have a **Mac** with the latest version of **Xcode** installed.
- **Icon/Assets**: Large 1024x1024 icon and various screenshots of the game.

---

## 2. Technical Setup (Capacitor)
Run these commands in your project terminal on your Mac:

### Install Capacitor
```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios
```

### Initialize Project
```bash
npx cap init
```
*When prompted, name the app "Neon Surge 3D" and use a unique Bundle ID like `com.yourname.neonsurge`.*

### Build the Web Game
```bash
npm run build
```

### Create the iOS App
```bash
npx cap add ios
npx cap copy
```

---

## 3. Xcode Deployment
Once the commands above finish, open the project in Xcode:
```bash
npx cap open ios
```

**Inside Xcode:**
1. Click the blue project icon on the left.
2. Go to **Signing & Capabilities** and select your Developer Team.
3. Use a real iPhone (connected via USB) as the build target.
4. Press the **Play** button to launch the game natively on your phone!

---

## 4. Submission to App Store
1. **Archive**: In Xcode, go to `Product > Archive`.
2. **Distribute**: Click `Distribute App` and choose `App Store Connect`.
3. **App Store Connect**: Log in to [appstoreconnect.apple.com](https://appstoreconnect.apple.com/), create a "New App" record, and fill out:
   - App Name & Description.
   - Screenshots & Icons.
   - **Privacy Policy**: Required for App Store apps.
4. **Submit for Review**: Apple usually takes 24-48 hours to review the game.

> [!TIP]
> **Why Capacitor?** It keeps your Gyroscope and Touch logic working perfectly while giving you access to native iOS features like Game Center and Push Notifications later if you want!
