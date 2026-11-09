const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data.json');

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    const defaultData = {
      donationPanel: null, // { channelId, messageId, value }
      autoImageChannels: [], // array of channel IDs
      giveaways: {}, // keyed by giveaway message ID
      messageCounters: {}, // keyed by channel ID -> { messageId, count }
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2));
    return defaultData;
  }
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    // Backfill defaults for anyone with an older data.json on disk already.
    if (!parsed.giveaways) parsed.giveaways = {};
    if (!parsed.autoImageChannels) parsed.autoImageChannels = [];
    if (!parsed.messageCounters) parsed.messageCounters = {};
    return parsed;
  } catch (err) {
    console.error('Failed to read data.json, using defaults:', err.message);
    return { donationPanel: null, autoImageChannels: [], giveaways: {}, messageCounters: {} };
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

module.exports = { loadData, saveData };
