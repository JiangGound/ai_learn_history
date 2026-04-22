const mongoose = require('mongoose');

const characterSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  background: {
    type: String,
    required: true
  },
  works: {
    type: [String],
    default: []
  },
  knowledgeBoundary: {
    type: String,
    required: true
  }
});

module.exports = mongoose.model('Character', characterSchema);