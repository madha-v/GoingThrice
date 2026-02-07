// Configuration
const API_URL = 'http://localhost:5000/api';
const SOCKET_URL = 'http://localhost:5000';

// Global state
let socket = null;
let currentUser = null;
let authToken = null;

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    // Check for existing session
    authToken = localStorage.getItem('authToken');
    if (authToken) {
        loadUserProfile();
        initializeSocket();
    }
    
    // Load auctions
    loadAuctions();
    
    // Auto-refresh auctions every 30 seconds
    setInterval(loadAuctions, 30000);
});

// Authentication Functions
async function handleLogin(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    
    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: formData.get('email'),
                password: formData.get('password')
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            authToken = data.data.token;
            currentUser = data.data.user;
            localStorage.setItem('authToken', authToken);
            
            updateUIForLoggedInUser();
            closeModal('loginModal');
            initializeSocket();
            loadWallet();
            
            showNotification('Welcome back, ' + currentUser.username + '!', 'success');
        } else {
            showNotification(data.message || 'Login failed', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showNotification('Login failed. Please try again.', 'error');
    }
}

async function handleRegister(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    
    try {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: formData.get('username'),
                email: formData.get('email'),
                password: formData.get('password'),
                role: formData.get('role')
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            authToken = data.data.token;
            currentUser = data.data.user;
            localStorage.setItem('authToken', authToken);
            
            updateUIForLoggedInUser();
            closeModal('registerModal');
            initializeSocket();
            loadWallet();
            
            showNotification('Account created successfully!', 'success');
        } else {
            showNotification(data.message || 'Registration failed', 'error');
        }
    } catch (error) {
        console.error('Registration error:', error);
        showNotification('Registration failed. Please try again.', 'error');
    }
}

async function loadUserProfile() {
    try {
        const response = await fetch(`${API_URL}/auth/profile`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentUser = data.data;
            updateUIForLoggedInUser();
            loadWallet();
        } else {
            logout();
        }
    } catch (error) {
        console.error('Profile load error:', error);
        logout();
    }
}

function logout() {
    localStorage.removeItem('authToken');
    authToken = null;
    currentUser = null;
    
    if (socket) {
        socket.disconnect();
        socket = null;
    }
    
    updateUIForLoggedOutUser();
    showNotification('Logged out successfully', 'success');
}

function updateUIForLoggedInUser() {
    document.getElementById('loginBtn').style.display = 'none';
    document.getElementById('registerBtn').style.display = 'none';
    document.getElementById('logoutBtn').style.display = 'block';
    document.getElementById('walletDisplay').style.display = 'block';
}

function updateUIForLoggedOutUser() {
    document.getElementById('loginBtn').style.display = 'block';
    document.getElementById('registerBtn').style.display = 'block';
    document.getElementById('logoutBtn').style.display = 'none';
    document.getElementById('walletDisplay').style.display = 'none';
}

// Wallet Functions
async function loadWallet() {
    if (!authToken) return;
    
    try {
        const response = await fetch(`${API_URL}/wallet`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const data = await response.json();
        
        if (data.success) {
            const balance = parseFloat(data.data.balance);
            const locked = parseFloat(data.data.locked_amount);
            const available = balance - locked;
            
            document.getElementById('walletBalance').textContent = `₹${available.toFixed(2)}`;
        }
    } catch (error) {
        console.error('Wallet load error:', error);
    }
}

// Auction Functions
async function loadAuctions(filters = {}) {
    const auctionGrid = document.getElementById('auctionGrid');
    const loading = document.getElementById('auctionsLoading');
    
    loading.style.display = 'block';
    auctionGrid.innerHTML = '';
    
    try {
        const params = new URLSearchParams({
            status: filters.status || 'live',
            category: filters.category || '',
            limit: 12
        });
        
        const response = await fetch(`${API_URL}/auctions?${params}`);
        const data = await response.json();
        
        loading.style.display = 'none';
        
        if (data.success && data.data.auctions.length > 0) {
            data.data.auctions.forEach(auction => {
                auctionGrid.appendChild(createAuctionCard(auction));
            });
        } else {
            auctionGrid.innerHTML = '<p style="text-align: center; color: var(--slate); grid-column: 1/-1; font-size: 1.2rem; padding: 3rem;">No auctions available at the moment.</p>';
        }
    } catch (error) {
        console.error('Load auctions error:', error);
        loading.style.display = 'none';
        auctionGrid.innerHTML = '<p style="text-align: center; color: var(--deep-burgundy); grid-column: 1/-1;">Failed to load auctions. Please try again.</p>';
    }
}

function createAuctionCard(auction) {
    const card = document.createElement('div');
    card.className = 'auction-card';
    card.onclick = () => openAuctionDetail(auction._id);
    
    const timeRemaining = getTimeRemaining(auction.end_time);
    const imageUrl = auction.images && auction.images.length > 0 
        ? auction.images[0].url 
        : 'https://via.placeholder.com/400x280?text=No+Image';
    
    card.innerHTML = `
        <img src="${imageUrl}" alt="${auction.title}" class="auction-image" onerror="this.src='https://via.placeholder.com/400x280?text=No+Image'">
        <div class="auction-content">
            <div class="auction-category">${formatCategory(auction.category)}</div>
            <h3 class="auction-title">${auction.title}</h3>
            <div class="auction-meta">
                <div class="current-bid">
                    <div class="bid-label">Current Bid</div>
                    <div class="bid-amount">₹${auction.current_bid.toLocaleString()}</div>
                </div>
                <div class="auction-timer">
                    <div class="timer-live">${timeRemaining}</div>
                    <div style="font-size: 0.75rem; margin-top: 0.3rem; opacity: 0.7;">${auction.total_bids} bids</div>
                </div>
            </div>
        </div>
    `;
    
    return card;
}

function getTimeRemaining(endTime) {
    const now = new Date();
    const end = new Date(endTime);
    const diff = end - now;
    
    if (diff <= 0) return 'Ended';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}

function formatCategory(category) {
    return category.split('_').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
}

function filterByCategory(category) {
    loadAuctions({ category });
    document.getElementById('auctions').scrollIntoView({ behavior: 'smooth' });
}

// Auction Detail View
async function openAuctionDetail(auctionId) {
    if (!authToken) {
        showNotification('Please login to view auction details', 'error');
        showLoginModal();
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/auctions/${auctionId}`);
        const data = await response.json();
        
        if (data.success) {
            showAuctionDetailModal(data.data);
        }
    } catch (error) {
        console.error('Load auction detail error:', error);
        showNotification('Failed to load auction details', 'error');
    }
}

function showAuctionDetailModal(auctionData) {
    const { auction, seller, recent_bids } = auctionData;
    
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'auctionDetailModal';
    
    const imageUrl = auction.images && auction.images.length > 0 
        ? auction.images[0].url 
        : 'https://via.placeholder.com/600x400?text=No+Image';
    
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 900px; max-height: 90vh; overflow-y: auto;">
            <button class="modal-close" onclick="closeModal('auctionDetailModal')">×</button>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
                <div>
                    <img src="${imageUrl}" alt="${auction.title}" style="width: 100%; border-radius: 12px; margin-bottom: 1rem;" onerror="this.src='https://via.placeholder.com/600x400?text=No+Image'">
                    <div style="font-size: 0.85rem; color: var(--slate);">
                        <p><strong>Seller:</strong> ${seller ? seller.username : 'Unknown'}</p>
                        <p><strong>Condition:</strong> ${formatCategory(auction.item_condition)}</p>
                        <p><strong>Views:</strong> ${auction.views}</p>
                    </div>
                </div>
                
                <div>
                    <div style="background: var(--ivory); padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                        <div style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px; color: var(--copper); margin-bottom: 0.5rem;">${formatCategory(auction.category)}</div>
                        <h2 style="font-family: 'Playfair Display', serif; font-size: 2rem; color: var(--charcoal); margin-bottom: 1rem;">${auction.title}</h2>
                        <p style="color: var(--slate); line-height: 1.6;">${auction.description}</p>
                    </div>
                    
                    <div style="background: linear-gradient(135deg, var(--deep-burgundy), #3d0a12); color: white; padding: 1.5rem; border-radius: 12px; margin-bottom: 1rem;">
                        <div style="font-size: 0.85rem; opacity: 0.8; margin-bottom: 0.5rem;">CURRENT BID</div>
                        <div style="font-family: 'Playfair Display', serif; font-size: 2.5rem; font-weight: 700; color: var(--auction-gold);">₹${auction.current_bid.toLocaleString()}</div>
                        <div style="font-size: 0.9rem; margin-top: 0.5rem;">
                            <span>${auction.total_bids} bids</span> • 
                            <span id="timeRemaining_${auction._id}">${getTimeRemaining(auction.end_time)}</span>
                        </div>
                    </div>
                    
                    ${auction.status === 'live' ? `
                        <div style="margin-bottom: 1.5rem;">
                            <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Your Bid Amount</label>
                            <input type="number" id="bidAmount" min="${auction.current_bid + auction.bid_increment}" step="${auction.bid_increment}" value="${auction.current_bid + auction.bid_increment}" style="width: 100%; padding: 1rem; border: 2px solid var(--auction-gold); border-radius: 8px; font-size: 1.1rem; font-weight: 600;">
                            <div style="font-size: 0.85rem; color: var(--slate); margin-top: 0.5rem;">
                                Minimum increment: ₹${auction.bid_increment}
                            </div>
                        </div>
                        <button class="btn btn-primary" style="width: 100%; padding: 1.2rem; font-size: 1.1rem;" onclick="placeBid('${auction._id}')">
                            Place Bid
                        </button>
                    ` : `
                        <div style="text-align: center; padding: 2rem; background: var(--ivory); border-radius: 8px;">
                            <p style="color: var(--deep-burgundy); font-weight: 600;">This auction has ${auction.status}</p>
                        </div>
                    `}
                    
                    ${recent_bids && recent_bids.length > 0 ? `
                        <div style="margin-top: 2rem;">
                            <h3 style="font-family: 'Playfair Display', serif; margin-bottom: 1rem;">Recent Bids</h3>
                            <div style="max-height: 200px; overflow-y: auto; background: var(--ivory); border-radius: 8px; padding: 1rem;">
                                ${recent_bids.map(bid => `
                                    <div style="padding: 0.5rem 0; border-bottom: 1px solid rgba(0,0,0,0.05); display: flex; justify-content: space-between;">
                                        <span style="font-weight: 600;">${bid.username}</span>
                                        <span style="color: var(--auction-gold);">₹${bid.bid_amount.toLocaleString()}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Join auction room for real-time updates
    if (socket && auction.status === 'live') {
        socket.emit('join_auction', auction._id);
        
        socket.on('bid_update', (data) => {
            if (data.auction_id === auction._id) {
                // Update UI with new bid
                location.reload(); // Simple refresh for now
            }
        });
    }
}

// Bidding Functions
async function placeBid(auctionId) {
    if (!authToken) {
        showNotification('Please login to place a bid', 'error');
        return;
    }
    
    const bidAmount = parseFloat(document.getElementById('bidAmount').value);
    
    if (!bidAmount || bidAmount <= 0) {
        showNotification('Please enter a valid bid amount', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/bids`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                auction_id: auctionId,
                bid_amount: bidAmount
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('Bid placed successfully!', 'success');
            
            // Emit socket event
            if (socket) {
                socket.emit('new_bid', {
                    auction_id: auctionId,
                    bid_amount: bidAmount,
                    bidder_username: currentUser.username,
                    total_bids: data.data.total_bids
                });
            }
            
            loadWallet();
            closeModal('auctionDetailModal');
            loadAuctions();
        } else {
            showNotification(data.message || 'Failed to place bid', 'error');
        }
    } catch (error) {
        console.error('Place bid error:', error);
        showNotification('Failed to place bid. Please try again.', 'error');
    }
}

async function showMyBids() {
    if (!authToken) {
        showNotification('Please login to view your bids', 'error');
        showLoginModal();
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/bids/my-bids`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const data = await response.json();
        
        if (data.success) {
            displayMyBidsModal(data.data);
        }
    } catch (error) {
        console.error('Load my bids error:', error);
        showNotification('Failed to load your bids', 'error');
    }
}

async function showMyAuctions() {
    if (!authToken) {
        showNotification('Please login to view your auctions', 'error');
        showLoginModal();
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/auctions/my-auctions`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const data = await response.json();
        
        if (data.success) {
            displayMyAuctionsModal(data.data.auctions);
        }
    } catch (error) {
        console.error('Load my auctions error:', error);
        showNotification('Failed to load your auctions', 'error');
    }
}

function displayMyBidsModal(bids) {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'myBidsModal';
    
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 800px;">
            <button class="modal-close" onclick="closeModal('myBidsModal')">×</button>
            <h2 class="modal-title">My Bids</h2>
            <div style="max-height: 500px; overflow-y: auto;">
                ${bids.length > 0 ? bids.map(bid => `
                    <div style="padding: 1rem; background: var(--ivory); margin-bottom: 1rem; border-radius: 8px; border-left: 4px solid ${bid.is_winning ? 'var(--auction-gold)' : 'var(--slate)'};">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <h4 style="font-family: 'Playfair Display', serif; margin-bottom: 0.5rem;">${bid.auction ? bid.auction.title : 'Unknown Auction'}</h4>
                                <p style="font-size: 0.9rem; color: var(--slate);">Your bid: ₹${bid.bid_amount.toLocaleString()}</p>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-weight: 600; color: ${bid.is_winning ? 'var(--auction-gold)' : 'var(--slate)'};">
                                    ${bid.is_winning ? '🏆 Winning' : 'Outbid'}
                                </div>
                                <div style="font-size: 0.85rem; color: var(--slate); margin-top: 0.3rem;">
                                    ${new Date(bid.bid_time).toLocaleString()}
                                </div>
                            </div>
                        </div>
                    </div>
                `).join('') : '<p style="text-align: center; color: var(--slate); padding: 2rem;">You haven\'t placed any bids yet.</p>'}
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

function displayMyAuctionsModal(auctions) {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'myAuctionsModal';
    
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 800px;">
            <button class="modal-close" onclick="closeModal('myAuctionsModal')">×</button>
            <h2 class="modal-title">My Listings</h2>
            <div style="max-height: 500px; overflow-y: auto;">
                ${auctions.length > 0 ? auctions.map(auction => `
                    <div style="padding: 1rem; background: var(--ivory); margin-bottom: 1rem; border-radius: 8px;">
                        <h4 style="font-family: 'Playfair Display', serif; margin-bottom: 0.5rem;">${auction.title}</h4>
                        <div style="display: flex; justify-content: space-between; font-size: 0.9rem; color: var(--slate);">
                            <span>Current: ₹${auction.current_bid.toLocaleString()}</span>
                            <span>${auction.total_bids} bids</span>
                            <span class="timer-live" style="background: rgba(92, 14, 25, 0.1); padding: 0.2rem 0.6rem; border-radius: 12px;">${auction.status}</span>
                        </div>
                    </div>
                `).join('') : '<p style="text-align: center; color: var(--slate); padding: 2rem;">You haven\'t created any auctions yet.</p>'}
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Socket.IO Functions
function initializeSocket() {
    if (!authToken) return;
    
    socket = io(SOCKET_URL, {
        auth: { token: authToken }
    });
    
    socket.on('connect', () => {
        console.log('✅ Connected to WebSocket server');
    });
    
    socket.on('disconnect', () => {
        console.log('❌ Disconnected from WebSocket server');
    });
    
    socket.on('outbid_notification', (data) => {
        showNotification(`You've been outbid on an auction! New bid: ₹${data.new_bid}`, 'warning');
        loadWallet();
    });
    
    socket.on('auction_started', (data) => {
        showNotification('An auction you\'re watching has started!', 'info');
        loadAuctions();
    });
    
    socket.on('auction_closed', (data) => {
        showNotification('An auction has ended!', 'info');
        loadAuctions();
    });
}

// Modal Functions
function showLoginModal() {
    document.getElementById('loginModal').classList.add('active');
}

function showRegisterModal() {
    document.getElementById('registerModal').classList.add('active');
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300);
    }
}

// Notification System
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        background: ${type === 'success' ? 'var(--auction-gold)' : type === 'error' ? 'var(--deep-burgundy)' : type === 'warning' ? 'var(--copper)' : 'var(--slate)'};
        color: white;
        padding: 1.2rem 2rem;
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        z-index: 10000;
        font-weight: 600;
        animation: slideIn 0.3s ease-out;
        max-width: 400px;
    `;
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 4000);
}

// Add animation styles
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
