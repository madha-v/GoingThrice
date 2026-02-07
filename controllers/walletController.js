import { pgPool } from '../config/database.js';

// Get wallet balance
export const getWallet = async (req, res) => {
  try {
    const result = await pgPool.query(
      `SELECT balance, locked_amount, total_deposited, total_withdrawn 
       FROM wallets WHERE user_id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Wallet not found' 
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Get wallet error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get wallet', 
      error: error.message 
    });
  }
};

// Deposit money to wallet
export const depositFunds = async (req, res) => {
  const client = await pgPool.connect();
  
  try {
    const { amount, payment_reference } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid amount' 
      });
    }

    await client.query('BEGIN');

    // Create transaction record
    await client.query(
      `INSERT INTO transactions (user_id, transaction_type, amount, status, reference_id, description)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [req.user.id, 'deposit', amount, 'completed', payment_reference || 'MANUAL', 'Wallet deposit']
    );

    // Update wallet balance
    const walletResult = await client.query(
      `UPDATE wallets 
       SET balance = balance + $1,
           total_deposited = total_deposited + $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2
       RETURNING balance, locked_amount, total_deposited`,
      [amount, req.user.id]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Funds deposited successfully',
      data: walletResult.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Deposit error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Deposit failed', 
      error: error.message 
    });
  } finally {
    client.release();
  }
};

// Lock funds for bidding
export const lockFunds = async (req, res) => {
  const client = await pgPool.connect();
  
  try {
    const { amount, auction_id } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid amount' 
      });
    }

    await client.query('BEGIN');

    // Check available balance
    const walletCheck = await client.query(
      'SELECT balance, locked_amount FROM wallets WHERE user_id = $1',
      [req.user.id]
    );

    const wallet = walletCheck.rows[0];
    const availableBalance = parseFloat(wallet.balance) - parseFloat(wallet.locked_amount);

    if (availableBalance < amount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        success: false, 
        message: 'Insufficient balance' 
      });
    }

    // Lock the amount
    const walletResult = await client.query(
      `UPDATE wallets 
       SET locked_amount = locked_amount + $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2
       RETURNING balance, locked_amount`,
      [amount, req.user.id]
    );

    // Create transaction record
    await client.query(
      `INSERT INTO transactions (user_id, transaction_type, amount, status, reference_id, description)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [req.user.id, 'lock', amount, 'completed', auction_id, `Funds locked for auction ${auction_id}`]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Funds locked successfully',
      data: walletResult.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Lock funds error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to lock funds', 
      error: error.message 
    });
  } finally {
    client.release();
  }
};

// Unlock funds (when outbid)
export const unlockFunds = async (req, res) => {
  const client = await pgPool.connect();
  
  try {
    const { amount, auction_id } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid amount' 
      });
    }

    await client.query('BEGIN');

    // Unlock the amount
    const walletResult = await client.query(
      `UPDATE wallets 
       SET locked_amount = locked_amount - $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2
       RETURNING balance, locked_amount`,
      [amount, req.user.id]
    );

    // Create transaction record
    await client.query(
      `INSERT INTO transactions (user_id, transaction_type, amount, status, reference_id, description)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [req.user.id, 'unlock', amount, 'completed', auction_id, `Funds unlocked from auction ${auction_id}`]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Funds unlocked successfully',
      data: walletResult.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Unlock funds error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to unlock funds', 
      error: error.message 
    });
  } finally {
    client.release();
  }
};

// Transfer funds to seller (after auction completion)
export const transferFunds = async (req, res) => {
  const client = await pgPool.connect();
  
  try {
    const { seller_id, amount, auction_id } = req.body;

    if (!amount || amount <= 0 || !seller_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid parameters' 
      });
    }

    await client.query('BEGIN');

    // Deduct from buyer (unlock and reduce balance)
    await client.query(
      `UPDATE wallets 
       SET balance = balance - $1,
           locked_amount = locked_amount - $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2`,
      [amount, req.user.id]
    );

    // Add to seller
    await client.query(
      `UPDATE wallets 
       SET balance = balance + $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2`,
      [amount, seller_id]
    );

    // Create transaction records
    await client.query(
      `INSERT INTO transactions (user_id, transaction_type, amount, status, reference_id, description)
       VALUES 
         ($1, 'transfer', $2, 'completed', $3, 'Payment for auction ' || $3),
         ($4, 'transfer', $2, 'completed', $3, 'Payment received for auction ' || $3)`,
      [req.user.id, amount, auction_id, seller_id]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Funds transferred successfully'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Transfer funds error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Transfer failed', 
      error: error.message 
    });
  } finally {
    client.release();
  }
};

// Get transaction history
export const getTransactions = async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const result = await pgPool.query(
      `SELECT id, transaction_type, amount, status, reference_id, description, created_at
       FROM transactions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user.id, limit, offset]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get transactions', 
      error: error.message 
    });
  }
};
