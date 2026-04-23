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
    default: ''
  },
  works: {
    type: [String],
    default: []
  },
  knowledgeBoundary: {
    type: String,
    default: ''
  },
  dynasty: {
    type: String,
    default: ''
  }
});

module.exports = mongoose.model('Character', characterSchema);