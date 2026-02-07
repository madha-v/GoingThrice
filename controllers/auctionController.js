import Auction from '../models/Auction.js';
import { pgPool } from '../config/database.js';

// Create new auction
export const createAuction = async (req, res) => {
  try {
    const {
      title, description, category, tags, images,
      starting_price, reserve_price, bid_increment,
      start_time, end_time, item_condition, shipping_details, metadata
    } = req.body;

    // Validation
    if (!title || !description || !category || !starting_price || !start_time || !end_time) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields' 
      });
    }

    // Create auction in MongoDB
    const auction = await Auction.create({
      title,
      description,
      category,
      tags: tags || [],
      images: images || [],
      seller_id: req.user.id,
      starting_price,
      reserve_price: reserve_price || starting_price,
      current_bid: starting_price,
      bid_increment: bid_increment || 10,
      start_time: new Date(start_time),
      end_time: new Date(end_time),
      item_condition: item_condition || 'good',
      shipping_details: shipping_details || { available: true, cost: 0, estimated_days: 7 },
      metadata: metadata || {},
      status: 'scheduled'
    });

    res.status(201).json({
      success: true,
      message: 'Auction created successfully',
      data: auction
    });
  } catch (error) {
    console.error('Create auction error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create auction', 
      error: error.message 
    });
  }
};

// Get all auctions with filters
export const getAuctions = async (req, res) => {
  try {
    const { 
      status, category, search, sort = '-start_time', 
      page = 1, limit = 20 
    } = req.query;

    const query = {};
    
    if (status) {
      query.status = status;
    } else {
      // Default to active auctions
      query.status = { $in: ['scheduled', 'live'] };
    }
    
    if (category) {
      query.category = category;
    }
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const auctions = await Auction.find(query)
      .sort(sort)
      .limit(parseInt(limit))
      .skip(skip)
      .lean();

    const total = await Auction.countDocuments(query);

    res.json({
      success: true,
      data: {
        auctions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get auctions error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get auctions', 
      error: error.message 
    });
  }
};

// Get single auction by ID
export const getAuction = async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id);

    if (!auction) {
      return res.status(404).json({ 
        success: false, 
        message: 'Auction not found' 
      });
    }

    // Increment view count
    auction.views += 1;
    await auction.save();

    // Get seller info
    const sellerResult = await pgPool.query(
      'SELECT id, username, email FROM users WHERE id = $1',
      [auction.seller_id]
    );

    // Get bid history
    const bidsResult = await pgPool.query(
      `SELECT b.bid_amount, b.bid_time, u.username 
       FROM bids b
       JOIN users u ON b.user_id = u.id
       WHERE b.auction_id = $1
       ORDER BY b.bid_time DESC
       LIMIT 10`,
      [auction._id.toString()]
    );

    res.json({
      success: true,
      data: {
        auction: auction.toObject({ virtuals: true }),
        seller: sellerResult.rows[0] || null,
        recent_bids: bidsResult.rows
      }
    });
  } catch (error) {
    console.error('Get auction error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get auction', 
      error: error.message 
    });
  }
};

// Update auction
export const updateAuction = async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id);

    if (!auction) {
      return res.status(404).json({ 
        success: false, 
        message: 'Auction not found' 
      });
    }

    // Check ownership
    if (auction.seller_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized to update this auction' 
      });
    }

    // Can't update live or ended auctions
    if (auction.status === 'live' || auction.status === 'ended') {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot update live or ended auctions' 
      });
    }

    const allowedUpdates = [
      'title', 'description', 'category', 'tags', 'images',
      'starting_price', 'reserve_price', 'bid_increment',
      'start_time', 'end_time', 'item_condition', 'shipping_details', 'metadata'
    ];

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        auction[field] = req.body[field];
      }
    });

    await auction.save();

    res.json({
      success: true,
      message: 'Auction updated successfully',
      data: auction
    });
  } catch (error) {
    console.error('Update auction error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update auction', 
      error: error.message 
    });
  }
};

// Delete auction
export const deleteAuction = async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id);

    if (!auction) {
      return res.status(404).json({ 
        success: false, 
        message: 'Auction not found' 
      });
    }

    // Check ownership
    if (auction.seller_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized to delete this auction' 
      });
    }

    // Can't delete live auctions with bids
    if (auction.status === 'live' && auction.total_bids > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot delete live auction with active bids' 
      });
    }

    auction.status = 'cancelled';
    await auction.save();

    res.json({
      success: true,
      message: 'Auction cancelled successfully'
    });
  } catch (error) {
    console.error('Delete auction error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete auction', 
      error: error.message 
    });
  }
};

// Get user's auctions (as seller)
export const getMyAuctions = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    
    const query = { seller_id: req.user.id };
    
    if (status) {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const auctions = await Auction.find(query)
      .sort('-createdAt')
      .limit(parseInt(limit))
      .skip(skip)
      .lean();

    const total = await Auction.countDocuments(query);

    res.json({
      success: true,
      data: {
        auctions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get my auctions error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get auctions', 
      error: error.message 
    });
  }
};

// Add auction to watchlist
export const addToWatchlist = async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id);

    if (!auction) {
      return res.status(404).json({ 
        success: false, 
        message: 'Auction not found' 
      });
    }

    if (!auction.watchers.includes(req.user.id)) {
      auction.watchers.push(req.user.id);
      await auction.save();
    }

    res.json({
      success: true,
      message: 'Added to watchlist'
    });
  } catch (error) {
    console.error('Add to watchlist error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to add to watchlist', 
      error: error.message 
    });
  }
};

// Get categories with count
export const getCategories = async (req, res) => {
  try {
    const categories = await Auction.aggregate([
      { $match: { status: { $in: ['scheduled', 'live'] } } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get categories', 
      error: error.message 
    });
  }
};
