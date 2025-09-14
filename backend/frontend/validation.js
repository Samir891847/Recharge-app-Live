let userId = null;

const BASE_URL = "https://recharge-app-live.onrender.com"; // Your main Render app URL

// --- UI Utility Functions ---
function showLoading() {
    document.getElementById('loading-spinner').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loading-spinner').style.display = 'none';
}

// Function to hide all content sections and show loading
function hideAllContentSections() {
    document.querySelectorAll('.content-section').forEach(section => {
        section.style.display = 'none';
    });
    // Hide main icon grids when a specific section is open
    document.querySelector('.main-features-grid').style.display = 'none';
    document.querySelector('.utility-payments-grid').style.display = 'none';
    document.querySelector('.hero-banner').style.display = 'none';

    // Reset header title to default if not specific to a page
    document.querySelector('.app-title').textContent = 'Recharge'; 
}

// Function to show the main Home/Recharge view
function showRechargeHome() {
    hideAllContentSections();
    document.querySelector('.hero-banner').style.display = 'block';
    document.querySelector('.main-features-grid').style.display = 'grid';
    document.querySelector('.utility-payments-grid').style.display = 'grid';
    document.querySelector('.app-title').textContent = 'Home'; // Set header title
    setActiveNavLink('nav-home');
}

function setActiveNavLink(navId) {
    document.querySelectorAll('.bottom-nav .nav-item').forEach(item => {
        item.classList.remove('active');
    });
    document.getElementById(navId).classList.add('active');
}


async function waitForElements() {
    return new Promise(resolve => {
        const check = () => {
            const rechargeAppUI = document.getElementById('recharge-app-ui');
            const authContainer = document.getElementById('auth-container');
            const navHome = document.getElementById('nav-home'); // Check for nav items too
            if (rechargeAppUI && authContainer && navHome) {
                resolve({ rechargeAppUI, authContainer });
            } else {
                setTimeout(check, 50);
            }
        };
        check();
    });
}

// --- Initial Load and Login State Check ---
document.addEventListener('DOMContentLoaded', async function() {
    try {
        const { rechargeAppUI, authContainer } = await waitForElements();
        checkLoginState(rechargeAppUI, authContainer);
        setupEventListeners(); // Setup all event listeners after DOM is ready
    } catch (e) {
        console.error("DOM elements not found on page load:", e);
    } finally {
        hideLoading();
    }
});

async function checkLoginState(rechargeAppUI, authContainer) {
    userId = localStorage.getItem('userId');
    if (userId) {
        rechargeAppUI.style.display = 'block';
        authContainer.style.display = 'none';
        initApp();
        showRechargeHome(); // Show main home content after login
    } else {
        rechargeAppUI.style.display = 'none';
        authContainer.style.display = 'block';
        document.querySelector('.bottom-nav').style.display = 'none'; // Hide bottom nav on auth page
    }
}

async function initApp() {
    await fetchHistory();
    await updateWalletBalance();
    await updateProfileInfo(); // Fetch and display user profile in sidebar
    document.querySelector('.bottom-nav').style.display = 'flex'; // Show bottom nav after init
}

// --- Event Listeners Setup ---
function setupEventListeners() {
    // --- Auth Form ---
    document.getElementById('auth-form').addEventListener('submit', handleAuthSubmit);
    document.getElementById('toggle-signup').addEventListener('click', toggleSignUp);
    document.getElementById('forgot-password-link').addEventListener('click', function(e) {
        e.preventDefault();
        document.getElementById('forgot-password-modal').style.display = 'flex';
    });
    document.getElementById('close-forgot-modal').addEventListener('click', function() {
        document.getElementById('forgot-password-modal').style.display = 'none';
        document.getElementById('forgot-password-form').reset();
    });
    document.getElementById('forgot-password-form').addEventListener('submit', handleForgotPassword);

    // --- Sidebar and Logout ---
    document.getElementById('menuBtn').addEventListener('click', toggleSidebar);
    document.getElementById('closeSidebarBtn').addEventListener('click', toggleSidebar);
    document.getElementById('sidebarOverlay').addEventListener('click', toggleSidebar);
    document.getElementById('logoutBtnSidebar').addEventListener('click', handleLogout);
    
    // --- Bottom Navigation ---
    document.getElementById('nav-home').addEventListener('click', function(e) {
        e.preventDefault();
        showRechargeHome(); // Show default home content
        document.querySelector('.app-title').textContent = 'Home'; // Set header title
    });
    document.getElementById('nav-recharge').addEventListener('click', function(e) {
        e.preventDefault();
        hideAllContentSections();
        document.getElementById('recharge-form-section').style.display = 'block';
        document.querySelector('.app-title').textContent = 'Recharge'; // Set header title
        setActiveNavLink('nav-recharge');
    });
    document.getElementById('nav-more').addEventListener('click', function(e) {
        e.preventDefault();
        hideAllContentSections();
        document.getElementById('profile-page').style.display = 'block'; // Or a 'More' specific page
        document.getElementById('history-section').style.display = 'block'; // Show history in More page
        document.querySelector('.app-title').textContent = 'More'; // Set header title
        setActiveNavLink('nav-more');
    });

    // --- Feature Icons ---
    document.getElementById('mobileRechargeBtn').addEventListener('click', function() {
        hideAllContentSections();
        document.getElementById('recharge-form-section').style.display = 'block';
        document.querySelector('.app-title').textContent = 'Mobile Recharge'; // Specific header title
    });

    document.getElementById('addMoneyBtn').addEventListener('click', function() {
        hideAllContentSections();
        document.getElementById('add-money-section').style.display = 'block';
        document.querySelector('.app-title').textContent = 'Add Money'; // Specific header title
    });
    
    // Profile button in sidebar
    document.getElementById('profileBtnSidebar').addEventListener('click', function(e) {
        e.preventDefault();
        toggleSidebar(); // Close sidebar first
        hideAllContentSections();
        document.getElementById('profile-page').style.display = 'block';
        document.querySelector('.app-title').textContent = 'Profile'; // Specific header title
    });

    // Dummy functionality for other icons
    document.querySelectorAll('.feature-item:not(#mobileRechargeBtn):not(#addMoneyBtn)').forEach(item => {
        item.addEventListener('click', function() {
            alert('Coming Soon!');
        });
    });

    // --- Recharge Form ---
    document.getElementById('operator').addEventListener('change', handleOperatorChange);
    document.getElementById('rechargeForm').addEventListener('submit', handleRechargeSubmit);
    document.getElementById('addMoneyForm').addEventListener('submit', handleAddMoneySubmit);
}


// --- Handlers for various events ---
async function handleAuthSubmit(event) {
    event.preventDefault();
    const mobileNumber = document.getElementById('auth-mobile').value;
    const password = document.getElementById('auth-password').value;
    const isLogin = document.getElementById('auth-button').textContent.toLowerCase() === 'login'; // Use .toLowerCase() for robustness

    if (mobileNumber.length !== 10) {
        alert('Please enter a valid 10-digit mobile number.');
        return;
    }

    let endpoint = isLogin ? `${BASE_URL}/login` : `${BASE_URL}/signup`;
    let bodyData;

    if (isLogin) {
        let userIp = '127.0.0.1';
        try {
            const ipResponse = await fetch('https://api.ipify.org?format=json');
            if(ipResponse.ok) {
                const ipData = await ipResponse.json();
                userIp = ipData.ip;
            }
        } catch (ipError) {
            console.error("IP fetch failed, using default IP.", ipError);
        }
        bodyData = { mobileNumber, password, userIp };
    } else {
        const name = document.getElementById('auth-name').value;
        const email = document.getElementById('auth-email').value;
        const address = document.getElementById('auth-address').value;
        bodyData = { name, email, mobileNumber, address, password };
    }

    showLoading();
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bodyData),
        });
        const data = await response.json();

        if (response.ok) {
            alert(data.message);
            if (isLogin) {
                localStorage.setItem('userId', data.userId);
                const { rechargeAppUI, authContainer } = await waitForElements();
                checkLoginState(rechargeAppUI, authContainer);
            } else {
                // After signup, switch to login form
                document.getElementById('auth-title').textContent = 'Login';
                document.getElementById('auth-button').textContent = 'Login';
                document.getElementById('toggle-signup').textContent = 'Don\'t have an account? Sign up';
                document.getElementById('auth-name').style.display = 'none';
                document.getElementById('auth-email').style.display = 'none';
                document.getElementById('auth-address').style.display = 'none';
                // Reset signup fields but keep mobile for quick login
                document.getElementById('auth-name').value = '';
                document.getElementById('auth-email').value = '';
                document.getElementById('auth-address').value = '';
                document.getElementById('auth-password').value = ''; // Clear password
            }
        } else {
            alert(data.message);
        }
    } catch (error) {
        alert('Connection error. Server running hai kya?');
    } finally {
        hideLoading();
    }
}

function toggleSignUp(e) {
    e.preventDefault();
    const title = document.getElementById('auth-title');
    const button = document.getElementById('auth-button');
    const nameField = document.getElementById('auth-name');
    const emailField = document.getElementById('auth-email');
    const addressField = document.getElementById('auth-address');
    const toggleLink = document.getElementById('toggle-signup');

    if (title.textContent.toLowerCase() === 'login') {
        title.textContent = 'Sign Up';
        button.textContent = 'Sign Up';
        toggleLink.textContent = 'Already have an account? Login';
        nameField.style.display = 'block';
        emailField.style.display = 'block';
        addressField.style.display = 'block';
        nameField.required = true;
        emailField.required = true;
        addressField.required = false; // Address can be optional
    } else {
        title.textContent = 'Login';
        button.textContent = 'Login';
        toggleLink.textContent = 'Don\'t have an account? Sign up';
        nameField.style.display = 'none';
        emailField.style.display = 'none';
        addressField.style.display = 'none';
        nameField.required = false;
        emailField.required = false;
        addressField.required = false;
    }
}

async function handleLogout() {
    localStorage.removeItem('userId');
    const { rechargeAppUI, authContainer } = await waitForElements();
    checkLoginState(rechargeAppUI, authContainer);
    toggleSidebar(); // Close sidebar on logout
}

async function handleForgotPassword(event) {
    event.preventDefault();
    const mobileNumber = document.getElementById('forgot-mobile').value;
    const newPassword = document.getElementById('forgot-new-password').value;
    
    showLoading();
    try {
        const response = await fetch(`${BASE_URL}/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mobileNumber, newPassword }),
        });
        const data = await response.json();
        
        if (response.ok) {
            alert(data.message);
            document.getElementById('forgot-password-modal').style.display = 'none';
            document.getElementById('auth-form').reset();
        } else {
            alert(data.message);
        }
    } catch (error) {
        alert('Connection error. Server running hai kya?');
    } finally {
        hideLoading();
    }
}

async function handleOperatorChange() {
    const operator = this.value;
    if (operator) {
        await fetchPlans(operator);
    } else {
        document.getElementById('plansContainer').innerHTML = '';
    }
}

async function handleRechargeSubmit(event) {
    event.preventDefault();
    const mobileNumber = document.getElementById('mobileNumber').value;
    const operator = document.getElementById('operator').value;
    const amount = document.getElementById('amount').value;
    
    if (!mobileNumber || mobileNumber.length !== 10 || !operator || !amount) {
        alert('Please enter correct details.');
        return;
    }

    showLoading();
    try {
        const response = await fetch(`${BASE_URL}/recharge`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, mobileNumber, operator, amount: Number(amount) }),
        });
        const data = await response.json();
        
        if (response.ok) {
            await fetchHistory();
            await updateWalletBalance();
            alert(data.message);
            document.getElementById('rechargeForm').reset();
        } else {
            alert(data.message);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Could not connect to the server.');
    } finally {
        hideLoading();
    }
}

async function handleAddMoneySubmit(event) {
    event.preventDefault();
    const amount = document.getElementById('addAmount').value;
    if (amount <= 0) {
        alert('Please enter a valid amount.');
        return;
    }
    startPayment();
}


// --- Core Functions (Payment, Plans, History, Wallet, Profile) ---
async function startPayment() {
    const amount = document.getElementById('addAmount').value;
    if (!amount) {
        alert("Please enter amount.");
        return;
    }
    if (!userId) {
        alert("Please login first to add money.");
        return;
    }
    
    showLoading();
    try {
        const userResponse = await fetch(`${BASE_URL}/user/${userId}`); 
        const userData = await userResponse.json();
        if(!userData.success) {
            alert("User details not found!");
            return;
        }
        const { name, email, mobileNumber } = userData.user;

        const orderResponse = await fetch(`${BASE_URL}/createOrder`, { 
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ amount: amount })
        });
        const orderData = await orderResponse.json();
        
        if (orderData.id) {
            const options = {
                key: 'rzp_test_REG7HP4iXJBXHc', 
                amount: orderData.amount,
                currency: "INR",
                name: "Recharge App",
                description: "Wallet Add Money",
                order_id: orderData.id,
                handler: async function (response) {
                    alert("Payment Successful!");
                    
                    const updateResponse = await fetch(`${BASE_URL}/add-balance`, { 
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ userId: userId, amount: Number(amount) })
                    });
                    const updateData = await updateResponse.json();
                    if(updateData.success) {
                        await updateWalletBalance();
                        await fetchHistory();
                        document.getElementById('addMoneyForm').reset();
                        alert("Balance added to wallet!");
                    } else {
                        alert("Error updating balance!");
                    }
                },
                prefill: {
                    name: name,
                    email: email,
                    contact: mobileNumber,
                },
                theme: {
                    color: "#6a1b9a" // Match app theme
                }
            };
            const rzp1 = new Razorpay(options);
            rzp1.open();
        } else {
            alert("Error creating order!");
        }
    } catch (error) {
        console.error("Payment start error:", error);
        alert("Error starting payment!");
    } finally {
        hideLoading();
    }
}

async function fetchPlans(operator) {
    try {
        const plansContainer = document.getElementById('plansContainer');
        plansContainer.innerHTML = '';
        const response = await fetch(`${BASE_URL}/plans/${operator}`); 
        const data = await response.json();

        if (response.ok && data.plans && data.plans.length > 0) {
            data.plans.forEach(plan => {
                const planCard = document.createElement('div');
                planCard.classList.add('plan-card');
                // Removed inline styles, now using style.css classes
                planCard.innerHTML = `
                    <div class="plan-amount">₹${plan.amount}</div>
                    <div class="plan-description">${plan.description}</div>
                `;
                planCard.addEventListener('click', () => {
                    document.getElementById('amount').value = plan.amount;
                });
                plansContainer.appendChild(planCard);
            });
        } else {
            plansContainer.innerHTML = '<p style="text-align:center; color:#6a1b9a;">No plans available for this operator.</p>';
        }
    } catch (error) {
        console.error('Error fetching plans:', error);
        document.getElementById('plansContainer').innerHTML = '<p style="text-align:center; color:red;">Could not load plans.</p>';
    }
}

async function fetchHistory() {
    try {
        const historyList = document.getElementById('historyList');
        historyList.innerHTML = '';
        const response = await fetch(`${BASE_URL}/history/${userId}`); 
        const data = await response.json();
        
        if (response.ok) {
            if (data.transactions.length === 0) {
                historyList.innerHTML = '<li class="history-item">No history available.</li>';
            } else {
                data.transactions.forEach(item => {
                    const newHistoryItem = document.createElement('li');
                    newHistoryItem.classList.add('history-item');
                    
                    const date = new Date(item.date).toLocaleDateString();
                    const time = new Date(item.date).toLocaleTimeString();

                    let description = '';
                    let amountDisplay = '';
                    let amountColor = '';

                    if (item.type === 'recharge') {
                        description = `Recharge for ${item.mobileNumber} (${item.operator})`;
                        amountDisplay = `- ₹${Math.abs(item.amount)}`;
                        amountColor = '#dc3545'; // Red for negative
                    } else if (item.type === 'add_money') {
                        description = `Balance added`;
                        amountDisplay = `+ ₹${item.amount}`;
                        amountColor = '#28a745'; // Green for positive
                    }
                    
                    newHistoryItem.innerHTML = `
                        <div class="history-details">
                            <span class="history-main">${description}</span>
                            <span class="history-sub">${date} ${time}</span>
                        </div>
                        <span class="history-amount" style="color: ${amountColor};">${amountDisplay}</span>
                    `;
                    historyList.appendChild(newHistoryItem);
                });
            }
        } else {
            console.error('Failed to fetch history:', data.message);
            historyList.innerHTML = '<li class="history-item">Could not load history.</li>';
        }
    } catch (error) {
        console.error('Network Error:', error);
        historyList.innerHTML = '<li class="history-item">Network error, could not load history.</li>';
    }
}

async function updateWalletBalance() {
    try {
        const response = await fetch(`${BASE_URL}/wallet/${userId}`); 
        const data = await response.json();

        if (response.ok) {
            document.querySelector('.wallet-amount').textContent = `₹ ${data.walletBalance.toFixed(2)}`;
        } else {
            console.error('Failed to fetch wallet balance:', data.message);
            document.querySelector('.wallet-amount').textContent = `₹ Error`;
        }
    } catch (error) {
        console.error('Network Error:', error);
        document.querySelector('.wallet-amount').textContent = `₹ Error`;
    }
}

async function updateProfileInfo() {
    if (!userId) return;
    try {
        const response = await fetch(`${BASE_URL}/user/${userId}`);
        const data = await response.json();
        if (response.ok && data.user) {
            const user = data.user;
            document.getElementById('profile-name').textContent = user.name || 'N/A';
            document.getElementById('profile-mobile').textContent = user.mobileNumber || 'N/A';
            document.getElementById('profile-email').textContent = user.email || 'N/A';
            document.getElementById('profile-address').textContent = user.address || 'N/A';
            document.getElementById('profile-last-login').textContent = user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'N/A';

            // Update sidebar info
            document.getElementById('sidebar-username').textContent = user.name || 'Guest User';
            document.getElementById('sidebar-usermobile').textContent = user.mobileNumber || '';
        } else {
            console.error('Failed to fetch profile info:', data.message);
        }
    } catch (error) {
        console.error('Network Error fetching profile:', error);
    }
}

// --- Sidebar Toggle Logic ---
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
        overlay.classList.remove('visible');
    } else {
        sidebar.classList.add('open');
        overlay.classList.add('visible');
    }
}