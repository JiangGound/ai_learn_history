const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  role:        { type: String, enum: ['user', 'assistant'], required: true },
  content:     { type: String, required: true },
  speakerName: { type: String }   // 群聊时标注发言人
}, { _id: false });

const conversationSchema = new mongoose.Schema({
  userId:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  characterId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Character' },  // 单聊必填
  characterName:  { type: String },
  characterNames: [{ type: String }],  // 群聊用，全部参与荟名
  isGroup:        { type: Boolean, default: false },
  title:          { type: String, required: true },
  messages:       [messageSchema]
}, { timestamps: true });

module.exports = mongoose.model('Conversation', conversationSchema);
