const router = require('express').Router();
const db = require('../models/db');
const { authenticate, requireHR } = require('../middleware/auth');
const { validateAsset, validateRecord } = require('../utils/assetValidation');

router.use(authenticate, requireHR);

const assetColumns = `id, name, category, identifier, location, status, vin,
  license_plate AS "licensePlate", serial_number AS "serialNumber", notes`;
const recordColumns = `r.id, r.asset_id AS "assetId", r.title, r.category,
  r.due_date::text AS "dueDate", r.document_url AS "documentUrl", r.notes, r.status`;
const uuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

function validated(validator, body, res) {
  try { return validator(body || {}); }
  catch (err) { res.status(400).json({ message: err.message }); return null; }
}

router.param('assetId', (req, res, next, value) => {
  if (!uuid(value)) return res.status(400).json({ message: 'Invalid asset ID.' });
  next();
});
router.param('recordId', (req, res, next, value) => {
  if (!uuid(value)) return res.status(400).json({ message: 'Invalid record ID.' });
  next();
});

router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(`SELECT ${assetColumns},
      (SELECT MIN(r.due_date)::text FROM asset_records r WHERE r.asset_id = assets.id AND r.status = 'Open') AS "nextDueDate"
      FROM assets ORDER BY name, id`);
    res.json(rows);
  } catch (err) {
    console.error('List assets failed:', err);
    res.status(500).json({ message: 'Failed to load assets.' });
  }
});

router.get('/due', async (req, res) => {
  try {
    const { rows } = await db.query(`SELECT ${recordColumns}, a.name AS "assetName", a.location,
      r.due_date - (NOW() AT TIME ZONE 'America/Los_Angeles')::date AS "daysUntilDue"
      FROM asset_records r JOIN assets a ON a.id = r.asset_id
      WHERE r.status = 'Open' AND a.status <> 'Retired'
        AND r.due_date <= (NOW() AT TIME ZONE 'America/Los_Angeles')::date + 30
      ORDER BY r.due_date, a.name, r.title`);
    res.json(rows);
  } catch (err) {
    console.error('List asset due dates failed:', err);
    res.status(500).json({ message: 'Failed to load upcoming asset records.' });
  }
});

router.post('/', async (req, res) => {
  const a = validated(validateAsset, req.body, res);
  if (!a) return;
  try {
    const { rows } = await db.query(`INSERT INTO assets
      (name, category, identifier, location, status, vin, license_plate, serial_number, notes, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING ${assetColumns}`,
      [a.name, a.category, a.identifier, a.location, a.status, a.vin, a.licensePlate, a.serialNumber, a.notes, req.user.id]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Create asset failed:', err);
    res.status(500).json({ message: 'Failed to create asset.' });
  }
});

router.put('/:assetId', async (req, res) => {
  const a = validated(validateAsset, req.body, res);
  if (!a) return;
  try {
    const { rows } = await db.query(`UPDATE assets SET name=$1, category=$2, identifier=$3, location=$4,
      status=$5, vin=$6, license_plate=$7, serial_number=$8, notes=$9, updated_at=NOW()
      WHERE id=$10 RETURNING ${assetColumns}`,
      [a.name, a.category, a.identifier, a.location, a.status, a.vin, a.licensePlate, a.serialNumber, a.notes, req.params.assetId]);
    if (!rows.length) return res.status(404).json({ message: 'Asset not found.' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Update asset failed:', err);
    res.status(500).json({ message: 'Failed to update asset.' });
  }
});

router.get('/:assetId/records', async (req, res) => {
  try {
    const asset = await db.query('SELECT id FROM assets WHERE id=$1', [req.params.assetId]);
    if (!asset.rows.length) return res.status(404).json({ message: 'Asset not found.' });
    const { rows } = await db.query(`SELECT ${recordColumns} FROM asset_records r WHERE r.asset_id=$1
      ORDER BY CASE r.status WHEN 'Open' THEN 0 ELSE 1 END, r.due_date, r.title`, [req.params.assetId]);
    res.json(rows);
  } catch (err) {
    console.error('List asset records failed:', err);
    res.status(500).json({ message: 'Failed to load asset records.' });
  }
});

router.post('/:assetId/records', async (req, res) => {
  const r = validated(validateRecord, req.body, res);
  if (!r) return;
  try {
    const { rows } = await db.query(`INSERT INTO asset_records AS r (asset_id, title, category, due_date, document_url, notes, status)
      SELECT id,$2,$3,$4,$5,$6,$7 FROM assets WHERE id=$1 RETURNING ${recordColumns}`,
      [req.params.assetId, r.title, r.category, r.dueDate, r.documentUrl, r.notes, r.status]);
    if (!rows.length) return res.status(404).json({ message: 'Asset not found.' });
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Create asset record failed:', err);
    res.status(500).json({ message: 'Failed to create asset record.' });
  }
});

router.put('/:assetId/records/:recordId', async (req, res) => {
  const r = validated(validateRecord, req.body, res);
  if (!r) return;
  try {
    const { rows } = await db.query(`UPDATE asset_records AS r SET title=$1, category=$2, due_date=$3,
      document_url=$4, notes=$5, status=$6, updated_at=NOW()
      WHERE asset_id=$7 AND id=$8 RETURNING ${recordColumns}`,
      [r.title, r.category, r.dueDate, r.documentUrl, r.notes, r.status, req.params.assetId, req.params.recordId]);
    if (!rows.length) return res.status(404).json({ message: 'Asset record not found.' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Update asset record failed:', err);
    res.status(500).json({ message: 'Failed to update asset record.' });
  }
});

module.exports = router;