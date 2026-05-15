/**
 * ProseLab Ingestion System - Google Apps Script
 * Deploy this at script.google.com
 */

const CONFIG = {
  // Update this with your ngrok URL or production backend URL
  API_ENDPOINT: 'https://YOUR_NGROK_URL.ngrok-free.app/api/documents/email-upload',
  API_KEY: 'your-secret-key-here', // Match this in your server's .env
  PROCESSED_LABEL: 'DocUpload-Processed',
  MAX_ATTACHMENT_SIZE: 25 * 1024 * 1024, // 25MB
};

/**
 * Main entry point - run this to check for new emails
 */
function checkForDocumentEmails() {
  const label = getOrCreateLabel(CONFIG.PROCESSED_LABEL);
  const query = 'has:attachment -label:' + CONFIG.PROCESSED_LABEL + ' is:unread';
  const threads = GmailApp.search(query, 0, 20);
  
  if (threads.length === 0) {
    Logger.log('No new emails with attachments found.');
    return;
  }
  
  Logger.log('Found ' + threads.length + ' threads to process.');
  
  threads.forEach(thread => {
    try {
      processThread(thread, label);
    } catch (e) {
      Logger.log('Error processing thread: ' + e.message);
    }
  });
}

function processThread(thread, label) {
  const messages = thread.getMessages();
  
  messages.forEach(message => {
    const attachments = message.getAttachments();
    if (attachments.length === 0) return;
    
    const emailMeta = {
      subject: message.getSubject() || '(no subject)',
      from: message.getFrom(),
      to: message.getTo(),
      date: message.getDate().toISOString(),
      body: message.getPlainBody().substring(0, 1000),
      messageId: message.getId(),
    };
    
    Logger.log('Processing email: "' + emailMeta.subject + '" with ' + attachments.length + ' attachments');
    
    attachments.forEach((attachment, idx) => {
      if (attachment.getSize() > CONFIG.MAX_ATTACHMENT_SIZE) {
        Logger.log('Skipping oversized attachment: ' + attachment.getName());
        return;
      }
      
      try {
        const result = uploadAttachment(attachment, emailMeta, idx);
        Logger.log('Upload result for ' + attachment.getName() + ': ' + result);
      } catch (e) {
        Logger.log('Failed to upload ' + attachment.getName() + ': ' + e.message);
      }
    });
  });
  
  thread.addLabel(label);
  thread.markRead();
}

function uploadAttachment(attachment, emailMeta, index) {
  const blob = attachment.copyBlob();
  
  const payload = {
    fileName: attachment.getName(),
    contentType: attachment.getContentType(),
    size: attachment.getSize(),
    email: emailMeta,
    fileData: Utilities.base64Encode(blob.getBytes()),
    uploadedAt: new Date().toISOString(),
  };
  
  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: { 'Authorization': 'Bearer ' + CONFIG.API_KEY },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };
  
  const response = UrlFetchApp.fetch(CONFIG.API_ENDPOINT, options);
  const code = response.getResponseCode();
  
  if (code !== 200 && code !== 201) {
    throw new Error('API returned ' + code + ': ' + response.getContentText());
  }
  
  return response.getContentText();
}

function getOrCreateLabel(name) {
  let label = GmailApp.getUserLabelByName(name);
  if (!label) label = GmailApp.createLabel(name);
  return label;
}

/**
 * RUN ONCE: Set up time-driven trigger to run every 5 minutes
 */
function createTrigger() {
  ScriptApp.newTrigger('checkForDocumentEmails')
    .timeBased()
    .everyMinutes(5)
    .create();
  Logger.log('Trigger created: checking every 5 minutes');
}

function removeTriggers() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  Logger.log('All triggers removed');
}
