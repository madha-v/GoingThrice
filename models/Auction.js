import mongoose from 'mongoose';

const auctionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    required: true,
    maxlength: 2000
  },
  category: {
    type: String,
    required: true,
    enum: ['antiques', 'collectibles', 'luxury_watches', 'art', 'jewelry', 'nft', 'electronics', 'vehicles', 'real_estate', 'other']
  },
  tags: [{
    type: String,
    trim: true
  }],
  images: [{
    url: String,
    caption: String
  }],
  seller_id: {
    type: Number,
    required: true
  },
  committee_id: {
    type: Number,
    default: null
  },
  starting_price: {
    type: Number,
    required: true,
    min: 0
  },
  reserve_price: {
    type: Number,
    default: 0
  },
  current_bid: {
    type: Number,
    default: 0
  },
  bid_increment: {
    type: Number,
    default: 10
  },
  highest_bidder_id: {
    type: Number,
    default: null
  },
  total_bids: {
    type: Number,
    default: 0
  },
  start_time: {
    type: Date,
    required: true
  },
  end_time: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['draft', 'scheduled', 'live', 'ended', 'cancelled', 'sold'],
    default: 'draft'
  },
  auto_extend: {
    type: Boolean,
    default: true
  },
  extend_time_seconds: {
    type: Number,
    default: 120
  },
  item_condition: {
    type: String,
    enum: ['new', 'like_new', 'excellent', 'good', 'fair', 'poor'],
    default: 'good'
  },
  shipping_details: {
    available: { type: Boolean, default: true },
    cost: { type: Number, default: 0 },
    estimated_days: { type: Number, default: 7 },
    regions: [String]
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  watchers: [{
    type: Number
  }],
  views: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes for performance
auctionSchema.index({ status: 1, end_time: 1 });
auctionSchema.index({ category: 1, status: 1 });
auctionSchema.index({ seller_id: 1 });
auctionSchema.index({ start_time: 1, end_time: 1 });
auctionSchema.index({ tags: 1 });

// Virtual for time remaining
auctionSchema.virtual('timeRemaining').get(function() {
  if (this.status !== 'live') return null;
  return Math.max(0, this.end_time - Date.now());
});

export default mongoose.model('Auction', auctionSchema);
