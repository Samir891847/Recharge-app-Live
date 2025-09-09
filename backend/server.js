// File ke bilkul shuru mein, sabhi packages se pehle yeh line honi chahiye
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const bcrypt = require('bcrypt');
const axios = require('axios');
const nodemailer = require('nodemailer');
const Razorpay = require('razorpay');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Razorpay keys ko ab .env file se load kiya ja raha hai
var instance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const mongoUri = process.env.MONGO_URI;

mongoose.connect(mongoUri)
  .then(() => console.log('✅ MongoDB se safaltapoorvak connect ho gaya!'))
  .catch(err => console.error('❌ MongoDB Error:', err));

const otpStore = {};

const rechargeSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  mobileNumber: { type: String, required: true },
  operator: { type: String, required: true },
  amount: { type: Number, required: true },
  date: { type: Date, default: Date.now }
});

const Recharge = mongoose.model('Recharge', rechargeSchema);

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  address: { type: String },
  mobileNumber: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  walletBalance: { type: Number, default: 0 },
  lastLoginLocation: { type: String, default: 'Unknown' },
});

const User = mongoose.model('User', userSchema);

const addMoneySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  amount: { type: Number, required: true },
  date: { type: Date, default: Date.now }
});

const AddMoney = mongoose.model('AddMoney', addMoneySchema);

app.post('/signup', async (req, res) => {
  try {
    const { name, email, mobileNumber, address, password } = req.body;
    if (!name || !email || !mobileNumber || !password || mobileNumber.length !== 10) {
      return res.status(400).json({ success: false, message: 'Kripya sahi jaankari daalein.' });
    }

    const existingUser = await User.findOne({ mobileNumber });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Yeh mobile number pehle se registered hai.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ name, email, mobileNumber, address, password: hashedPassword });
    await newUser.save();

    res.status(201).json({ success: true, message: '✔ Registration safal! Ab login karein.' });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ success: false, message: '❌ Signup mein error hua!' });
  }
});

app.post('/login', async (req, res) => {
  try {
    const { mobileNumber, password, userIp } = req.body;
    const user = await User.findOne({ mobileNumber });
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid mobile number ya password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Invalid mobile number ya password.' });
    }

    res.status(200).json({ success: true, message: '✔ Login safal!', userId: user._id, name: user.name });

    (async () => {
      let location = 'Unknown';
      try {
        const geoResponse = await axios.get(`http://ip-api.com/json/${userIp}`);
        if (geoResponse.data.status === 'success') {
          location = `${geoResponse.data.city}, ${geoResponse.data.regionName}, ${geoResponse.data.country}`;
        }
      } catch (locationErr) {
        console.error('Location fetch error:', locationErr.message);
      }
      user.lastLoginLocation = location;
      await user.save();
    })();

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: '❌ Login mein error hua!' });
  }
});

app.post('/send-otp', async (req, res) => {
  try {
    const { mobileNumber } = req.body;
    const user = await User.findOne({ mobileNumber });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Yeh mobile number registered nahi hai.' });
    }

    const otp = Math.floor(1000 + Math.random() * 9000);
    otpStore[mobileNumber] = otp;

    console.log(`OTP for ${mobileNumber} is: ${otp}`);
    res.status(200).json({ success: true, message: 'OTP bhej diya gaya hai. Kripya terminal check karein.' });
  } catch (err) {
    console.error('OTP send error:', err);
    res.status(500).json({ success: false, message: '❌ OTP bhejte samay error hua!' });
  }
});

app.post('/verify-otp-and-reset', async (req, res) => {
  try {
    const { mobileNumber, otp, newPassword } = req.body;
    if (otpStore[mobileNumber] != otp) {
      return res.status(400).json({ success: false, message: 'Galat OTP. Kripya dobara try karein.' });
    }

    const user = await User.findOne({ mobileNumber });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User nahi mila.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();
    delete otpStore[mobileNumber];
    res.status(200).json({ success: true, message: '✔ Naya password set ho gaya!' });
  } catch (err) {
    console.error('OTP verify error:', err);
    res.status(500).json({ success: false, message: '❌ Password reset mein error hua!' });
  }
});

app.post('/recharge', async (req, res) => {
  try {
    const { userId, mobileNumber, operator, amount } = req.body;
    if (!userId || !mobileNumber || !operator || !amount) {
      return res.status(400).json({ success: false, message: 'Kuchh jaankari adhoori hai!' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User nahi mila!' });
    }

    if (user.walletBalance < amount) {
      return res.status(400).json({ success: false, message: '❌ Insufficient balance!' });
    }

    const newRecharge = new Recharge({ userId, mobileNumber, operator, amount });
    await newRecharge.save();

    user.walletBalance -= amount;
    await user.save();

    res.status(200).json({ success: true, message: '✔ Recharge safal!' });
  } catch (err) {
    console.error('Recharge save karne mein error:', err);
    res.status(500).json({ success: false, message: '❌ Error hua!' });
  }
});

app.post('/createOrder', (req, res) => {
  const amount = req.body.amount * 100;

  var options = {
    amount: amount,
    currency: "INR",
    receipt: "receipt_order_12345",
  };

  instance.orders.create(options, (err, order) => {
    if (err) {
      return res.status(500).send(err);
    }
    res.json(order);
  });
});

app.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found!' });
    }
    res.status(200).json({ success: true, user: {
      name: user.name,
      email: user.email,
      mobileNumber: user.mobileNumber
    }});
  } catch (err) {
    console.error('Error fetching user details:', err);
    res.status(500).json({ success: false, message: 'Could not fetch user details.' });
  }
});

app.get('/profile/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found!' });
    }
    res.status(200).json({
      success: true,
      user: {
        name: user.name,
        email: user.email,
        mobileNumber: user.mobileNumber,
        address: user.address,
        walletBalance: user.walletBalance,
        lastLoginLocation: user.lastLoginLocation
      }
    });
  } catch (err) {
    console.error('Profile fetch error:', err);
    res.status(500).json({ success: false, message: 'Could not fetch profile details.' });
  }
});

app.get('/history/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const recharges = await Recharge.find({ userId }).sort({ date: -1 });
    const addMoney = await AddMoney.find({ userId }).sort({ date: -1 });

    const combinedHistory = [
      ...recharges.map(item => ({...item.toObject(), type: 'recharge', description: `Recharge for ${item.mobileNumber} (${item.operator})`})),
      ...addMoney.map(item => ({...item.toObject(), type: 'add_money', description: 'Balance added to wallet'}))
    ];

    combinedHistory.sort((a, b) => b.date - a.date);

    res.status(200).json({ success: true, transactions: combinedHistory });
  } catch (err) {
    console.error('History nikalne mein error:', err);
    res.status(500).json({ success: false, message: '❌ Error hua!' });
  }
});

app.get('/wallet/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User nahi mila!' });
    }
    res.status(200).json({ success: true, walletBalance: user.walletBalance });
  } catch (err) {
    console.error('Error fetching wallet balance:', err);
    res.status(500).json({ success: false, message: '❌ Error hua!' });
  }
});

app.post('/add-balance', async (req, res) => {
  try {
    const { userId, amount } = req.body;
    if (!userId || !amount) {
      return res.status(400).json({ success: false, message: 'Kuchh jaankari adhoori hai!' });
    }

    let user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User nahi mila!' });
    }

    user.walletBalance += amount;
    await user.save();

    const newAddMoney = new AddMoney({ userId, amount });
    await newAddMoney.save();

    res.status(200).json({ success: true, message: '✔ Balance successfully added!', walletBalance: user.walletBalance });
  } catch (err) {
    console.error('Error adding balance:', err);
    res.status(500).json({ success: false, message: '❌ Error hua!' });
  }
});

app.get('/plans/:operator', (req, res) => {
  const operator = req.params.operator.toLowerCase();
  const plans = {
    jio: [
      { amount: 199, description: '1.5GB/day, Unlimited Calls, 28 days' },
      { amount: 599, description: '2GB/day, Unlimited Calls, 84 days' },
      { amount: 239, description: '1.5GB/day, Unlimited Calls, 28 days' }
    ],
    airtel: [
      { amount: 265, description: '1GB/day, Unlimited Calls, 28 days' },
      { amount: 719, description: '1.5GB/day, Unlimited Calls, 84 days' },
      { amount: 155, description: '1GB, Unlimited Calls, 24 days' }
    ],
    vi: [
      { amount: 299, description: '1.5GB/day, Unlimited Calls, 28 days' },
      { amount: 479, description: '1.5GB/day, Unlimited Calls, 56 days' }
    ],
    bsnl: [
      { amount: 18, description: '2GB/day, Unlimited Calls, 2 days' },
      { amount: 199, description: '2GB/day, Unlimited Calls, 30 days' }
    ],
    mtnl: [
      { amount: 111, description: '1GB/day, Unlimited Calls, 15 days' },
      { amount: 250, description: '2GB/day, Unlimited Calls, 30 days' }
    ]
  };

  if (plans[operator]) {
    res.json({ success: true, plans: plans[operator] });
  } else {
    res.status(404).json({ success: false, message: 'Plans nahi mile.' });
  }
});

app.use(express.static(path.join(__dirname, '..', 'frontend')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`⚡ Recharge app backend chal raha hai http://localhost:${PORT}`);
});