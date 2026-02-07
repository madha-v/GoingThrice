import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import Auction from './models/Auction.js';
import Message from './models/Message.js';

export const initializeSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // Authentication middleware for socket
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication error'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  // Connected users map
  const connectedUsers = new Map();

  io.on('connection', (socket) => {
    console.log(`✅ User connected: ${socket.userId}`);
    connectedUsers.set(socket.userId, socket.id);

    // Join auction room
    socket.on('join_auction', async (auctionId) => {
      try {
        socket.join(`auction_${auctionId}`);
        
        // Get current auction state
        const auction = await Auction.findById(auctionId);
        
        if (auction) {
          socket.emit('auction_state', {
            current_bid: auction.current_bid,
            highest_bidder_id: auction.highest_bidder_id,
            total_bids: auction.total_bids,
            end_time: auction.end_time,
            status: auction.status
          });
        }

        // Notify others
        socket.to(`auction_${auctionId}`).emit('user_joined', {
          user_id: socket.userId,
          timestamp: new Date()
        });
      } catch (error) {
        console.error('Join auction error:', error);
      }
    });

    // Leave auction room
    socket.on('leave_auction', (auctionId) => {
      socket.leave(`auction_${auctionId}`);
      socket.to(`auction_${auctionId}`).emit('user_left', {
        user_id: socket.userId,
        timestamp: new Date()
      });
    });

    // New bid placed
    socket.on('new_bid', async (data) => {
      try {
        const { auction_id, bid_amount, bidder_username } = data;
        
        // Broadcast to all users in auction room
        io.to(`auction_${auction_id}`).emit('bid_update', {
          auction_id,
          current_bid: bid_amount,
          bidder_id: socket.userId,
          bidder_username,
          total_bids: data.total_bids || 0,
          timestamp: new Date()
        });

        // Notify previous highest bidder (if different)
        if (data.previous_bidder_id && data.previous_bidder_id !== socket.userId) {
          const previousBidderSocketId = connectedUsers.get(data.previous_bidder_id);
          if (previousBidderSocketId) {
            io.to(previousBidderSocketId).emit('outbid_notification', {
              auction_id,
              new_bid: bid_amount,
              your_bid: data.previous_bid_amount
            });
          }
        }
      } catch (error) {
        console.error('New bid error:', error);
      }
    });

    // Auction ending soon notification
    socket.on('auction_ending_soon', (data) => {
      io.to(`auction_${data.auction_id}`).emit('ending_soon', {
        auction_id: data.auction_id,
        time_remaining: data.time_remaining
      });
    });

    // Auction ended
    socket.on('auction_ended', (data) => {
      io.to(`auction_${data.auction_id}`).emit('auction_closed', {
        auction_id: data.auction_id,
        final_bid: data.final_bid,
        winner_id: data.winner_id
      });
    });

    // Chat messaging
    socket.on('join_chat', (conversationId) => {
      socket.join(`chat_${conversationId}`);
    });

    socket.on('send_message', async (data) => {
      try {
        const { conversation_id, receiver_id, content, message_type, offer_details } = data;

        const message = await Message.create({
          conversation_id,
          participants: [socket.userId, receiver_id],
          sender_id: socket.userId,
          receiver_id,
          content,
          message_type: message_type || 'text',
          offer_details: offer_details || null
        });

        // Send to conversation room
        io.to(`chat_${conversation_id}`).emit('new_message', message);

        // Send push notification to receiver if online
        const receiverSocketId = connectedUsers.get(receiver_id);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit('message_notification', {
            conversation_id,
            sender_id: socket.userId,
            preview: content.substring(0, 50)
          });
        }
      } catch (error) {
        console.error('Send message error:', error);
        socket.emit('message_error', { message: 'Failed to send message' });
      }
    });

    socket.on('typing', (data) => {
      socket.to(`chat_${data.conversation_id}`).emit('user_typing', {
        user_id: socket.userId,
        conversation_id: data.conversation_id
      });
    });

    socket.on('stop_typing', (data) => {
      socket.to(`chat_${data.conversation_id}`).emit('user_stopped_typing', {
        user_id: socket.userId,
        conversation_id: data.conversation_id
      });
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log(`❌ User disconnected: ${socket.userId}`);
      connectedUsers.delete(socket.userId);
    });
  });

  // Auction status checker (runs every 10 seconds)
  setInterval(async () => {
    try {
      const now = new Date();

      // Start scheduled auctions
      const auctionsToStart = await Auction.find({
        status: 'scheduled',
        start_time: { $lte: now }
      });

      for (const auction of auctionsToStart) {
        auction.status = 'live';
        await auction.save();
        
        io.to(`auction_${auction._id}`).emit('auction_started', {
          auction_id: auction._id,
          start_time: auction.start_time
        });
      }

      // End live auctions
      const auctionsToEnd = await Auction.find({
        status: 'live',
        end_time: { $lte: now }
      });

      for (const auction of auctionsToEnd) {
        auction.status = 'ended';
        await auction.save();

        io.to(`auction_${auction._id}`).emit('auction_closed', {
          auction_id: auction._id,
          final_bid: auction.current_bid,
          winner_id: auction.highest_bidder_id
        });
      }

      // Notify auctions ending in 2 minutes
      const twoMinutesFromNow = new Date(now.getTime() + 2 * 60 * 1000);
      const endingSoon = await Auction.find({
        status: 'live',
        end_time: { $lte: twoMinutesFromNow, $gt: now }
      });

      for (const auction of endingSoon) {
        const timeRemaining = Math.floor((auction.end_time - now) / 1000);
        io.to(`auction_${auction._id}`).emit('ending_soon', {
          auction_id: auction._id,
          time_remaining: timeRemaining
        });
      }
    } catch (error) {
      console.error('Auction status checker error:', error);
    }
  }, 10000); // Run every 10 seconds

  return io;
};
