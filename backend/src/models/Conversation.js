const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  role:    { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true }
}, { _id: false });

const conversationSchema = new mongoose.Schema({
  userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  characterId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Character', required: true },
  characterName: { type: String, required: true },
  title:         { type: String, required: true },
  messages:      [messageSchema]
}, { timestamps: true });

module.exports = mongoose.model('Conversation', conversationSchema);
