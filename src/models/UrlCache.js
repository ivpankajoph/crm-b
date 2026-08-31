import mongoose from 'mongoose';

const urlCacheSchema = new mongoose.Schema({
  domain: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
  extractorVersion: {
    type: Number,
    default: 1,
  },
  cachedAt: {
    type: Date,
    default: Date.now,
    expires: '15d',
  },
}, {
  versionKey: false,
});

const UrlCache = mongoose.model('UrlCache', urlCacheSchema);

export default UrlCache;
