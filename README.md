# VILLAGIO Landing Page - Deployment Guide

## Files Included
- `index.html` - Main landing page
- `styles/main.css` - All styling
- `scripts/main.js` - Form handling & popups
- `assets/images/Website/` - All images
- `AppsScript.js` - Google Sheets integration

## Upload to Server
Upload all files to `/public_html/` (or root folder) on your web host (Hostinger or any provider).

## Lead Collection Setup
The Google Apps Script is already configured and connected to your Google Sheet:
- **Spreadsheet ID:** `1qerIH7e2L3iugXqbR044IolInIfvY8en0lq0FCO2Bgg`
- **Leads appear in:** "Leads" tab

## Configuration

### Phone Number
If you need to change the contact number, update these files:
- `index.html` - Search `8010473982` and replace (5 occurrences)
- `scripts/main.js` - Line 9: WhatsApp link

### Google Sheet
Lead data is sent to: `1qerIH7e2L3iugXqbR044IolInIfvY8en0lq0FCO2Bgg`

## What to Test
- [ ] Form submission shows "Thank You" message
- [ ] Floor plan click opens popup
- [ ] "Avail This Offer" button opens popup
- [ ] WhatsApp floating button works
- [ ] Mobile responsive check (hamburger menu, sticky CTA)

## Analytics (Built-in)
The site automatically tracks and sends to your Google Sheet:
- Scroll depth (25%, 50%, 75%, 100%)
- Time on site
- Form opens/clicks/submissions
- WhatsApp clicks
- Call button clicks
- Device type, browser, OS
- City, timezone, location

No Google Analytics setup required.

## Support
For issues: check browser console for JavaScript errors