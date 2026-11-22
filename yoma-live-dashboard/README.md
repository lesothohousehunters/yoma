# YOMA Lesotho Analytics: Live Dashboard

This is a free live dashboard for Plant One Tree and Youth Power Hub. It reads the three Google Forms: Registration, Wave 1 and Wave 2.

- **Sign-in:** the dashboard is protected by a login page.
- **Updates:** while the page is open it refreshes itself every 20 seconds, so new form answers show within about half a minute.
- **Privacy:** it shows totals only. No names or phone numbers of young people appear on it.
- **Cost:** everything here is free (Google Forms, Google Sheets, Google Apps Script and GitHub Pages).

**Login**
- Username: `yoma@plantonetree.eco`
- Password: given to the team separately. It is not written anywhere in these files; `Code.gs` keeps only a scrambled fingerprint of it.

---

## How it fits together

```
Google Forms ─► Response Sheets ─► Apps Script (Code.gs) ─► Dashboard (login first)
                 (already linked)    (your Google account)     ├─ Apps Script link  (main)
                                                               └─ GitHub Pages link (optional)
GitHub Pages also hosts logo.png and background.png for the login page.
```

## What is in this folder

| File | What it is |
|---|---|
| `apps-script/Code.gs` | The engine. Your three sheet links and the login are already filled in. |
| `apps-script/Index.html` | The login page and the dashboard, as served by Apps Script. |
| `docs/index.html` | The same page for GitHub Pages. |
| `docs/logo.png` | **Add this yourself.** The logo shown on the login page. |
| `docs/background.png` | **Add this yourself.** The photo behind the login page. |

If `logo.png` or `background.png` is missing, the page still works. It uses the built-in POT logo and a green background instead.

---

## Part A: Switch on the dashboard in Google (about 10 minutes)

Sign in to the **Google account that owns the three response sheets**.

### 1. Create the Apps Script project

1. Go to **script.google.com** and click **New project**.
2. Click "Untitled project" at the top and rename it `YOMA Lesotho Analytics`.
3. Delete everything in `Code.gs`, then paste in the whole of `apps-script/Code.gs`.
4. Click **+** next to *Files*, choose **HTML**, and name it `Index`. Apps Script adds `.html` itself.
5. Delete everything in the new file, then paste in the whole of `apps-script/Index.html`.
6. Click **Save** (the disk icon).

### 2. Give permission (one time only)

1. In the function menu at the top, choose **authorize**, then click **Run**.
2. Click **Review permissions** and choose your account.
3. If Google says "Google hasn't verified this app", click **Advanced**, then **Go to YOMA Lesotho Analytics (unsafe)**. This is normal for your own scripts.
4. Click **Allow**.
5. Check the log at the bottom. It should show the number of answers in each form, for example `Registrations: 12, Wave 1: 0, Wave 2: 0`.

### 3. Publish

1. Click **Deploy**, then **New deployment**.
2. Click the gear icon and choose **Web app**.
3. Fill in the settings:
   - Description: `Live dashboard`
   - Execute as: **Me**
   - Who has access: **Anyone**

   "Anyone" only means the page opens without a Google account. The login page still protects the numbers.
4. Click **Deploy** and copy the **Web app URL**. It ends in `/exec`.

**That link is your dashboard.** Open it, sign in, and share the link with the team.

### 4. Check the connection

1. Scroll to **Connection check** at the bottom of the dashboard.
2. Each form should say **all columns found**.
3. If it says "columns not found", rename that question in the form so it includes the words in the table near the end of this file.

---

## Part B: GitHub, with the login photo and logo

### 1. Upload

1. On **github.com**, click **+**, then **New repository**. Name it `yoma-live-dashboard` and choose **Public**. Free GitHub Pages needs a public repository.
2. Click **uploading an existing file**.
3. Drag in `README.md`, the `apps-script` folder and the `docs` folder.
4. Add your **`logo.png`** and **`background.png`** inside the `docs` folder. The names must be exactly these, in lower case.
5. Click **Commit changes**.

### 2. Turn on GitHub Pages

1. Go to **Settings**, then **Pages**. Under *Source*, choose **Deploy from a branch**.
2. Pick branch **main** and folder **/docs**, then click **Save**.
3. After a minute or two you get a link, for example `https://<your-username>.github.io/yoma-live-dashboard/`.

### 3. Connect the GitHub page to Google

1. In GitHub, open `docs/index.html` and click the pencil icon to edit it.
2. Find this line and paste your **Web app URL** from Part A, step 3:
   ```js
   var API_URL = 'PASTE_WEB_APP_URL_HERE';
   ```
3. Click **Commit changes**.

Now the GitHub link also opens the login page, with your photo and logo.

### 4. Show the photo and logo on the Apps Script link too

1. In Apps Script, open `Code.gs` and find `IMAGES_URL`.
2. Paste your GitHub Pages address, ending in `/`:
   ```js
   IMAGES_URL: 'https://<your-username>.github.io/yoma-live-dashboard/',
   ```
3. Save, then redeploy (see "When you change something later" below).

---

## Changing the password

1. In Apps Script, scroll to the bottom of `Code.gs`, to `makePasswordHash`.
2. Type the new password between the quotes: `const NEW_PASSWORD = 'NewPassword';`
3. Choose **makePasswordHash** in the function menu at the top and click **Run**.
4. Copy the long code from the log into `PASSWORD_SHA256` near the top of the file.
5. Clear the password from `NEW_PASSWORD` again. Save, then redeploy.

To change the username, edit `LOGIN_USER` near the top of `Code.gs`.

Sign-in lasts 6 hours on each device. Change `SESSION_HOURS` to adjust this (6 is the most Google allows). **Sign out** is at the top right of the dashboard.

## When you change something later

After any change in Apps Script:

1. Click **Deploy**, then **Manage deployments**.
2. Click the pencil and set *Version* to **New version**.
3. Click **Deploy**.

The link stays the same. Changes to GitHub files update on their own within a minute or two.

## Form questions the dashboard looks for

The dashboard finds each column by words in the question title. If you rename a question, keep these words in it.

| Form | The question title must contain |
|---|---|
| Registration | "volunteer", "District" (at the start), "Age" (at the start), "gender", "difficulty", "finished", "parent" or "guardian", "contact them" |
| Wave 1 | "District", "Age", "gender", "buy first" or "would you buy", "heard of" |
| Wave 2 | "District", "gender", "register and use", "problems", "better" |

District answers should come from a dropdown with these 10 names, so each answer lands in the right region:

| Region | Coordinator | Districts |
|---|---|---|
| North | Miss Palesa | Butha-Buthe, Leribe, Berea, Mokhotlong |
| Central | Miss Portia | Maseru, Thaba-Tseka |
| South | Mr. Justice | Mafeteng, Mohale's Hoek, Quthing, Qacha's Nek |

Volunteer name also works best as a dropdown. Volunteers are counted by spelling.

## Troubleshooting

| What you see | What to do |
|---|---|
| "Wrong username or password." | Check for capital letters in the password. The username can be in any case. |
| "Please sign in again." | The 6-hour sign-in ended, or someone clicked Sign out. Sign in again. |
| A form shows "not connected" | That sheet link in `Code.gs` is missing. |
| A red error naming a form | The Apps Script account can't open that sheet. Use the Google account that owns the sheets. |
| "columns not found" | Rename the question to include the words in the table above. |
| GitHub page: "Paste your web app link…" | Fill in `API_URL` in `docs/index.html`. |
| GitHub page: "Cannot sign in" | Check that the deployment is set to **Who has access: Anyone** and that the link ends in `/exec`. |
| No photo on the login page | Check that `docs/background.png` is spelled exactly like this. On the Apps Script link, also fill in `IMAGES_URL`. |

---

Contact: Miss Mpho Lebesa, Plant One Tree Managing Director and YOMA Project Manager, potlesotho@gmail.com
