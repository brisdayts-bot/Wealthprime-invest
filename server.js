const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Session configuration
app.use(session({
    secret: 'wealth_invest_super_secret_key_2026',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 1000 * 60 * 60 * 24 } // 24 hours
}));

// ------------------ LANGUAGE DETECTION & TRANSLATIONS ------------------
// Load language files
const locales = {
    en: fs.readJsonSync(path.join(__dirname, 'locales/en.json')),
    fr: fs.readJsonSync(path.join(__dirname, 'locales/fr.json'))
};

// Middleware: detect language from browser or session
app.use((req, res, next) => {
    // Check if user has a language preference in session
    let userLang = req.session.userLang;
    if (!userLang) {
        // Detect from Accept-Language header
        const acceptLanguage = req.headers['accept-language'] || '';
        if (acceptLanguage.includes('fr')) {
            userLang = 'fr';
        } else {
            userLang = 'en';
        }
    }
    req.userLang = userLang;
    res.locals.lang = userLang;
    // Translation function for EJS templates
    res.locals.t = (key) => {
        return locales[userLang][key] || locales['en'][key] || key;
    };
    next();
});

// Route to change language manually
app.post('/api/set-language', (req, res) => {
    const { lang } = req.body;
    if (lang === 'en' || lang === 'fr') {
        req.session.userLang = lang;
        res.json({ success: true });
    } else {
        res.status(400).json({ error: 'Invalid language' });
    }
});
// ----------------------------------------------------------------------

// Database file paths
const DB_PATH = path.join(__dirname, 'database');
const USERS_FILE = path.join(DB_PATH, 'users.json');
const INVESTMENTS_FILE = path.join(DB_PATH, 'investments.json');
const TRANSACTIONS_FILE = path.join(DB_PATH, 'transactions.json');
const NOTIFICATIONS_FILE = path.join(DB_PATH, 'notifications.json');
const TASKS_FILE = path.join(DB_PATH, 'tasks.json');

// Ensure database directory exists
fs.ensureDirSync(DB_PATH);

// Initialize database files if not exist
if (!fs.existsSync(USERS_FILE)) fs.writeJsonSync(USERS_FILE, []);
if (!fs.existsSync(INVESTMENTS_FILE)) fs.writeJsonSync(INVESTMENTS_FILE, []);
if (!fs.existsSync(TRANSACTIONS_FILE)) fs.writeJsonSync(TRANSACTIONS_FILE, []);
if (!fs.existsSync(NOTIFICATIONS_FILE)) fs.writeJsonSync(NOTIFICATIONS_FILE, []);
if (!fs.existsSync(TASKS_FILE)) fs.writeJsonSync(TASKS_FILE, []);

// Helper functions
const saveUsers = (users) => fs.writeJsonSync(USERS_FILE, users);
const saveInvestments = (investments) => fs.writeJsonSync(INVESTMENTS_FILE, investments);
const saveTransactions = (transactions) => fs.writeJsonSync(TRANSACTIONS_FILE, transactions);
const saveNotifications = (notifications) => fs.writeJsonSync(NOTIFICATIONS_FILE, notifications);
const saveTasks = (tasks) => fs.writeJsonSync(TASKS_FILE, tasks);

// Telegram Bot Configuration (Replace with your actual bot token and chat ID)
const TELEGRAM_BOT_TOKEN = '8722934715:AAEDiMFt1-t1mx3kZs78E3K9__tGIH1pmJY';
const TELEGRAM_CHAT_ID = '7373977572';

async function sendTelegramNotification(message) {
    try {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        await axios.post(url, {
            chat_id: TELEGRAM_CHAT_ID,
            text: message,
            parse_mode: 'HTML'
        });
    } catch (error) {
        console.error('Telegram notification failed:', error.message);
    }
}

// Investment Plans
const INVESTMENT_PLANS = {
    '3day': {
        name: '3 Days Plan',
        plans: [
            { id: '3d_1', min: 10000, max: 50000, profit: 40000, dailyPortion: 13333.33 },
            { id: '3d_2', min: 25000, max: 130000, profit: 105000, dailyPortion: 35000 },
            { id: '3d_3', min: 50000, max: 300000, profit: 250000, dailyPortion: 83333.33 }
        ]
    },
    '1week': {
        name: '1 Week Plan',
        plans: [
            { id: '1w_1', min: 10000, max: 150000, profit: 140000, dailyPortion: 20000 },
            { id: '1w_2', min: 25000, max: 450000, profit: 425000, dailyPortion: 60714.28 },
            { id: '1w_3', min: 50000, max: 1050000, profit: 1000000, dailyPortion: 142857.14 }
        ]
    },
    '1month': {
        name: '1 Month Plan',
        plans: [
            { id: '1m_1', min: 100000, max: 15000000, profit: 14900000, dailyPortion: 496666.66 }
        ]
    }
};

// Country payment methods
const COUNTRY_PAYMENTS = {
    'Cameroon': [
        { name: 'Orange Money', code: 'OM', fields: ['phone_number'] },
        { name: 'MTN Mobile Money', code: 'MTN', fields: ['phone_number'] },
        { name: 'Express Union', code: 'EU', fields: ['account_number'] }
    ],
    'Chad': [
        { name: 'Airtel Money', code: 'AM', fields: ['phone_number'] },
        { name: 'Tigo Cash', code: 'TC', fields: ['phone_number'] },
        { name: 'Moov Africa', code: 'MA', fields: ['phone_number'] }
    ],
    'Congo Brazzaville': [
        { name: 'Airtel Money Congo', code: 'AMC', fields: ['phone_number'] },
        { name: 'MTN Mobile Money', code: 'MTN', fields: ['phone_number'] },
        { name: 'EcoCash', code: 'EC', fields: ['phone_number'] }
    ],
    'Gabon': [
        { name: 'Airtel Money Gabon', code: 'AMG', fields: ['phone_number'] },
        { name: 'Moov Money', code: 'MM', fields: ['phone_number'] }
    ],
    'Central African Republic': [
        { name: 'Orange Money CAR', code: 'OMCAR', fields: ['phone_number'] },
        { name: 'Telecel Cash', code: 'TC', fields: ['phone_number'] }
    ]
};

// Authentication Middleware
const requireAuth = (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};

// Routes

// Home - render login/register
app.get('/', (req, res) => {
    if (req.session.userId) {
        return res.redirect('/dashboard');
    }
    res.render('index');
});

// Register
app.post('/api/register', async (req, res) => {
    const { fullname, email, phone, country, password, referralCode } = req.body;
    
    const users = fs.readJsonSync(USERS_FILE);
    
    if (users.find(u => u.email === email)) {
        return res.status(400).json({ error: 'Email already exists' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
        id: uuidv4(),
        fullname,
        email,
        phone,
        country,
        password: hashedPassword,
        balance: 0,
        totalInvested: 0,
        totalWithdrawn: 0,
        referralCode: uuidv4().slice(0, 8).toUpperCase(),
        referredBy: referralCode || null,
        referrals: [],
        createdAt: new Date().toISOString()
    };
    
    // Process referral
    if (referralCode) {
        const referrer = users.find(u => u.referralCode === referralCode);
        if (referrer) {
            newUser.referredBy = referrer.id;
            referrer.referrals.push(newUser.id);
            // Add bonus to referrer
            referrer.balance += 5000;
            await sendTelegramNotification(`🎉 New referral! ${referrer.fullname} referred ${fullname}. Earned 5000 CFA`);
        }
    }
    
    users.push(newUser);
    saveUsers(users);
    
    req.session.userId = newUser.id;
    res.json({ success: true, user: { id: newUser.id, fullname: newUser.fullname, balance: newUser.balance } });
});

// Login
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    const users = fs.readJsonSync(USERS_FILE);
    const user = users.find(u => u.email === email);
    
    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    req.session.userId = user.id;
    res.json({ success: true, user: { id: user.id, fullname: user.fullname, balance: user.balance } });
});

// Logout
app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// Get current user
app.get('/api/me', requireAuth, (req, res) => {
    const users = fs.readJsonSync(USERS_FILE);
    const user = users.find(u => u.id === req.session.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    const investments = fs.readJsonSync(INVESTMENTS_FILE).filter(i => i.userId === user.id);
    const transactions = fs.readJsonSync(TRANSACTIONS_FILE).filter(t => t.userId === user.id);
    
    res.json({
        id: user.id,
        fullname: user.fullname,
        email: user.email,
        phone: user.phone,
        country: user.country,
        balance: user.balance,
        totalInvested: user.totalInvested,
        totalWithdrawn: user.totalWithdrawn,
        referralCode: user.referralCode,
        referrals: user.referrals.length,
        investments,
        transactions: transactions.slice(-10)
    });
});

// Get investment plans
app.get('/api/investment-plans', (req, res) => {
    res.json(INVESTMENT_PLANS);
});

// Make investment
app.post('/api/invest', requireAuth, async (req, res) => {
    const { planType, planId, amount } = req.body;
    const users = fs.readJsonSync(USERS_FILE);
    const user = users.find(u => u.id === req.session.userId);
    
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    const planCategory = INVESTMENT_PLANS[planType];
    if (!planCategory) return res.status(400).json({ error: 'Invalid plan type' });
    
    const plan = planCategory.plans.find(p => p.id === planId);
    if (!plan) return res.status(400).json({ error: 'Invalid plan' });
    
    const amountNum = parseFloat(amount);
    if (amountNum < plan.min || amountNum > plan.max) {
        return res.status(400).json({ error: `Amount must be between ${plan.min} and ${plan.max} CFA` });
    }
    
    if (user.balance < amountNum) {
        return res.status(400).json({ error: 'Insufficient balance' });
    }
    
    // Calculate total return
    let totalReturn, dailyReturn, durationDays;
    switch(planType) {
        case '3day':
            durationDays = 3;
            totalReturn = amountNum + plan.profit;
            dailyReturn = plan.profit / 3;
            break;
        case '1week':
            durationDays = 7;
            totalReturn = amountNum + plan.profit;
            dailyReturn = plan.profit / 7;
            break;
        case '1month':
            durationDays = 30;
            totalReturn = amountNum + plan.profit;
            dailyReturn = plan.profit / 30;
            break;
        default:
            return res.status(400).json({ error: 'Invalid plan type' });
    }
    
    // Deduct balance
    user.balance -= amountNum;
    user.totalInvested += amountNum;
    
    const investment = {
        id: uuidv4(),
        userId: user.id,
        planType,
        planId,
        amount: amountNum,
        totalReturn,
        dailyReturn,
        durationDays,
        remainingDays: durationDays,
        lastClaimDay: null,
        status: 'active',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString()
    };
    
    const investments = fs.readJsonSync(INVESTMENTS_FILE);
    investments.push(investment);
    saveInvestments(investments);
    saveUsers(users);
    
    // Create transaction record
    const transactions = fs.readJsonSync(TRANSACTIONS_FILE);
    transactions.push({
        id: uuidv4(),
        userId: user.id,
        type: 'investment',
        amount: amountNum,
        status: 'completed',
        description: `Investment in ${planCategory.name} - ${plan.min} to ${plan.max} CFA`,
        createdAt: new Date().toISOString()
    });
    saveTransactions(transactions);
    
    await sendTelegramNotification(`💰 New Investment! User ${user.fullname} invested ${amountNum} CFA in ${planCategory.name}`);
    
    res.json({ success: true, balance: user.balance, investment });
});

// Daily task - complete referral task
app.post('/api/complete-task', requireAuth, async (req, res) => {
    const { investmentId } = req.body;
    const users = fs.readJsonSync(USERS_FILE);
    const user = users.find(u => u.id === req.session.userId);
    const investments = fs.readJsonSync(INVESTMENTS_FILE);
    const investment = investments.find(i => i.id === investmentId && i.userId === user.id);
    
    if (!investment) return res.status(404).json({ error: 'Investment not found' });
    if (investment.status !== 'active') return res.status(400).json({ error: 'Investment is not active' });
    if (investment.remainingDays <= 0) return res.status(400).json({ error: 'Investment already completed' });
    
    // Check if already claimed today
    const today = new Date().toDateString();
    if (investment.lastClaimDay === today) {
        return res.status(400).json({ error: 'You already completed today\'s task' });
    }
    
    // Task: User must have referred at least 1 new user today? Or any referral action?
    // For simplicity, we check if user has made any referral in the last 24 hours
    const tasks = fs.readJsonSync(TASKS_FILE);
    const todayTasks = tasks.filter(t => t.userId === user.id && new Date(t.createdAt).toDateString() === today);
    
    // The task is to share referral link and get a new signup. For demo, we check if there's a new referral today
    const newReferralsToday = user.referrals.filter(refId => {
        const referredUser = users.find(u => u.id === refId);
        return referredUser && new Date(referredUser.createdAt).toDateString() === today;
    });
    
    if (newReferralsToday.length === 0) {
        return res.status(400).json({ error: 'Task incomplete: You need to refer at least 1 new user today. Share your referral link!' });
    }
    
    // Add daily reward
    const reward = investment.dailyReturn;
    user.balance += reward;
    investment.remainingDays -= 1;
    investment.lastClaimDay = today;
    
    if (investment.remainingDays === 0) {
        investment.status = 'completed';
        // Add final bonus
        user.balance += investment.amount; // Return initial investment
        await sendTelegramNotification(`✅ Investment completed! ${user.fullname} earned ${investment.totalReturn} CFA total.`);
    }
    
    saveUsers(users);
    saveInvestments(investments);
    
    // Record task completion
    tasks.push({
        id: uuidv4(),
        userId: user.id,
        investmentId,
        type: 'daily_referral',
        reward,
        createdAt: new Date().toISOString()
    });
    saveTasks(tasks);
    
    res.json({ success: true, balance: user.balance, remainingDays: investment.remainingDays, reward });
});

// Get user's active investments
app.get('/api/my-investments', requireAuth, (req, res) => {
    const investments = fs.readJsonSync(INVESTMENTS_FILE);
    const userInvestments = investments.filter(i => i.userId === req.session.userId);
    res.json(userInvestments);
});

// Deposit request
app.post('/api/deposit', requireAuth, async (req, res) => {
    const { country, paymentMethod, accountNumber, amount } = req.body;
    const users = fs.readJsonSync(USERS_FILE);
    const user = users.find(u => u.id === req.session.userId);
    
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    const depositRequest = {
        id: uuidv4(),
        userId: user.id,
        type: 'deposit',
        country,
        paymentMethod,
        accountNumber,
        amount: parseFloat(amount),
        status: 'pending',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    };
    
    const transactions = fs.readJsonSync(TRANSACTIONS_FILE);
    transactions.push(depositRequest);
    saveTransactions(transactions);
    
    await sendTelegramNotification(`💸 Deposit Request! User ${user.fullname} requested deposit of ${amount} CFA via ${paymentMethod} (${country}). Account: ${accountNumber}`);
    
    res.json({ success: true, message: 'Deposit request submitted. You will receive funds within 24 hours.', timer: 24 });
});

// Withdraw request
app.post('/api/withdraw', requireAuth, async (req, res) => {
    const { amount, paymentMethod, accountNumber } = req.body;
    const users = fs.readJsonSync(USERS_FILE);
    const user = users.find(u => u.id === req.session.userId);
    
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    const amountNum = parseFloat(amount);
    if (user.balance < amountNum) {
        return res.status(400).json({ error: 'Insufficient balance' });
    }
    
    // Deduct balance temporarily
    user.balance -= amountNum;
    user.totalWithdrawn += amountNum;
    saveUsers(users);
    
    const withdrawRequest = {
        id: uuidv4(),
        userId: user.id,
        type: 'withdraw',
        amount: amountNum,
        paymentMethod,
        accountNumber,
        status: 'pending',
        createdAt: new Date().toISOString()
    };
    
    const transactions = fs.readJsonSync(TRANSACTIONS_FILE);
    transactions.push(withdrawRequest);
    saveTransactions(transactions);
    
    await sendTelegramNotification(`💸 Withdraw Request! User ${user.fullname} requested withdrawal of ${amountNum} CFA via ${paymentMethod}. Account: ${accountNumber}`);
    
    res.json({ success: true, message: 'Withdrawal request submitted. Processing within 24 hours.' });
});

// Get random withdrawal notifications (for frontend popups)
app.get('/api/random-withdrawal-notification', (req, res) => {
    const withdrawals = [
        { user: "Jean Paul", amount: 125000, country: "Cameroon", time: "just now" },
        { user: "Marie Claire", amount: 45000, country: "Gabon", time: "2 minutes ago" },
        { user: "Ali Mahamat", amount: 230000, country: "Chad", time: "5 minutes ago" },
        { user: "Grace Lopès", amount: 89000, country: "Congo", time: "12 minutes ago" },
        { user: "David Nguema", amount: 312000, country: "CAR", time: "18 minutes ago" },
        { user: "Sophie Kengne", amount: 67000, country: "Cameroon", time: "25 minutes ago" },
        { user: "Mohamed Saleh", amount: 154000, country: "Chad", time: "31 minutes ago" },
        { user: "Chantal Biya", amount: 500000, country: "Cameroon", time: "42 minutes ago" }
    ];
    const random = withdrawals[Math.floor(Math.random() * withdrawals.length)];
    res.json(random);
});

// Admin panel (accessible via /admin with password)
app.get('/admin', (req, res) => {
    res.render('admin');
});

app.post('/admin/login', (req, res) => {
    const { password } = req.body;
    if (password === 'Admin@2026!') { // Change this to your secure password
        req.session.isAdmin = true;
        res.json({ success: true });
    } else {
        res.status(401).json({ error: 'Invalid admin password' });
    }
});

app.get('/api/admin/users', (req, res) => {
    if (!req.session.isAdmin) return res.status(401).json({ error: 'Unauthorized' });
    const users = fs.readJsonSync(USERS_FILE);
    const usersWithoutPassword = users.map(u => ({ ...u, password: undefined }));
    res.json(usersWithoutPassword);
});

app.post('/api/admin/update-balance', async (req, res) => {
    if (!req.session.isAdmin) return res.status(401).json({ error: 'Unauthorized' });
    const { userId, newBalance, transactionId, action } = req.body;
    const users = fs.readJsonSync(USERS_FILE);
    const user = users.find(u => u.id === userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    const oldBalance = user.balance;
    user.balance = parseFloat(newBalance);
    saveUsers(users);
    
    // Update transaction status
    const transactions = fs.readJsonSync(TRANSACTIONS_FILE);
    const transaction = transactions.find(t => t.id === transactionId);
    if (transaction) {
        transaction.status = action === 'approve' ? 'completed' : 'rejected';
        saveTransactions(transactions);
    }
    
    await sendTelegramNotification(`🛠 Admin Action: ${action} for user ${user.fullname}. Balance changed from ${oldBalance} to ${newBalance} CFA.`);
    
    res.json({ success: true });
});

app.get('/api/admin/pending-transactions', (req, res) => {
    if (!req.session.isAdmin) return res.status(401).json({ error: 'Unauthorized' });
    const transactions = fs.readJsonSync(TRANSACTIONS_FILE);
    const pending = transactions.filter(t => t.status === 'pending');
    res.json(pending);
});

// Version click handler (admin access hint)
app.get('/version', (req, res) => {
    res.json({ version: '2.0.0', adminUrl: '/admin' });
});

// Serve frontend
app.get('/dashboard', requireAuth, (req, res) => {
    res.render('dashboard');
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Investment platform running on http://localhost:${PORT}`);
});
