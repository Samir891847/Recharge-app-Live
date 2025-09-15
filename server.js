const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const Razorpay = require('razorpay');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000; // Render sets PORT for you

// Middleware
app.use(cors());
app.use(express.json()); // To parse JSON request bodies
app.use(express.urlencoded({ extended: true })); // To parse URL-encoded request bodies

// MongoDB Connection
const MONGODB_URI = "mongodb+srv://renderUser:7ANHj5UU5jEHoxw9@cluster0.hoe3ggd.mongodb.net/_rechargeApp?retryWrites=true&w=majority&appName=Cluster0"; // <<< इसे कॉपी-पेस्ट करें


if (!MONGODB_URI) {
    console.error('FATAL ERROR: MONGODB_URI is not defined in environment variables.');
    process.exit(1);
}

mongoose.connect(MONGODB_URI)
    .then(() => console.log('MongoDB connected successfully'))
    .catch(err => {
        console.error('MongoDB connection error:', err.message);
        process.exit(1); // Exit process if cannot connect to DB
    });


// Mongoose Schemas and Models (Defined within server.js for simplicity)


// CommissionSlab Schema
const CommissionSlabSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    roles: [{ type: String, enum: ['master', 'distributor', 'retailer'], required: true }],
    percentages: {
        airtel: { type: Number, default: 0 },
        jio: { type: Number, default: 0 },
        vi: { type: Number, default: 0 },
        bsnl: { type: Number, default: 0 },
        mtnl: { type: Number, default: 0 },
    },
}, { timestamps: true });

const CommissionSlab = mongoose.model('CommissionSlab', CommissionSlabSchema);


// User Schema
const UserSchema = new mongoose.Schema({
    name: { type: String },
    mobile: { type: String, required: true, unique: true },
    email: { type: String, unique: true, sparse: true }, // sparse allows null values to not be unique
    address: { type: String },
    password: { type: String, required: true },
    walletBalance: { type: Number, default: 0 },
    role: { type: String, enum: ['master', 'distributor', 'retailer'], default: 'retailer' },
    status: { type: String, enum: ['active', 'inactive', 'suspended'], default: 'active' },
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    commissionSlab: { type: mongoose.Schema.Types.ObjectId, ref: 'CommissionSlab', default: null },
    lastLogin: { type: Date, default: Date.now },
}, { timestamps: true });

// Pre-save hook to hash password
UserSchema.pre('save', async function (next) {
    if (this.isModified('password')) {
        this.password = await bcrypt.hash(this.password, 10);
    }
    next();
});

const User = mongoose.model('User', UserSchema);


// Transaction Schema
const TransactionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
        type: String,
        enum: [
            'recharge',
            'add_money',
            'commission_credit',
            'balance_transfer_in',
            'balance_transfer_out',
            'admin_credit', // For future admin functionalities
            'admin_debit'   // For future admin functionalities
        ],
        required: true
    },
    amount: { type: Number, required: true },
    status: { type: String, enum: ['pending', 'completed', 'failed', 'refunded'], default: 'completed' },
    operator: { type: String }, // For recharge transactions
    mobileNumber: { type: String }, // For recharge transactions
    orderId: { type: String }, // For Razorpay transactions
    paymentId: { type: String }, // For Razorpay transactions
    signature: { type: String }, // For Razorpay transactions
    description: { type: String }, // General description
    // Fields for commission and balance transfer
    rechargeUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Who did the recharge (for commission)
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },     // Who sent money (for balance transfer out)
    receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },   // Who received money (for balance transfer in)
    commissionPercentage: { type: Number }, // For commission transactions
    referenceTransaction: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' }, // Link to parent transaction (e.g., recharge for commission)
}, { timestamps: true });

const Transaction = mongoose.model('Transaction', TransactionSchema);

// Razorpay Setup
const RAZORPAY_KEY_ID = "rzp_test_REG7HP4iXJBXHc";
const RAZORPAY_KEY_SECRET = "W95kFgueS85rDDrTB5EY0FBr";

if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    console.error('FATAL ERROR: RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is not defined.');
    // Do not exit, allow other features to work, but Razorpay will fail.
}

const razorpay = new Razorpay({
    key_id: RAZORPAY_KEY_ID,
    key_secret: RAZORPAY_KEY_SECRET,
});

// Utility function to generate a unique order ID
function generateOrderId() {
    return 'order_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// ------------------------------------------
// Helper Functions
// ------------------------------------------

// Function to get ancestors (referrers) of a user up to a certain level
async function getAncestors(userId, maxLevels = 2) {
    let ancestors = [];
    let currentUser = await User.findById(userId).select('referredBy role');

    for (let i = 0; i < maxLevels && currentUser && currentUser.referredBy; i++) {
        currentUser = await User.findById(currentUser.referredBy).select('referredBy role commissionSlab');
        if (currentUser) {
            ancestors.push(currentUser);
        }
    }
    return ancestors;
}

// ------------------------------------------
// Routes
// ------------------------------------------

// --- Auth Routes ---

// Signup
app.post('/signup', async (req, res) => {
    const { name, mobile, email, address, password, role, referredByMobile, commissionSlabId } = req.body;

    // Basic validation
    if (!mobile || !password) {
        return res.status(400).json({ message: 'Mobile and password are required.' });
    }
    if (password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
    }

    try {
        const existingUser = await User.findOne({ mobile });
        if (existingUser) {
            return res.status(409).json({ message: 'User with this mobile number already exists.' });
        }

        let userRole = 'retailer'; // Default role
        let userReferredBy = null;
        let userCommissionSlab = null;

        // If a referrer is provided (e.g., admin creating a user or someone signing up with a referral)
        if (referredByMobile) {
            const referrer = await User.findOne({ mobile: referredByMobile });
            if (!referrer) {
                return res.status(400).json({ message: 'Invalid referrer mobile number.' });
            }
            userReferredBy = referrer._id;
        }

        // If role and commissionSlabId are provided, they override defaults (e.g., for admin/downline creation)
        if (role && ['master', 'distributor', 'retailer'].includes(role)) {
            userRole = role;
        }
        if (commissionSlabId) {
            const slab = await CommissionSlab.findById(commissionSlabId);
            if (!slab) {
                return res.status(400).json({ message: 'Invalid commission slab ID.' });
            }
            userCommissionSlab = slab._id;
        }

        const newUser = new User({
            name,
            mobile,
            email,
            address,
            password,
            role: userRole,
            referredBy: userReferredBy,
            commissionSlab: userCommissionSlab
        });

        await newUser.save();
        res.status(201).json({ message: 'User registered successfully!', userId: newUser._id });

    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ message: 'Server error during registration.', error: error.message });
    }
});

// Login
app.post('/login', async (req, res) => {
    const { mobile, password } = req.body;

    if (!mobile || !password) {
        return res.status(400).json({ message: 'Mobile and password are required.' });
    }

    try {
        const user = await User.findOne({ mobile });
        if (!user) {
            return res.status(401).json({ message: 'Invalid mobile number or password.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid mobile number or password.' });
        }

        // Update last login
        user.lastLogin = Date.now();
        await user.save();

        res.status(200).json({
            message: 'Login successful!',
            userId: user._id,
            mobile: user.mobile,
            name: user.name,
            walletBalance: user.walletBalance,
            role: user.role
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error during login.', error: error.message });
    }
});

// Forgot Password - Send OTP (Placeholder - Actual OTP logic would be here)
app.post('/forgot-password/send-otp', async (req, res) => {
    const { mobile } = req.body;

    if (!mobile) {
        return res.status(400).json({ message: 'Mobile number is required.' });
    }

    try {
        const user = await User.findOne({ mobile });
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // In a real app, generate OTP, save it to user record with expiry, and send via SMS.
        // For now, we'll just simulate success.
        console.log(`Simulating OTP sent to ${mobile}`);
        // user.otp = '123456'; // Save OTP
        // user.otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes expiry
        // await user.save();

        res.status(200).json({ message: 'OTP sent to your mobile number.' }); // In a real app, don't send OTP back
    } catch (error) {
        console.error('Forgot password OTP error:', error);
        res.status(500).json({ message: 'Server error sending OTP.', error: error.message });
    }
});

// Reset Password
app.post('/forgot-password/reset', async (req, res) => {
    const { mobile, otp, newPassword } = req.body;

    if (!mobile || !otp || !newPassword) {
        return res.status(400).json({ message: 'Mobile, OTP, and New Password are required.' });
    }
    if (newPassword.length < 6) {
        return res.status(400).json({ message: 'New password must be at least 6 characters long.' });
    }

    try {
        const user = await User.findOne({ mobile });
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // In a real app, verify OTP and expiry.
        // if (user.otp !== otp || user.otpExpires < Date.now()) {
        //     return res.status(400).json({ message: 'Invalid or expired OTP.' });
        // }

        // For now, simple check for dummy OTP "123456"
        if (otp !== '123456') { // Remove in production, use actual OTP validation
             return res.status(400).json({ message: 'Invalid OTP.' });
        }


        user.password = newPassword; // Pre-save hook will hash it
        // user.otp = undefined; // Clear OTP
        // user.otpExpires = undefined; // Clear OTP expiry
        await user.save();

        res.status(200).json({ message: 'Password reset successful!' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ message: 'Server error resetting password.', error: error.message });
    }
});

// --- User Profile & Downline Management Routes ---

// Get User Profile
app.get('/profile/:userId', async (req, res) => {
    try {
        const user = await User.findById(req.params.userId)
            .populate('commissionSlab') // Populate commission slab details
            .populate('referredBy', 'name mobile role'); // Populate referrer details (name, mobile, role)

        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        res.status(200).json({
            _id: user._id,
            name: user.name,
            mobile: user.mobile,
            email: user.email,
            address: user.address,
            walletBalance: user.walletBalance,
            role: user.role,
            status: user.status,
            lastLogin: user.lastLogin,
            commissionSlab: user.commissionSlab, // Will be populated object
            referredBy: user.referredBy // Will be populated object
        });

    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ message: 'Server error fetching profile.', error: error.message });
    }
});

// Create Downline User (by Master/Distributor)
app.post('/user/createDownline', async (req, res) => {
    const { referrerId, name, mobile, password, role, commissionSlabId } = req.body;

    if (!referrerId || !name || !mobile || !password || !role || !commissionSlabId) {
        return res.status(400).json({ message: 'All fields are required for creating a downline user.' });
    }
    if (password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
    }
    if (!['distributor', 'retailer'].includes(role)) {
        return res.status(400).json({ message: 'Invalid role for downline user. Must be distributor or retailer.' });
    }

    try {
        const referrer = await User.findById(referrerId);
        if (!referrer) {
            return res.status(404).json({ message: 'Referrer not found.' });
        }
        // Only Master and Distributor can create downline
        if (!['master', 'distributor'].includes(referrer.role)) {
            return res.status(403).json({ message: 'Only Master and Distributors can create downline users.' });
        }
        // A distributor can only create retailers
        if (referrer.role === 'distributor' && role === 'distributor') {
            return res.status(403).json({ message: 'Distributors can only create Retailer users, not other Distributors.' });
        }

        const existingUser = await User.findOne({ mobile });
        if (existingUser) {
            return res.status(409).json({ message: 'User with this mobile number already exists.' });
        }

        const slab = await CommissionSlab.findById(commissionSlabId);
        if (!slab) {
            return res.status(400).json({ message: 'Invalid commission slab ID.' });
        }
        // Ensure the selected slab is applicable to the assigned role
        if (!slab.roles.includes(role)) {
            return res.status(400).json({ message: `Selected commission slab is not applicable for ${role} role.` });
        }

        const newDownlineUser = new User({
            name,
            mobile,
            password,
            role,
            referredBy: referrer._id,
            commissionSlab: slab._id
        });

        await newDownlineUser.save();
        res.status(201).json({ message: 'Downline user created successfully!', userId: newDownlineUser._id });

    } catch (error) {
        console.error('Create downline user error:', error);
        res.status(500).json({ message: 'Server error creating downline user.', error: error.message });
    }
});

// Get Downline Users (by Master/Distributor)
app.get('/user/downline/:userId', async (req, res) => {
    try {
        const currentUser = await User.findById(req.params.userId);
        if (!currentUser) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // Only Master and Distributor roles are expected to have a downline
        if (!['master', 'distributor'].includes(currentUser.role)) {
            return res.status(403).json({ message: 'Only Master and Distributors can view downline users.' });
        }

        const downlineUsers = await User.find({ referredBy: currentUser._id })
            .select('name mobile role walletBalance status commissionSlab')
            .populate('commissionSlab', 'name percentages'); // Populate slab name and percentages

        res.status(200).json(downlineUsers);

    } catch (error) {
        console.error('Get downline users error:', error);
        res.status(500).json({ message: 'Server error fetching downline users.', error: error.message });
    }
});

// --- Commission Slab Routes ---

// Create Commission Slab (Admin only - for initial setup or modification)
// In a real app, this would be restricted to admin roles.
// For testing, you might need to call this manually via Postman to set up slabs.
app.post('/commissionslabs', async (req, res) => {
    const { name, roles, percentages } = req.body;

    if (!name || !roles || !percentages) {
        return res.status(400).json({ message: 'Name, roles, and percentages are required.' });
    }
    if (!Array.isArray(roles) || roles.length === 0) {
        return res.status(400).json({ message: 'Roles must be an array and not empty.' });
    }
    const invalidRoles = roles.filter(role => !['master', 'distributor', 'retailer'].includes(role));
    if (invalidRoles.length > 0) {
        return res.status(400).json({ message: `Invalid roles provided: ${invalidRoles.join(', ')}` });
    }

    try {
        const existingSlab = await CommissionSlab.findOne({ name });
        if (existingSlab) {
            return res.status(409).json({ message: 'Commission slab with this name already exists.' });
        }

        const newSlab = new CommissionSlab({ name, roles, percentages });
        await newSlab.save();
        res.status(201).json({ message: 'Commission slab created successfully!', slab: newSlab });
    } catch (error) {
        console.error('Create commission slab error:', error);
        res.status(500).json({ message: 'Server error creating commission slab.', error: error.message });
    }
});

// Get All Commission Slabs
app.get('/commissionslabs', async (req, res) => {
    try {
        const slabs = await CommissionSlab.find({});
        res.status(200).json(slabs);
    } catch (error) {
        console.error('Get commission slabs error:', error);
        res.status(500).json({ message: 'Server error fetching commission slabs.', error: error.message });
    }
});


// --- Wallet Routes ---

// Initiate Add Money (Razorpay Order Creation)
app.post('/add-money/initiate', async (req, res) => {
    const { userId, amount } = req.body;

    if (!userId || !amount || amount <= 0) {
        return res.status(400).json({ message: 'User ID and a valid amount are required.' });
    }

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const orderOptions = {
            amount: amount * 100, // amount in smallest currency unit (paise)
            currency: 'INR',
            receipt: generateOrderId(), // Custom receipt ID
            payment_capture: 1 // Auto capture payment
        };

        const razorpayOrder = await razorpay.orders.create(orderOptions);

        res.status(200).json({
            orderId: razorpayOrder.id,
            currency: razorpayOrder.currency,
            amount: razorpayOrder.amount,
            key_id: RAZORPAY_KEY_ID // Send Key ID to frontend for checkout
        });

    } catch (error) {
        console.error('Error initiating Razorpay order:', error);
        res.status(500).json({ message: 'Failed to initiate payment.', error: error.message });
    }
});

// Verify Add Money Payment and Update Wallet
app.post('/add-money/verify', async (req, res) => {
    const { userId, orderId, paymentId, signature, amount } = req.body;

    if (!userId || !orderId || !paymentId || !signature || !amount) {
        return res.status(400).json({ message: 'All payment details are required for verification.' });
    }

    try {
        // Verify payment signature
        const shasum = crypto.createHmac('sha256', RAZORPAY_KEY_SECRET);
        shasum.update(`${orderId}|${paymentId}`);
        const digest = shasum.digest('hex');

        if (digest !== signature) {
            // Log this for security
            console.warn(`Payment verification failed for order ${orderId}: Signature mismatch.`);
            return res.status(400).json({ message: 'Payment verification failed: Invalid signature.' });
        }

        // Signature verified, update user's wallet and create transaction
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // Check if transaction already processed (idempotency)
        const existingTransaction = await Transaction.findOne({ orderId: orderId, paymentId: paymentId, type: 'add_money' });
        if (existingTransaction) {
            return res.status(200).json({ message: 'Payment already processed.', walletBalance: user.walletBalance });
        }

        user.walletBalance += amount;
        await user.save();

        const transaction = new Transaction({
            userId: user._id,
            type: 'add_money',
            amount: amount,
            status: 'completed',
            orderId: orderId,
            paymentId: paymentId,
            signature: signature,
            description: `Money added to wallet via Razorpay.`
        });
        await transaction.save();

        res.status(200).json({ message: 'Payment successful, wallet updated!', walletBalance: user.walletBalance });

    } catch (error) {
        console.error('Error verifying Razorpay payment:', error);
        res.status(500).json({ message: 'Failed to verify payment.', error: error.message });
    }
});

// Transfer Balance to Downline User
app.post('/wallet/transfer', async (req, res) => {
    const { senderId, receiverMobile, amount } = req.body;

    if (!senderId || !receiverMobile || !amount || amount <= 0) {
        return res.status(400).json({ message: 'Sender ID, receiver mobile, and a valid amount are required.' });
    }

    try {
        // Find sender
        const sender = await User.findById(senderId);
        if (!sender) {
            return res.status(404).json({ message: 'Sender user not found.' });
        }

        // Check sender role - only master/distributor can transfer balance to downline
        if (!['master', 'distributor'].includes(sender.role)) {
            return res.status(403).json({ message: 'Only Master and Distributors can transfer balance.' });
        }

        // Find receiver
        const receiver = await User.findOne({ mobile: receiverMobile });
        if (!receiver) {
            return res.status(404).json({ message: 'Receiver user not found.' });
        }

        // Verify receiver is in sender's direct downline
        if (!receiver.referredBy || receiver.referredBy.toString() !== sender._id.toString()) {
            return res.status(403).json({ message: 'Receiver is not in your direct downline.' });
        }

        // Check if sender has sufficient balance
        if (sender.walletBalance < amount) {
            return res.status(400).json({ message: 'Insufficient balance to transfer.' });
        }

        // Perform transfer
        sender.walletBalance -= amount;
        receiver.walletBalance += amount;

        // Use a transaction for atomicity if possible (Mongo v4.0+)
        // For simplicity here, we'll do sequential saves.
        await sender.save();
        await receiver.save();

        // Create transactions for both sender and receiver
        const senderTransaction = new Transaction({
            userId: sender._id,
            type: 'balance_transfer_out',
            amount: amount,
            status: 'completed',
            receiverId: receiver._id,
            description: `Transferred ${amount} to ${receiver.name} (${receiver.mobile})`
        });
        await senderTransaction.save();

        const receiverTransaction = new Transaction({
            userId: receiver._id,
            type: 'balance_transfer_in',
            amount: amount,
            status: 'completed',
            senderId: sender._id,
            description: `Received ${amount} from ${sender.name} (${sender.mobile})`
        });
        await receiverTransaction.save();

        res.status(200).json({
            message: 'Balance transferred successfully!',
            senderWalletBalance: sender.walletBalance
        });

    } catch (error) {
        console.error('Balance transfer error:', error);
        res.status(500).json({ message: 'Server error during balance transfer.', error: error.message });
    }
});

// --- Recharge Routes ---

app.post('/recharge', async (req, res) => {
    const { userId, mobileNumber, operator, amount } = req.body;

    if (!userId || !mobileNumber || !operator || !amount || amount <= 0) {
        return res.status(400).json({ message: 'All recharge details and a valid amount are required.' });
    }

    // Basic mobile number validation
    if (!/^[0-9]{10}$/.test(mobileNumber)) {
        return res.status(400).json({ message: 'Invalid mobile number. Must be 10 digits.' });
    }

    try {
        const user = await User.findById(userId).populate('commissionSlab');
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        if (user.status !== 'active') {
            return res.status(403).json({ message: 'Your account is not active. Please contact support.' });
        }

        if (user.walletBalance < amount) {
            return res.status(400).json({ message: 'Insufficient wallet balance for recharge.' });
        }

        // --- Simulate Recharge (In a real app, integrate with an operator API) ---
        const rechargeSuccess = true; // Assume success for now
        let rechargeStatus = 'failed';
        if (rechargeSuccess) {
            rechargeStatus = 'completed';
        }

        // Deduct amount from user's wallet immediately
        user.walletBalance -= amount;
        await user.save();

        // Create main recharge transaction for the user
        const rechargeTransaction = new Transaction({
            userId: user._id,
            type: 'recharge',
            amount: amount,
            status: rechargeStatus,
            operator: operator,
            mobileNumber: mobileNumber,
            description: `Mobile recharge for ${mobileNumber} (${operator})`
        });
        await rechargeTransaction.save();

        if (rechargeStatus === 'failed') {
            // In a real scenario, you might want to refund the money or handle it differently
            return res.status(200).json({ message: 'Recharge failed. Amount deducted. Please contact support.', walletBalance: user.walletBalance });
        }

        // --- Commission Distribution Logic ---
        console.log(`Recharge by ${user.name} (${user.mobile}) for ${amount}. Starting commission distribution.`);

        // 1. Credit commission to the user who did the recharge (retailer/distributor/master)
        if (user.commissionSlab) {
            const userCommissionPercentage = user.commissionSlab.percentages[operator] || 0;
            if (userCommissionPercentage > 0) {
                const commissionAmount = (amount * userCommissionPercentage) / 100;
                user.walletBalance += commissionAmount; // Add commission back to user
                await user.save();

                const commissionTx = new Transaction({
                    userId: user._id,
                    type: 'commission_credit',
                    amount: commissionAmount,
                    status: 'completed',
                    description: `Commission for own recharge (${operator})`,
                    rechargeUser: user._id,
                    commissionPercentage: userCommissionPercentage,
                    referenceTransaction: rechargeTransaction._id
                });
                await commissionTx.save();
                console.log(`User ${user.name} credited with ${commissionAmount} (Self Commission)`);
            }
        }

        // 2. Distribute commission to ancestors (referrer chain)
        let currentReferralUser = user;
        let processedAncestors = new Set(); // To prevent double processing if referral chain loops (shouldn't happen with good data)

        while (currentReferralUser.referredBy) {
            // Find the referrer with their commission slab
            const referrer = await User.findById(currentReferralUser.referredBy).populate('commissionSlab');

            if (!referrer || processedAncestors.has(referrer._id.toString())) {
                break; // Stop if referrer not found or already processed
            }
            processedAncestors.add(referrer._id.toString());

            if (referrer.commissionSlab) {
                // Determine commission based on referrer's role and slab
                const referrerCommissionPercentage = referrer.commissionSlab.percentages[operator] || 0;

                if (referrerCommissionPercentage > 0) {
                    // In a multi-level system, this might need to be tiered
                    // For now, let's assume direct percentage from total amount
                    const commissionAmount = (amount * referrerCommissionPercentage) / 100;

                    // Atomically update referrer's balance
                    referrer.walletBalance += commissionAmount;
                    await referrer.save();

                    const commissionTx = new Transaction({
                        userId: referrer._id,
                        type: 'commission_credit',
                        amount: commissionAmount,
                        status: 'completed',
                        description: `Commission for downline recharge by ${user.name} (${user.mobile})`,
                        rechargeUser: user._id, // The original user who did the recharge
                        commissionPercentage: referrerCommissionPercentage,
                        referenceTransaction: rechargeTransaction._id // Link to original recharge
                    });
                    await commissionTx.save();
                    console.log(`Referrer ${referrer.name} (${referrer.role}) credited with ${commissionAmount} (Downline Commission)`);
                }
            }
            currentReferralUser = referrer; // Move up the chain
        }

        res.status(200).json({
            message: 'Recharge successful and commission distributed!',
            walletBalance: user.walletBalance // Return updated balance including self-commission
        });

    } catch (error) {
        console.error('Recharge error:', error);
        res.status(500).json({ message: 'Server error during recharge.', error: error.message });
    }
});

// --- Transaction History Route ---

app.get('/history/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const transactions = await Transaction.find({ userId: userId })
            .populate('rechargeUser', 'name mobile')      // For commission_credit, show who recharged
            .populate('senderId', 'name mobile')          // For balance_transfer_in, show who sent
            .populate('receiverId', 'name mobile')        // For balance_transfer_out, show who received
            .populate('referenceTransaction', 'type operator mobileNumber amount') // For commission, show original recharge
            .sort({ createdAt: -1 }); // Latest first

        // Custom formatting for frontend display
        const formattedTransactions = transactions.map(tx => {
            let description = tx.description;
            let type = tx.type;
            let amount = tx.amount;
            let status = tx.status; // default to 'completed' or actual status

            switch (tx.type) {
                case 'recharge':
                    description = `Recharge of ₹${tx.amount.toFixed(2)} for ${tx.mobileNumber} (${tx.operator})`;
                    break;
                case 'add_money':
                    description = `Money added to wallet: ₹${tx.amount.toFixed(2)}`;
                    break;
                case 'commission_credit':
                    const originalRechargeAmount = tx.referenceTransaction ? tx.referenceTransaction.amount : 'N/A';
                    const originalRechargeMobile = tx.referenceTransaction ? tx.referenceTransaction.mobileNumber : 'N/A';
                    const rechargedByUser = tx.rechargeUser ? `${tx.rechargeUser.name} (${tx.rechargeUser.mobile})` : 'a downline user';
                    description = `Commission ( ${tx.commissionPercentage}% ) for recharge of ₹${originalRechargeAmount} by ${rechargedByUser}`;
                    type = 'Commission Received';
                    break;
                case 'balance_transfer_out':
                    const receiverInfo = tx.receiverId ? `${tx.receiverId.name} (${tx.receiverId.mobile})` : 'a user';
                    description = `Transferred ₹${tx.amount.toFixed(2)} to ${receiverInfo}`;
                    type = 'Balance Sent';
                    break;
                case 'balance_transfer_in':
                    const senderInfo = tx.senderId ? `${tx.senderId.name} (${tx.senderId.mobile})` : 'a user';
                    description = `Received ₹${tx.amount.toFixed(2)} from ${senderInfo}`;
                    type = 'Balance Received';
                    break;
                case 'admin_credit':
                    description = `Admin credited ₹${tx.amount.toFixed(2)}`;
                    type = 'Admin Credit';
                    break;
                case 'admin_debit':
                    description = `Admin debited ₹${tx.amount.toFixed(2)}`;
                    type = 'Admin Debit';
                    break;
            }

            return {
                _id: tx._id,
                date: tx.createdAt,
                type: type,
                amount: amount,
                status: status,
                description: description,
                // Add specific fields if needed for frontend logic
                rawType: tx.type // Keep raw type for internal filtering if needed
            };
        });

        res.status(200).json(formattedTransactions);

    } catch (error) {
        console.error('Get history error:', error);
        res.status(500).json({ message: 'Server error fetching transaction history.', error: error.message });
    }
});

// --- Commission Report Route ---
app.get('/commission-report/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const commissions = await Transaction.find({
            userId: userId,
            type: 'commission_credit'
        })
        .populate('rechargeUser', 'name mobile') // Who performed the original recharge
        .populate('referenceTransaction', 'type operator mobileNumber amount') // Original recharge details
        .sort({ createdAt: -1 });

        const formattedCommissions = commissions.map(tx => {
            const originalRechargeAmount = tx.referenceTransaction ? tx.referenceTransaction.amount : 'N/A';
            const originalRechargeMobile = tx.referenceTransaction ? tx.referenceTransaction.mobileNumber : 'N/A';
            const rechargedByUser = tx.rechargeUser ? `${tx.rechargeUser.name} (${tx.rechargeUser.mobile})` : 'a downline user';
            
            return {
                _id: tx._id,
                date: tx.createdAt,
                type: 'Commission Received',
                amount: tx.amount,
                commissionPercentage: tx.commissionPercentage,
                description: `Commission (${tx.commissionPercentage}%) for recharge of ₹${originalRechargeAmount} by ${rechargedByUser}`,
                rechargeMobile: originalRechargeMobile,
                rechargeAmount: originalRechargeAmount,
                status: tx.status
            };
        });

        res.status(200).json(formattedCommissions);

    } catch (error) {
        console.error('Get commission report error:', error);
        res.status(500).json({ message: 'Server error fetching commission report.', error: error.message });
    }
});

// --- Root Route ---
app.get('/', (req, res) => {
    res.send('Recharge App Backend is running!');
});

// --- Start the Server ---
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});