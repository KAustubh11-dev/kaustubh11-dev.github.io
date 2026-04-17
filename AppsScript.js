const SPREADSHEET_ID = '1qerIH7e2L3iugXqbR044IolInIfvY8en0lq0FCO2Bgg';
const SHEET_NAMES = {
  LEADS: 'Leads',
  VISITORS: 'Visitors',
  USER_BEHAVIOR: 'User Behavior',
  SESSION_SUMMARY: 'Session Summary',
  CAMPAIGN_ATTRIBUTION: 'Campaign Attribution'
};

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(15000);
  
  try {
    const content = e.postData.contents;
    if (!content) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'No payload' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    const payload = JSON.parse(content);
    Logger.log('Received action: ' + payload.action);
    
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheets = ss.getSheets();
    Logger.log('Available sheets: ' + sheets.map(s => s.getName()).join(', '));
    
    if (payload.batch && Array.isArray(payload.batch)) {
      payload.batch.forEach(item => processAction(ss, item));
      return ContentService.createTextOutput(JSON.stringify({ success: true, processed: payload.batch.length }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    return processAction(ss, payload);
  } catch (error) {
    Logger.log('Error: ' + error.message);
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function processAction(ss, payload) {
  const action = payload.action;
  
  switch (action) {
    case 'submitLead':
      return submitLead(ss, payload);
    case 'trackVisitor':
      return trackVisitor(ss, payload);
    case 'trackBehavior':
      return trackBehavior(ss, payload);
    case 'saveSession':
      return saveSession(ss, payload);
    case 'trackCampaign':
      return trackCampaign(ss, payload);
    default:
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'Invalid action' }))
        .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }))
    .setMimeType(ContentService.MimeType.JSON);
}

function sanitizeInput(value) {
  if (typeof value !== 'string') return '';
  return String(value).replace(/[\r\n\t]/g, ' ').trim().substring(0, 500);
}

function getOrCreateSheet(ss, sheetName, headers) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  return sheet;
}

function appendRow(ss, sheetName, headers, rowData) {
  const sheet = getOrCreateSheet(ss, sheetName, headers);
  const lastRow = sheet.getLastRow();
  sheet.getRange(lastRow + 1, 1, 1, rowData.length).setValues([rowData]);
}

function isDuplicateLead(ss, phone, email) {
  if (!phone && !email) return false;
  const sheet = ss.getSheetByName(SHEET_NAMES.LEADS);
  if (!sheet) return false;
  
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;
  
  const data = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
  for (let i = 0; i < data.length; i++) {
    const rowPhone = String(data[i][2] || '').replace(/\D/g, '');
    const rowEmail = String(data[i][3] || '').toLowerCase();
    if (phone && rowPhone === phone.replace(/\D/g, '')) return true;
    if (email && rowEmail === email.toLowerCase()) return true;
  }
  return false;
}

function submitLead(ss, payload) {
  const data = payload.data;
  
  if (!data.name || !data.phone) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'Name and phone required' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  if (isDuplicateLead(ss, data.phone, data.email)) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'Duplicate lead', isDuplicate: true }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  const headers = [
    'Timestamp', 'Full Name', 'Phone', 'Country Code', 'Email', 'Interest', 'Source Form',
    'UTM Source', 'UTM Medium', 'UTM Campaign', 'UTM Content',
    'Device Type', 'OS', 'Browser', 'City', 'Location', 'Timezone',
    'Time on Site (sec)', 'Clicks Before Conversion', 'Session ID'
  ];
  
  const row = [
    new Date(),
    sanitizeInput(data.name),
    sanitizeInput(data.phone),
    sanitizeInput(data.country_code || '+91'),
    sanitizeInput(data.email),
    sanitizeInput(data.looking_for || data.interest || ''),
    sanitizeInput(data.source_form || 'Hero Form'),
    sanitizeInput(data.utm_source || ''),
    sanitizeInput(data.utm_medium || ''),
    sanitizeInput(data.utm_campaign || ''),
    sanitizeInput(data.utm_content || ''),
    sanitizeInput(data.device_type || ''),
    sanitizeInput(data.os || ''),
    sanitizeInput(data.browser || ''),
    sanitizeInput(data.city || ''),
    sanitizeInput(data.location || ''),
    sanitizeInput(data.timezone || ''),
    parseInt(data.time_on_site) || 0,
    parseInt(data.clicks_before_conversion) || 0,
    sanitizeInput(data.session_id || '')
  ];
  
  appendRow(ss, SHEET_NAMES.LEADS, headers, row);
  
return ContentService.createTextOutput(JSON.stringify({ success: true, leadId: row[0].toISOString() }))
      .setMimeType(ContentService.MimeType.JSON);
}

function trackVisitor(ss, payload) {
  const data = payload.data;
  const headers = [
    'Timestamp', 'Session ID', 'Page URL', 'Referrer',
    'IP Address', 'ISP', 'City', 'Pincode', 'Region', 'Country',
    'Timezone', 'Entry Time', 'Bounced'
  ];
  
  const row = [
    new Date(),
    sanitizeInput(data.session_id || ''),
    sanitizeInput(data.page_url || ''),
    sanitizeInput(data.referrer || ''),
    sanitizeInput(data.ip || ''),
    sanitizeInput(data.isp || ''),
    sanitizeInput(data.city || ''),
    sanitizeInput(data.pincode || ''),
    sanitizeInput(data.region || ''),
    sanitizeInput(data.country || ''),
    sanitizeInput(data.timezone || ''),
    sanitizeInput(data.entry_time || ''),
    data.bounced ? 'Yes' : 'No'
  ];
  
  appendRow(ss, SHEET_NAMES.VISITORS, headers, row);
  
  return ContentService.createTextOutput(JSON.stringify({ success: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function trackBehavior(ss, payload) {
  const data = payload.data;
  const headers = [
    'Timestamp', 'Session ID', 'Event Type', 'Event Label', 'Page URL',
    'Section Name', 'Scroll Depth (%)', 'Time on Site (sec)',
    'Device Type', 'Browser', 'OS', 'City', 'Timezone'
  ];
  
  const row = [
    new Date(),
    sanitizeInput(data.session_id || ''),
    sanitizeInput(data.event_type || ''),
    sanitizeInput(data.event_label || ''),
    sanitizeInput(data.page_url || ''),
    sanitizeInput(data.section_name || ''),
    parseInt(data.scroll_depth) || 0,
    parseInt(data.time_on_site) || 0,
    sanitizeInput(data.device_type || ''),
    sanitizeInput(data.browser || ''),
    sanitizeInput(data.os || ''),
    sanitizeInput(data.city || ''),
    sanitizeInput(data.timezone || '')
  ];
  
  appendRow(ss, SHEET_NAMES.USER_BEHAVIOR, headers, row);
  
  return ContentService.createTextOutput(JSON.stringify({ success: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function saveSession(ss, payload) {
  const data = payload.data;
  const headers = [
    'Session ID', 'Start Time', 'End Time', 'Duration (sec)', 'Page Views',
    'Scroll Depth Reached (%)', 'Forms Opened', 'Forms Abandoned', 'Forms Submitted',
    'WhatsApp Clicks', 'Call Clicks', 'UTM Source', 'UTM Medium', 'UTM Campaign',
    'Device Type', 'Browser', 'OS', 'Entry Page', 'Exit Page', 'City', 'Timezone'
  ];
  
  const row = [
    sanitizeInput(data.session_id || ''),
    sanitizeInput(data.start_time || ''),
    sanitizeInput(data.end_time || ''),
    parseInt(data.duration) || 0,
    parseInt(data.page_views) || 0,
    parseInt(data.scroll_depth_reached) || 0,
    parseInt(data.forms_opened) || 0,
    parseInt(data.forms_abandoned) || 0,
    parseInt(data.forms_submitted) || 0,
    parseInt(data.whatsapp_clicks) || 0,
    parseInt(data.call_clicks) || 0,
    sanitizeInput(data.utm_source || ''),
    sanitizeInput(data.utm_medium || ''),
    sanitizeInput(data.utm_campaign || ''),
    sanitizeInput(data.device_type || ''),
    sanitizeInput(data.browser || ''),
    sanitizeInput(data.os || ''),
    sanitizeInput(data.entry_page || ''),
    sanitizeInput(data.exit_page || ''),
    sanitizeInput(data.city || ''),
    sanitizeInput(data.timezone || '')
  ];
  
  appendRow(ss, SHEET_NAMES.SESSION_SUMMARY, headers, row);
  
  return ContentService.createTextOutput(JSON.stringify({ success: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function trackCampaign(ss, payload) {
  const data = payload.data;
  const headers = [
    'Timestamp', 'Session ID', 'Campaign', 'Source', 'Medium', 'Content',
    'First Touch Conversion', 'Last Touch Conversion', 'Device Type', 'City'
  ];
  
  const row = [
    new Date(),
    sanitizeInput(data.session_id || ''),
    sanitizeInput(data.campaign || ''),
    sanitizeInput(data.source || ''),
    sanitizeInput(data.medium || ''),
    sanitizeInput(data.content || ''),
    data.first_touch_conversion ? 'Yes' : 'No',
    data.last_touch_conversion ? 'Yes' : 'No',
    sanitizeInput(data.device_type || ''),
    sanitizeInput(data.city || '')
  ];
  
  appendRow(ss, SHEET_NAMES.CAMPAIGN_ATTRIBUTION, headers, row);
  
  return ContentService.createTextOutput(JSON.stringify({ success: true }))
    .setMimeType(ContentService.MimeType.JSON);
}