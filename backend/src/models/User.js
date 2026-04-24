const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  phone:    { type: String, required: true, unique: true, index: true },
  nickname: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
