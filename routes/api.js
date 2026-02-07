import express from 'express';
import { 
  register, 
  login, 
  getProfile, 
  updateProfile 
} from '../controllers/authController.js';
import { 
  getWallet, 
  depositFunds, 
  lockFunds, 
  unlockFunds, 
  transferFunds, 
  getTransactions 
} from '../controllers/walletController.js';
import {
  createAuction,
  getAuctions,
  getAuction,
  updateAuction,
  deleteAuction,
  getMyAuctions,
  addToWatchlist,
  getCategories
} from '../controllers/auctionController.js';
import {
  placeBid,
  getBidHistory,
  getMyBids,
  getWinningBids
} from '../controllers/bidController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// ==================== AUTH ROUTES ====================
router.post('/auth/register', register);
router.post('/auth/login', login);
router.get('/auth/profile', authenticate, getProfile);
router.put('/auth/profile', authenticate, updateProfile);

// ==================== WALLET ROUTES ====================
router.get('/wallet', authenticate, getWallet);
router.post('/wallet/deposit', authenticate, depositFunds);
router.post('/wallet/lock', authenticate, lockFunds);
router.post('/wallet/unlock', authenticate, unlockFunds);
router.post('/wallet/transfer', authenticate, transferFunds);
router.get('/wallet/transactions', authenticate, getTransactions);

// ==================== AUCTION ROUTES ====================
router.post('/auctions', authenticate, authorize('seller', 'committee', 'admin'), createAuction);
router.get('/auctions', getAuctions);
router.get('/auctions/categories', getCategories);
router.get('/auctions/my-auctions', authenticate, getMyAuctions);
router.get('/auctions/:id', getAuction);
router.put('/auctions/:id', authenticate, updateAuction);
router.delete('/auctions/:id', authenticate, deleteAuction);
router.post('/auctions/:id/watch', authenticate, addToWatchlist);

// ==================== BID ROUTES ====================
router.post('/bids', authenticate, placeBid);
router.get('/bids/history/:auction_id', getBidHistory);
router.get('/bids/my-bids', authenticate, getMyBids);
router.get('/bids/winning', authenticate, getWinningBids);

export default router;
