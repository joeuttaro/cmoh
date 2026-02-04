# GitHub Pages Setup Guide for joeuttaro/cmoh

## Quick Start

Your subscription URL will be:
```
https://joeuttaro.github.io/cmoh/canada-mens-olympic-hockey-2026.ics
```

## Detailed Setup Instructions

### 1. Push Code to GitHub (if not done already)

```bash
# If you haven't initialized git yet
git init
git add .
git commit -m "Initial commit: Olympic Hockey ICS feed"

# Add your remote (replace if you already have one)
git remote add origin https://github.com/joeuttaro/cmoh.git
git branch -M main
git push -u origin main
```

### 2. Enable GitHub Pages

1. **Navigate to your repository**: https://github.com/joeuttaro/cmoh
2. **Click "Settings"** (top menu, right side)
3. **Click "Pages"** in the left sidebar (under "Code and automation")
4. **Configure Pages**:
   - Under "Source", select **"Deploy from a branch"**
   - Under "Branch":
     - Select **`main`** from the dropdown
     - Select **`/ (root)`** from the folder dropdown
     - Click **"Save"**
5. **Wait 1-2 minutes** for GitHub to build your site
6. You'll see a message: "Your site is live at https://joeuttaro.github.io/cmoh/"

### 3. Verify the ICS File is Accessible

Test the direct link:
```
https://joeuttaro.github.io/cmoh/canada-mens-olympic-hockey-2026.ics
```

**What to expect:**
- ✅ **Success**: You see ICS calendar content (text starting with `BEGIN:VCALENDAR`)
- ❌ **404 Error**: Wait a few more minutes and refresh, or check that the file exists in the `public/` folder

### 4. Enable GitHub Actions (if needed)

1. Go to **Actions** tab in your repository
2. If you see a banner about enabling workflows, click **"I understand my workflows, go ahead and enable them"**
3. The workflow should appear and can be manually triggered

### 5. Test the Workflow

1. Go to **Actions** tab
2. Click **"Update ICS Calendar"** workflow
3. Click **"Run workflow"** → **"Run workflow"** (dropdown button)
4. Wait for it to complete (should take ~30 seconds)
5. Check that it says "✓ ICS calendar updated and committed" or "ℹ No changes detected"

### 6. Subscribe to Your Calendar

#### Apple Calendar (macOS/iOS)
1. Open Calendar app
2. **File** → **New Calendar Subscription** (or **Calendar** → **New Calendar Subscription** on iOS)
3. Paste: `https://joeuttaro.github.io/cmoh/canada-mens-olympic-hockey-2026.ics`
4. Set refresh frequency: **Every 6 hours** (recommended)
5. Click **Subscribe**

#### Google Calendar
1. Open Google Calendar (calendar.google.com)
2. Click the **"+"** next to "Other calendars" (left sidebar)
3. Select **"From URL"**
4. Paste: `https://joeuttaro.github.io/cmoh/canada-mens-olympic-hockey-2026.ics`
5. Click **"Add calendar"**

#### Outlook
1. Open Outlook Calendar
2. Right-click **"Other calendars"** → **"Add calendar"** → **"From Internet"**
3. Paste: `https://joeuttaro.github.io/cmoh/canada-mens-olympic-hockey-2026.ics`
4. Click **OK**

## Troubleshooting

### "404 Not Found" when accessing the ICS file

**Possible causes:**
1. GitHub Pages hasn't finished building (wait 2-3 minutes)
2. The file path is wrong (should be in `public/` folder)
3. GitHub Pages is not enabled or configured incorrectly

**Solutions:**
- Check that the file exists: `https://github.com/joeuttaro/cmoh/blob/main/public/canada-mens-olympic-hockey-2026.ics`
- Verify GitHub Pages is enabled in Settings → Pages
- Try accessing: `https://joeuttaro.github.io/cmoh/public/canada-mens-olympic-hockey-2026.ics` (with `/public/` in path)

### GitHub Action not running

**Check:**
1. Go to **Actions** tab
2. See if workflows are enabled (you may need to click "I understand my workflows...")
3. Check if there are any errors in the workflow logs
4. Verify the workflow file exists: `.github/workflows/update-ics.yml`

### Calendar not updating

**Check:**
1. Go to **Actions** tab and verify the workflow ran successfully
2. Check the workflow logs to see if games were found
3. Verify the ICS file was updated: Check the commit history on the `public/` file
4. Your calendar app may cache - try removing and re-adding the subscription

### "No games found" in workflow logs

The Hockey Canada page structure may have changed. You'll need to:
1. Check the actual HTML structure of the schedule page
2. Update the parsing logic in `lib/parse.js`
3. Test locally with `npm run build-ics`

## File Structure

The ICS file is generated in the **root directory** of the repository for a clean URL:
- File location: `canada-mens-olympic-hockey-2026.ics` (root)
- GitHub Pages URL: `https://joeuttaro.github.io/cmoh/canada-mens-olympic-hockey-2026.ics`

This provides the cleanest subscription URL without needing `/public/` in the path.
