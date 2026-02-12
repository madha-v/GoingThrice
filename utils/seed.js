import { connectMongoDB, pgPool, initializePostgresDB } from './config/database.js';
import Auction from './models/Auction.js';
import bcrypt from 'bcryptjs';

const sampleUsers = [
  {
    username: 'alice_buyer',
    email: 'alice@example.com',
    password: 'password123',
    role: 'buyer',
    phone: '+91 9876543210',
    address: 'Mumbai, Maharashtra'
  },
  {
    username: 'bob_seller',
    email: 'bob@example.com',
    password: 'password123',
    role: 'seller',
    phone: '+91 9876543211',
    address: 'Delhi, Delhi'
  },
  {
    username: 'charlie_committee',
    email: 'charlie@example.com',
    password: 'password123',
    role: 'committee',
    phone: '+91 9876543212',
    address: 'Bangalore, Karnataka'
  },
  {
    username: 'admin',
    email: 'admin@goingthrice.com',
    password: 'admin123',
    role: 'admin',
    phone: '+91 9876543213',
    address: 'Kolkata, West Bengal'
  }
];

const sampleAuctions = [
  {
    title: 'Rare Mughal Era Miniature Painting',
    description: 'Exquisite hand-painted miniature from the Mughal period (circa 1650). Features intricate details of court life with gold leaf embellishments. Authenticated by renowned art historians.',
    category: 'art',
    tags: ['mughal', 'painting', 'antique', 'historical'],
    images: [
      { url: 'https://via.placeholder.com/600x400/8B4513/FFFFFF?text=Mughal+Painting', caption: 'Front view' }
    ],
    starting_price: 50000,
    reserve_price: 75000,
    current_bid: 50000,
    bid_increment: 5000,
    start_time: new Date(Date.now() - 2 * 60 * 60 * 1000), // Started 2 hours ago
    end_time: new Date(Date.now() + 3 * 60 * 60 * 1000), // Ends in 3 hours
    status: 'live',
    item_condition: 'excellent',
    shipping_details: {
      available: true,
      cost: 500,
      estimated_days: 5,
      regions: ['India', 'International']
    }
  },
  {
    title: 'Rolex Submariner Date - Vintage 1980',
    description: 'Vintage Rolex Submariner Date ref. 16800 from 1980. Original bracelet and box. Service history available. Excellent condition with minimal wear.',
    category: 'luxury_watches',
    tags: ['rolex', 'submariner', 'vintage', 'luxury'],
    images: [
      { url: 'https://via.placeholder.com/600x400/000000/FFD700?text=Rolex+Submariner', caption: 'Watch face' }
    ],
    starting_price: 300000,
    reserve_price: 450000,
    current_bid: 320000,
    bid_increment: 10000,
    start_time: new Date(Date.now() - 1 * 60 * 60 * 1000),
    end_time: new Date(Date.now() + 5 * 60 * 60 * 1000),
    status: 'live',
    item_condition: 'excellent',
    shipping_details: {
      available: true,
      cost: 1000,
      estimated_days: 3,
      regions: ['India', 'International']
    }
  },
  {
    title: 'Antique Rajasthani Silver Jewelry Set',
    description: 'Complete bridal jewelry set from Rajasthan, circa 1920. Intricate silver work with semi-precious stones. Includes necklace, earrings, bangles, and maang tikka.',
    category: 'jewelry',
    tags: ['rajasthani', 'silver', 'antique', 'bridal'],
    images: [
      { url: 'https://via.placeholder.com/600x400/C0C0C0/8B4513?text=Silver+Jewelry', caption: 'Complete set' }
    ],
    starting_price: 75000,
    reserve_price: 100000,
    current_bid: 75000,
    bid_increment: 5000,
    start_time: new Date(Date.now() - 30 * 60 * 1000),
    end_time: new Date(Date.now() + 2 * 60 * 60 * 1000),
    status: 'live',
    item_condition: 'good',
    shipping_details: {
      available: true,
      cost: 300,
      estimated_days: 4,
      regions: ['India']
    }
  },
  {
    title: 'First Edition "The Great Gatsby" (1925)',
    description: 'Rare first edition of F. Scott Fitzgerald\'s masterpiece. Original dust jacket in very good condition. A true collector\'s item.',
    category: 'collectibles',
    tags: ['books', 'first edition', 'fitzgerald', 'rare'],
    images: [
      { url: 'https://via.placeholder.com/600x400/8B4513/F5DEB3?text=Great+Gatsby', caption: 'Book cover' }
    ],
    starting_price: 125000,
    reserve_price: 200000,
    current_bid: 125000,
    bid_increment: 15000,
    start_time: new Date(Date.now() + 1 * 60 * 60 * 1000), // Starts in 1 hour
    end_time: new Date(Date.now() + 8 * 60 * 60 * 1000),
    status: 'scheduled',
    item_condition: 'excellent',
    shipping_details: {
      available: true,
      cost: 200,
      estimated_days: 3,
      regions: ['India', 'International']
    }
  },
  {
    title: 'Victorian Era Mahogany Writing Desk',
    description: 'Authentic Victorian mahogany writing desk from 1880s. Features original brass handles, multiple drawers, and leather writing surface. Beautifully restored.',
    category: 'antiques',
    tags: ['victorian', 'furniture', 'mahogany', 'desk'],
    images: [
      { url: 'https://via.placeholder.com/600x400/8B4513/000000?text=Victorian+Desk', caption: 'Full desk' }
    ],
    starting_price: 45000,
    reserve_price: 65000,
    current_bid: 52000,
    bid_increment: 3000,
    start_time: new Date(Date.now() - 4 * 60 * 60 * 1000),
    end_time: new Date(Date.now() + 1 * 60 * 60 * 1000),
    status: 'live',
    item_condition: 'good',
    shipping_details: {
      available: true,
      cost: 2000,
      estimated_days: 7,
      regions: ['India']
    }
  },
  {
    title: 'CryptoPunk #7890 - Rare Alien NFT',
    description: 'Extremely rare CryptoPunk alien with unique attributes. One of only 9 alien punks in the entire collection. Verified on blockchain.',
    category: 'nft',
    tags: ['cryptopunk', 'nft', 'alien', 'ethereum'],
    images: [
      { url: 'https://via.placeholder.com/600x400/000000/00FF00?text=CryptoPunk+7890', caption: 'NFT artwork' }
    ],
    starting_price: 2500000,
    reserve_price: 3500000,
    current_bid: 2500000,
    bid_increment: 100000,
    start_time: new Date(Date.now() + 2 * 60 * 60 * 1000),
    end_time: new Date(Date.now() + 24 * 60 * 60 * 1000),
    status: 'scheduled',
    item_condition: 'new',
    shipping_details: {
      available: false,
      cost: 0,
      estimated_days: 0,
      regions: []
    },
    metadata: {
      blockchain: 'Ethereum',
      token_id: '7890',
      contract_address: '0xb47e3cd837dDF8e4c57F05d70Ab865de6e193BBB'
    }
  }
];

async function seedDatabase() {
  try {
    console.log('🌱 Starting database seeding...\n');

    // Connect to databases
    await connectMongoDB();
    await initializePostgresDB();

    // Clear existing data
    console.log('🗑️  Clearing existing data...');
    await Auction.deleteMany({});
    await pgPool.query('TRUNCATE TABLE bids, ratings, orders, transactions, wallets, users RESTART IDENTITY CASCADE');
    console.log('✅ Data cleared\n');

    // Create users
    console.log('👥 Creating users...');
    const createdUsers = [];
    
    for (const userData of sampleUsers) {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(userData.password, salt);

      const userResult = await pgPool.query(
        `INSERT INTO users (username, email, password_hash, role, phone, address, is_verified) 
         VALUES ($1, $2, $3, $4, $5, $6, true) 
         RETURNING id, username, email, role`,
        [userData.username, userData.email, passwordHash, userData.role, userData.phone, userData.address]
      );

      const user = userResult.rows[0];
      createdUsers.push(user);

      // Create wallet with initial balance
      const initialBalance = userData.role === 'buyer' ? 500000 : 0;
      await pgPool.query(
        'INSERT INTO wallets (user_id, balance, total_deposited) VALUES ($1, $2, $2)',
        [user.id, initialBalance]
      );

      console.log(`  ✅ Created ${user.role}: ${user.username} (Balance: ₹${initialBalance})`);
    }

    console.log(`\n✅ Created ${createdUsers.length} users\n`);

    // Create auctions
    console.log('🎯 Creating auctions...');
    const sellerUser = createdUsers.find(u => u.role === 'seller');
    
    for (const auctionData of sampleAuctions) {
      const auction = await Auction.create({
        ...auctionData,
        seller_id: sellerUser.id
      });
      
      console.log(`  ✅ Created auction: ${auction.title} (${auction.status})`);

      // Add some bids to live auctions
      if (auction.status === 'live' && auction.total_bids === 0) {
        const buyerUser = createdUsers.find(u => u.role === 'buyer');
        
        // First bid
        await pgPool.query(
          'INSERT INTO bids (auction_id, user_id, bid_amount, is_winning) VALUES ($1, $2, $3, true)',
          [auction._id.toString(), buyerUser.id, auction.current_bid]
        );

        // Lock funds
        await pgPool.query(
          'UPDATE wallets SET locked_amount = locked_amount + $1 WHERE user_id = $2',
          [auction.current_bid, buyerUser.id]
        );

        auction.highest_bidder_id = buyerUser.id;
        auction.total_bids = 1;
        await auction.save();
      }
    }

    console.log(`\n✅ Created ${sampleAuctions.length} auctions\n`);

    // Print summary
    console.log('=' .repeat(60));
    console.log('🎉 DATABASE SEEDING COMPLETED SUCCESSFULLY!\n');
    console.log('📊 Summary:');
    console.log(`   Users: ${createdUsers.length}`);
    console.log(`   Auctions: ${sampleAuctions.length}`);
    console.log(`   Live Auctions: ${sampleAuctions.filter(a => a.status === 'live').length}`);
    console.log(`   Scheduled Auctions: ${sampleAuctions.filter(a => a.status === 'scheduled').length}\n`);
    
    console.log('🔑 Test Credentials:');
    console.log('   Buyer:');
    console.log('     Email: alice@example.com');
    console.log('     Password: password123');
    console.log('     Wallet Balance: ₹500,000\n');
    console.log('   Seller:');
    console.log('     Email: bob@example.com');
    console.log('     Password: password123\n');
    console.log('   Admin:');
    console.log('     Email: admin@goingthrice.com');
    console.log('     Password: admin123\n');
    console.log('=' .repeat(60));

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding error:', error);
    process.exit(1);
  }
}

process.exit(1);
}

seedDatabase();
