const mongoose = require('mongoose');

const visitLogSchema = new mongoose.Schema({
  date: { type: String, required: true, index: true }, // 'YYYY-MM-DD'
  ip: { type: String, default: 'unknown' },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  feature: { type: String, required: true }, // 'chat', 'group-chat', 'tts', 'asr', 'characters', 'conversations', 'auth'
  method: { type: String },
  path: { type: String },
}, { timestamps: true });

visitLogSchema.index({ date: 1, feature: 1 });
visitLogSchema.index({ date: 1, ip: 1 });

module.exports = mongoose.model('VisitLog', visitLogSchema);
