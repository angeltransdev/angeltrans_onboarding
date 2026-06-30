const db = require('../models/db');

const logActivity = ({ userId, actorId = null, eventType, description, ip = null }) => {
  db.query(
    `INSERT INTO activity_log (user_id, actor_id, event_type, description, ip_address) VALUES ($1,$2,$3,$4,$5)`,
    [userId, actorId, eventType, description, ip]
  ).catch(err => console.error('Activity log insert failed:', err.message));
};

module.exports = { logActivity };
