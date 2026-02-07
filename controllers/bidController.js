import Auction from '../models/Auction.js';
import { pgPool } from '../config/database.js';

// Place a bid
export const placeBid = async (req, res) => {
  const client = await pgPool.connect();
  
  try {
    const { auction_id, bid_amount } = req.body;

    if (!auction_id || !bid_amount || bid_amount <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid bid parameters' 
      });
    }

    // Get auction
    const auction = await Auction.findById(auction_id);

    if (!auction) {
      return res.status(404).json({ 
        success: false, 
        message: 'Auction not found' 
      });
    }

    // Validate auction status
    if (auction.status !== 'live') {
      return res.status(400).json({ 
        success: false, 
        message: 'Auction is not currently live' 
      });
    }

    // Can't bid on own auction
    if (auction.seller_id === req.user.id) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot bid on your own auction' 
      });
    }

    // Check if bid meets minimum increment
    const minimumBid = auction.current_bid + auction.bid_increment;
    if (bid_amount < minimumBid) {
      return res.status(400).json({ 
        success: false, 
        message: `Bid must be at least ${minimumBid}` 
      });
    }

    await client.query('BEGIN');

    // Check wallet balance
    const walletResult = await client.query(
      'SELECT balance, locked_amount FROM wallets WHERE user_id = $1',
      [req.user.id]
    );

    if (walletResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        success: false, 
        message: 'Wallet not found' 
      });
    }

    const wallet = walletResult.rows[0];
    const availableBalance = parseFloat(wallet.balance) - parseFloat(wallet.locked_amount);

    if (availableBalance < bid_amount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        success: false, 
        message: 'Insufficient wallet balance' 
      });
    }

    // Get previous highest bidder
    const previousHighestBidder = auction.highest_bidder_id;
    const previousBidAmount = auction.current_bid;

    // If there was a previous bidder, unlock their funds
    if (previousHighestBidder && previousHighestBidder !== req.user.id) {
      await client.query(
        `UPDATE wallets 
         SET locked_amount = locked_amount - $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $2`,
        [previousBidAmount, previousHighestBidder]
      );

      await client.query(
        `INSERT INTO transactions (user_id, transaction_type, amount, status, reference_id, description)
         VALUES ($1, 'unlock', $2, 'completed', $3, 'Outbid on auction')`,
        [previousHighestBidder, previousBidAmount, auction_id]
      );
    }

    // Lock current bidder's funds
    await client.query(
      `UPDATE wallets 
       SET locked_amount = locked_amount + $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2`,
      [bid_amount, req.user.id]
    );

    await client.query(
      `INSERT INTO transactions (user_id, transaction_type, amount, status, reference_id, description)
       VALUES ($1, 'lock', $2, 'completed', $3, 'Bid placed on auction')`,
      [req.user.id, bid_amount, auction_id]
    );

    // Mark previous bids as not winning
    await client.query(
      'UPDATE bids SET is_winning = false WHERE auction_id = $1',
      [auction_id]
    );

    // Record bid in PostgreSQL
    await client.query(
      `INSERT INTO bids (auction_id, user_id, bid_amount, is_winning)
       VALUES ($1, $2, $3, $4)`,
      [auction_id, req.user.id, bid_amount, true]
    );

    await client.query('COMMIT');

    // Update auction in MongoDB
    auction.current_bid = bid_amount;
    auction.highest_bidder_id = req.user.id;
    auction.total_bids += 1;

    // Auto-extend if near end time
    const timeRemaining = auction.end_time - Date.now();
    if (auction.auto_extend && timeRemaining < (auction.extend_time_seconds * 1000)) {
      auction.end_time = new Date(Date.now() + (auction.extend_time_seconds * 1000));
    }

    await auction.save();

    res.json({
      success: true,
      message: 'Bid placed successfully',
      data: {
        auction_id: auction._id,
        current_bid: auction.current_bid,
        highest_bidder_id: auction.highest_bidder_id,
        total_bids: auction.total_bids,
        end_time: auction.end_time
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Place bid error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to place bid', 
      error: error.message 
    });
  } finally {
    client.release();
  }
};

// Get bid history for an auction
export const getBidHistory = async (req, res) => {
  try {
    const { auction_id } = req.params;

    const result = await pgPool.query(
      `SELECT b.bid_amount, b.bid_time, b.is_winning, u.username, u.id as user_id
       FROM bids b
       JOIN users u ON b.user_id = u.id
       WHERE b.auction_id = $1
       ORDER BY b.bid_time DESC
       LIMIT 50`,
      [auction_id]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Get bid history error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get bid history', 
      error: error.message 
    });
  }
};

// Get user's bid history
export const getMyBids = async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const result = await pgPool.query(
      `SELECT b.auction_id, b.bid_amount, b.bid_time, b.is_winning
       FROM bids b
       WHERE b.user_id = $1
       ORDER BY b.bid_time DESC
       LIMIT $2 OFFSET $3`,
      [req.user.id, limit, offset]
    );

    // Get auction details for each bid
    const auctionIds = result.rows.map(bid => bid.auction_id);
    const auctions = await Auction.find({ _id: { $in: auctionIds } }).lean();

    const auctionMap = {};
    auctions.forEach(auction => {
      auctionMap[auction._id.toString()] = auction;
    });

    const bidsWithAuctions = result.rows.map(bid => ({
      ...bid,
      auction: auctionMap[bid.auction_id] || null
    }));

    res.json({
      success: true,
      data: bidsWithAuctions
    });
  } catch (error) {
    console.error('Get my bids error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get bid history', 
      error: error.message 
    });
  }
};

// Get winning bids for user
export const getWinningBids = async (req, res) => {
  try {
    const result = await pgPool.query(
      `SELECT DISTINCT ON (b.auction_id) b.auction_id, b.bid_amount, b.bid_time
       FROM bids b
       WHERE b.user_id = $1 AND b.is_winning = true
       ORDER BY b.auction_id, b.bid_time DESC`,
      [req.user.id]
    );

    // Get auction details
    const auctionIds = result.rows.map(bid => bid.auction_id);
    const auctions = await Auction.find({ 
      _id: { $in: auctionIds },
      status: { $in: ['live', 'ended'] }
    }).lean();

    res.json({
      success: true,
      data: auctions.map(auction => {
        const bid = result.rows.find(b => b.auction_id === auction._id.toString());
        return {
          auction,
          my_bid: bid
        };
      })
    });
  } catch (error) {
    console.error('Get winning bids error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get winning bids', 
      error: error.message 
    });
  }
};
