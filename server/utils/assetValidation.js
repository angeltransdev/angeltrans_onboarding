const ASSET_CATEGORIES = ['Vehicle', 'Mobile Device', 'Ambulance Equipment', 'Other'];
const ASSET_STATUSES = ['Available', 'In Use', 'Maintenance', 'Retired'];
const RECORD_CATEGORIES = ['Registration', 'Insurance', 'Permit', 'Inspection', 'Certification', 'Maintenance', 'Other'];
const RECORD_STATUSES = ['Open', 'Resolved'];

function text(value, label, max, required = false) {
  if (value == null || value === '') {
    if (required) throw new Error(`${label} is required.`);
    return null;
  }
  if (typeof value !== 'string') throw new Error(`${label} must be text.`);
  const result = value.trim();
  if (required && !result) throw new Error(`${label} is required.`);
  if (result.length > max) throw new Error(`${label} is too long.`);
  return result || null;
}

function choice(value, label, options) {
  if (!options.includes(value)) throw new Error(`Invalid ${label}.`);
  return value;
}

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000-')) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function driveUrl(value) {
  const result = text(value, 'Document link', 2048);
  if (!result) return null;
  let parsed;
  try { parsed = new URL(result); } catch { throw new Error('Enter a valid Google Drive or Google Docs link.'); }
  if (parsed.protocol !== 'https:' || !['drive.google.com', 'docs.google.com'].includes(parsed.hostname) || parsed.username || parsed.password || parsed.port) {
    throw new Error('Enter a valid Google Drive or Google Docs link.');
  }
  return result;
}

function validateAsset(body) {
  return {
    name: text(body.name, 'Name', 255, true),
    category: choice(body.category, 'asset category', ASSET_CATEGORIES),
    identifier: text(body.identifier, 'Identifier', 255),
    location: text(body.location, 'Location', 255),
    status: choice(body.status, 'asset status', ASSET_STATUSES),
    vin: text(body.vin, 'VIN', 100),
    licensePlate: text(body.licensePlate, 'License plate', 100),
    serialNumber: text(body.serialNumber, 'Serial number', 255),
    notes: text(body.notes, 'Notes', 10000),
  };
}

function validateRecord(body) {
  if (!validDate(body.dueDate)) throw new Error('Enter a valid due date.');
  return {
    title: text(body.title, 'Title', 255, true),
    category: choice(body.category, 'record category', RECORD_CATEGORIES),
    dueDate: body.dueDate,
    documentUrl: driveUrl(body.documentUrl),
    notes: text(body.notes, 'Notes', 10000),
    status: choice(body.status, 'record status', RECORD_STATUSES),
  };
}

module.exports = { validateAsset, validateRecord, validDate };