import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  conversation_id: {
    type: String,
    required: true,
    index: true
  },
  participants: [{
    type: Number,
    required: true
  }],
  sender_id: {
    type: Number,
    required: true
  },
  receiver_id: {
    type: Number,
    required: true
  },
  message_type: {
    type: String,
    enum: ['text', 'offer', 'counter_offer', 'image', 'system'],
    default: 'text'
  },
  content: {
    type: String,
    required: true,
    maxlength: 1000
  },
  offer_details: {
    auction_id: String,
    amount: Number,
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'expired'],
      default: 'pending'
    }
  },
  is_read: {
    type: Boolean,
    default: false
  },
  read_at: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Index for fast conversation retrieval
messageSchema.index({ conversation_id: 1, createdAt: -1 });
messageSchema.index({ participants: 1, createdAt: -1 });

export default mongoose.model('Message', messageSchema);
