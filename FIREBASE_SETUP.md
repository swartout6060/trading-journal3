# SVJ Trades Firebase Setup

Follow these steps before uploading the updated website.

## 1. Create a Firebase project

1. Go to https://console.firebase.google.com/
2. Click **Add project**.
3. Name it whatever you want, for example **SVJ Trades**.
4. Create the project.

## 2. Add a web app

1. Inside the Firebase project, click the web icon: `</>`.
2. Register the app.
3. Firebase will show a config object.
4. Copy those values into `firebase-config.js`.

This site uses the plain HTML script-tag Firebase compat version. Do not use npm imports.

## 3. Enable email/password login

1. In Firebase, open **Authentication**.
2. Click **Get started**.
3. Go to **Sign-in method**.
4. Enable **Email/Password**.
5. Go to **Settings > Authorized domains** and make sure these are allowed:
   - `localhost`
   - `swartout6060.github.io`

## 4. Create Firestore

1. Open **Firestore Database**.
2. Click **Create database**.
3. Choose production mode.
4. Pick the closest region.

## 5. Add Firestore security rules

Open **Firestore Database > Rules** and paste the contents of `firestore.rules`:

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

Publish the rules.

## 6. Upload the website

Upload all updated files to GitHub Pages or your web host, including:

- `index.html`
- `styles.css`
- `app.js`
- `firebase-config.js`
- `manifest.json`
- `service-worker.js`
- `icons/`
- your background image file

## Data layout

Each user's data is saved under their own Firebase UID:

```text
users/{uid}
users/{uid}/trades/{tradeId}
users/{uid}/backtestRecords/{recordId}
users/{uid}/milestones/{milestoneId}
users/{uid}/settings/main
users/{uid}/consistency/main
users/{uid}/dashboardStats/main
```

Screenshots are not uploaded to Firebase right now because Firebase Storage requires an upgrade. The journal can still show a local preview before saving, and Firestore only saves screenshot file names/notes so documents stay small.

Firebase Storage can be added later if you upgrade Firebase. Until then, Authentication and Firestore are the only required Firebase services.
