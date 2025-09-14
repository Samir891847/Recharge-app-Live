// Ensure BASE_URL is defined globally in index.html or accessible via window
// For example, in index.html: <script>window.BASE_URL = 'http://localhost:3000';</script>

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const rechargeForm = document.getElementById('rechargeForm');
    const createOrderBtn = document.getElementById('createOrderBtn');
    const addBalanceForm = document.getElementById('addBalanceForm');
    const showSignupFormBtn = document.getElementById('showSignupForm');
    const showLoginFormBtn = document.getElementById('showLoginForm');
    const showRechargeFormBtn = document.getElementById('showRechargeForm');
    const showAddMoneyFormBtn = document.getElementById('showAddMoneyForm');
    const showProfileBtn = document.getElementById('showProfileBtn');
    const showHistoryBtn = document.getElementById('showHistoryBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const forgotPasswordBtn = document.getElementById('forgotPasswordBtn');
    const otpForm = document.getElementById('otpForm');
    const resetPasswordForm = document.getElementById('resetPasswordForm');
    const operatorSelect = document.getElementById('operatorSelect');
    const planDetails = document.getElementById('planDetails');
    const selectedAmountInput = document.getElementById('selectedAmount');
    const currentUserName = document.getElementById('currentUserName');
    const currentUserRole = document.getElementById('currentUserRole'); // New element
    const userWalletBalance = document.getElementById('userWalletBalance'); // New element

    // New elements for multi-level system
    const showManageDownlineBtn = document.getElementById('showManageDownlineBtn');
    const manageDownlineSection = document.getElementById('manageDownlineSection');
    const createDownlineForm = document.getElementById('createDownlineForm');
    const downlineList = document.getElementById('downlineList');
    const downlineRoleSelect = document.getElementById('downlineRole'); // New element
    const downlineCommissionSlabSelect = document.getElementById('downlineCommissionSlab'); // New element

    const showBalanceTransferBtn = document.getElementById('showBalanceTransferBtn');
    const balanceTransferSection = document.getElementById('balanceTransferSection');
    const balanceTransferForm = document.getElementById('balanceTransferForm');

    const showCommissionReportBtn = document.getElementById('showCommissionReportBtn');
    const commissionReportSection = document.getElementById('commissionReportSection');
    const commissionReportList = document.getElementById('commissionReportList');


    let currentUserId = localStorage.getItem('userId');
    let currentUserRoleData = localStorage.getItem('userRole'); // Store user role
    let currentUserNameData = localStorage.getItem('userName');


    // --- Helper Functions ---
    function showSection(sectionId) {
        document.querySelectorAll('.app-section').forEach(section => {
            section.classList.add('hidden');
        });
        const section = document.getElementById(sectionId);
        if (section) {
            section.classList.remove('hidden');
        } else {
            console.error(`Section with ID ${sectionId} not found.`);
        }
    }

    function updateNavAndUI() {
        currentUserId = localStorage.getItem('userId');
        currentUserRoleData = localStorage.getItem('userRole');
        currentUserNameData = localStorage.getItem('userName');

        const loggedOutNav = document.getElementById('loggedOutNav');
        const loggedInNav = document.getElementById('loggedInNav');
        const roleBasedNav = document.getElementById('roleBasedNav'); // For downline, transfer etc.

        if (currentUserId) {
            loggedOutNav.classList.add('hidden');
            loggedInNav.classList.remove('hidden');
            currentUserName.textContent = currentUserNameData ? `Hi, ${currentUserNameData}` : 'Hi, User';
            currentUserRole.textContent = currentUserRoleData ? ` (${currentUserRoleData})` : ''; // Display role

            // Show/hide role-specific buttons
            roleBasedNav.classList.remove('hidden');
            document.querySelectorAll('.role-specific-btn').forEach(btn => btn.classList.add('hidden'));

            if (currentUserRoleData === 'master' || currentUserRoleData === 'distributor') {
                showManageDownlineBtn.classList.remove('hidden');
                showBalanceTransferBtn.classList.remove('hidden');
            }
            // Retailers can also see commission reports
            if (currentUserRoleData === 'master' || currentUserRoleData === 'distributor' || currentUserRoleData === 'retailer') {
                showCommissionReportBtn.classList.remove('hidden');
            }

            fetchWalletBalance(currentUserId);
        } else {
            loggedOutNav.classList.remove('hidden');
            loggedInNav.classList.add('hidden');
            roleBasedNav.classList.add('hidden');
            showSection('loginSection');
        }
    }

    // Function to fetch and display wallet balance
    async function fetchWalletBalance(userId) {
        try {
            const response = await fetch(`${window.BASE_URL}/wallet/${userId}`);
            const data = await response.json();
            if (data.success) {
                userWalletBalance.textContent = `Balance: ₹${data.walletBalance.toFixed(2)}`;
            } else {
                console.error('Failed to fetch wallet balance:', data.message);
                userWalletBalance.textContent = `Balance: N/A`;
            }
        } catch (error) {
            console.error('Error fetching wallet balance:', error);
            userWalletBalance.textContent = `Balance: Error`;
        }
    }

    function showMessage(message, isSuccess = true) {
        const messageDiv = document.getElementById('message');
        messageDiv.textContent = message;
        messageDiv.className = isSuccess ? 'success-message' : 'error-message';
        messageDiv.classList.remove('hidden');
        setTimeout(() => {
            messageDiv.classList.add('hidden');
        }, 5000);
    }

    // --- Core Functionality ---

    // Login
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const mobileNumber = document.getElementById('loginMobile').value;
            const password = document.getElementById('loginPassword').value;
            const userIp = await fetch('https://api.ipify.org?format=json').then(res => res.json()).then(data => data.ip);

            try {
                const response = await fetch(`${window.BASE_URL}/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ mobileNumber, password, userIp })
                });
                const data = await response.json();
                if (data.success) {
                    localStorage.setItem('userId', data.userId);
                    localStorage.setItem('userName', data.name);
                    localStorage.setItem('userRole', data.role); // Store user role
                    showMessage(data.message, true);
                    updateNavAndUI();
                    showSection('dashboardSection');
                } else {
                    showMessage(data.message, false);
                }
            } catch (err) {
                console.error('Login error:', err);
                showMessage('Login mein error hua!', false);
            }
        });
    }

    // Signup
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('signupName').value;
            const email = document.getElementById('signupEmail').value;
            const mobileNumber = document.getElementById('signupMobile').value;
            const address = document.getElementById('signupAddress').value;
            const password = document.getElementById('signupPassword').value;

            try {
                const response = await fetch(`${window.BASE_URL}/signup`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, mobileNumber, address, password })
                });
                const data = await response.json();
                if (data.success) {
                    showMessage(data.message, true);
                    signupForm.reset();
                    showSection('loginSection');
                } else {
                    showMessage(data.message, false);
                }
            } catch (err) {
                console.error('Signup error:', err);
                showMessage('Signup mein error hua!', false);
            }
        });
    }

    // Logout
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('userId');
            localStorage.removeItem('userName');
            localStorage.removeItem('userRole');
            showMessage('Aap successfully logout ho gaye.', true);
            updateNavAndUI();
            showSection('loginSection');
        });
    }

    // Recharge
    if (rechargeForm) {
        rechargeForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const mobileNumber = document.getElementById('rechargeMobile').value;
            const operator = operatorSelect.value;
            const amount = parseFloat(selectedAmountInput.value);

            if (!currentUserId) {
                showMessage('Kripya recharge karne se pehle login karein.', false);
                return;
            }
            if (isNaN(amount) || amount <= 0) {
                showMessage('Kripya valid amount chunein.', false);
                return;
            }

            try {
                const response = await fetch(`${window.BASE_URL}/recharge`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: currentUserId, mobileNumber, operator, amount })
                });
                const data = await response.json();
                if (data.success) {
                    showMessage(data.message, true);
                    rechargeForm.reset();
                    planDetails.innerHTML = '';
                    fetchWalletBalance(currentUserId);
                    showSection('dashboardSection');
                } else {
                    showMessage(data.message, false);
                }
            } catch (err) {
                console.error('Recharge error:', err);
                showMessage('Recharge mein error hua!', false);
            }
        });
    }

    // Fetch Plans (updated to show commission if available)
    if (operatorSelect) {
        operatorSelect.addEventListener('change', async () => {
            const operator = operatorSelect.value;
            if (operator) {
                try {
                    const response = await fetch(`${window.BASE_URL}/plans/${operator}`);
                    const data = await response.json();
                    planDetails.innerHTML = ''; // Clear previous plans
                    if (data.success && data.plans.length > 0) {
                        data.plans.forEach(plan => {
                            const planDiv = document.createElement('div');
                            planDiv.className = 'plan-card';
                            planDiv.innerHTML = `
                                <h4>₹${plan.amount}</h4>
                                <p>${plan.description}</p>
                                ${plan.commissionPercentage ? `<p class="commission-info">You earn: ${plan.commissionPercentage}%</p>` : ''}
                            `;
                            planDiv.addEventListener('click', () => {
                                selectedAmountInput.value = plan.amount;
                                document.querySelectorAll('.plan-card').forEach(card => card.classList.remove('selected-plan'));
                                planDiv.classList.add('selected-plan');
                            });
                            planDetails.appendChild(planDiv);
                        });
                    } else {
                        planDetails.innerHTML = '<p>Koi plan available nahi hai.</p>';
                    }
                } catch (error) {
                    console.error('Error fetching plans:', error);
                    planDetails.innerHTML = '<p>Plans fetch karte samay error hua.</p>';
                }
            } else {
                planDetails.innerHTML = '';
            }
        });
    }

    // Add Balance (Razorpay integration simplified for frontend)
    if (addBalanceForm) {
        addBalanceForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const amount = parseFloat(document.getElementById('addMoneyAmount').value);

            if (!currentUserId) {
                showMessage('Kripya balance add karne se pehle login karein.', false);
                return;
            }
            if (isNaN(amount) || amount <= 0) {
                showMessage('Kripya valid amount daalein.', false);
                return;
            }

            try {
                // First, create an order on the backend
                const orderResponse = await fetch(`${window.BASE_URL}/createOrder`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ amount })
                });
                const orderData = await orderResponse.json();

                if (orderData.id) {
                    const options = {
                        key: "rzp_test_zFqF277KxP24jE", // Replace with your actual Razorpay Key ID
                        amount: orderData.amount,
                        currency: orderData.currency,
                        name: "Recharge App",
                        description: "Wallet Topup",
                        order_id: orderData.id,
                        handler: async function (response) {
                            // On successful payment, update wallet balance via backend
                            const addBalanceResponse = await fetch(`${window.BASE_URL}/add-balance`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ userId: currentUserId, amount: amount, razorpayPaymentId: response.razorpay_payment_id, razorpayOrderId: response.razorpay_order_id, razorpaySignature: response.razorpay_signature })
                            });
                            const addBalanceData = await addBalanceResponse.json();
                            if (addBalanceData.success) {
                                showMessage(addBalanceData.message, true);
                                addBalanceForm.reset();
                                fetchWalletBalance(currentUserId);
                                showSection('dashboardSection');
                            } else {
                                showMessage(addBalanceData.message, false);
                            }
                        },
                        prefill: {
                            name: currentUserNameData || "User",
                            email: "", // You might want to fetch user's email from profile
                            contact: "" // You might want to fetch user's mobile number from profile
                        },
                        notes: {
                            address: "Razorpay Corporate Office"
                        },
                        theme: {
                            color: "#3399cc"
                        }
                    };
                    const rzp = new Razorpay(options);
                    rzp.on('razorpay_payment_failed', function (response) {
                        showMessage(`Payment Failed: ${response.error.description}`, false);
                    });
                    rzp.open();
                } else {
                    showMessage('Razorpay order banane mein error hua.', false);
                }
            } catch (err) {
                console.error('Add balance error:', err);
                showMessage('Balance add karne mein error hua!', false);
            }
        });
    }

    // Fetch Profile
    function fetchProfile(userId) {
        if (!userId) return;
        fetch(`${window.BASE_URL}/profile/${userId}`)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    document.getElementById('profileName').textContent = data.user.name;
                    document.getElementById('profileEmail').textContent = data.user.email || 'N/A';
                    document.getElementById('profileMobile').textContent = data.user.mobileNumber;
                    document.getElementById('profileAddress').textContent = data.user.address || 'N/A';
                    document.getElementById('profileWalletBalance').textContent = `₹${data.user.walletBalance.toFixed(2)}`;
                    document.getElementById('profileLastLogin').textContent = data.user.lastLoginLocation;
                    document.getElementById('profileRole').textContent = data.user.role; // New
                    document.getElementById('profileStatus').textContent = data.user.status; // New
                    document.getElementById('profileCommissionSlab').textContent = data.user.commissionSlabName || 'Not Assigned'; // New
                    // Fetch and display referredBy name if available
                    if (data.user.referredBy) {
                        fetch(`${window.BASE_URL}/user/${data.user.referredBy}`)
                            .then(res => res.json())
                            .then(parentData => {
                                if (parentData.success) {
                                    document.getElementById('profileReferredBy').textContent = `${parentData.user.name} (${parentData.user.mobileNumber})`;
                                } else {
                                    document.getElementById('profileReferredBy').textContent = 'Unknown';
                                }
                            }).catch(() => {
                                document.getElementById('profileReferredBy').textContent = 'Error fetching parent';
                            });
                    } else {
                        document.getElementById('profileReferredBy').textContent = 'N/A';
                    }
                } else {
                    showMessage('Profile details fetch karne mein error hua.', false);
                }
            })
            .catch(err => {
                console.error('Profile fetch error:', err);
                showMessage('Profile details fetch karte samay error hua.', false);
            });
    }

    // Fetch History (updated to handle new transaction types)
    function fetchHistory(userId) {
        if (!userId) return;
        fetch(`${window.BASE_URL}/history/${userId}`)
            .then(response => response.json())
            .then(data => {
                const historyList = document.getElementById('historyList');
                historyList.innerHTML = '';
                if (data.success && data.transactions.length > 0) {
                    data.transactions.forEach(transaction => {
                        const li = document.createElement('li');
                        let description = '';
                        let amountClass = ''; // For styling positive/negative amounts

                        switch (transaction.type) {
                            case 'recharge':
                                description = `Recharge of ₹${transaction.rechargeAmount} for ${transaction.mobileNumber} (${transaction.operator})`;
                                amountClass = 'debit';
                                break;
                            case 'add_money':
                                description = `Wallet Topup: ₹${transaction.amount}`;
                                amountClass = 'credit';
                                break;
                            case 'commission_credit':
                                description = `Commission earned: ₹${transaction.amount.toFixed(2)} (${transaction.commissionPercentage}%) for ${transaction.rechargeUser.name || transaction.rechargeUser.mobileNumber}'s recharge`;
                                amountClass = 'credit';
                                break;
                            case 'balance_transfer_out':
                                description = `Balance transferred: ₹${Math.abs(transaction.amount).toFixed(2)} to ${transaction.receiverId.name || transaction.receiverId.mobileNumber}`;
                                amountClass = 'debit';
                                break;
                            case 'balance_transfer_in':
                                description = `Balance received: ₹${transaction.amount.toFixed(2)} from ${transaction.senderId.name || transaction.senderId.mobileNumber}`;
                                amountClass = 'credit';
                                break;
                            case 'admin_credit':
                                description = `Admin Credit: ₹${transaction.amount.toFixed(2)}`;
                                amountClass = 'credit';
                                break;
                            case 'admin_debit':
                                description = `Admin Debit: ₹${Math.abs(transaction.amount).toFixed(2)}`;
                                amountClass = 'debit';
                                break;
                            default:
                                description = `Transaction: ₹${transaction.amount} (${transaction.type})`;
                                amountClass = (transaction.amount >= 0) ? 'credit' : 'debit';
                        }
                        li.innerHTML = `
                            <span>${new Date(transaction.createdAt).toLocaleString()}</span>
                            <span>${description}</span>
                            <span class="${amountClass}">₹${transaction.amount.toFixed(2)}</span>
                            <span class="${transaction.status === 'success' ? 'status-success' : 'status-failed'}">${transaction.status}</span>
                        `;
                        historyList.appendChild(li);
                    });
                } else {
                    historyList.innerHTML = '<p>Koi transaction history nahi mili.</p>';
                }
            })
            .catch(err => {
                console.error('History fetch error:', err);
                showMessage('History fetch karte samay error hua.', false);
            });
    }

    // --- OTP & Reset Password ---
    if (forgotPasswordBtn) {
        forgotPasswordBtn.addEventListener('click', () => {
            showSection('otpSection');
        });
    }

    if (otpForm) {
        otpForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const mobileNumber = document.getElementById('otpMobile').value;
            try {
                const response = await fetch(`${window.BASE_URL}/send-otp`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ mobileNumber })
                });
                const data = await response.json();
                if (data.success) {
                    showMessage(data.message, true);
                    showSection('resetPasswordSection');
                } else {
                    showMessage(data.message, false);
                }
            } catch (err) {
                console.error('OTP send error:', err);
                showMessage('OTP bhejte samay error hua!', false);
            }
        });
    }

    if (resetPasswordForm) {
        resetPasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const mobileNumber = document.getElementById('resetMobile').value;
            const otp = document.getElementById('resetOtp').value;
            const newPassword = document.getElementById('newPassword').value;

            try {
                const response = await fetch(`${window.BASE_URL}/verify-otp-and-reset`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ mobileNumber, otp, newPassword })
                });
                const data = await response.json();
                if (data.success) {
                    showMessage(data.message, true);
                    resetPasswordForm.reset();
                    otpForm.reset();
                    showSection('loginSection');
                } else {
                    showMessage(data.message, false);
                }
            } catch (err) {
                console.error('Password reset error:', err);
                showMessage('Password reset mein error hua!', false);
            }
        });
    }

    // --- New Multi-Level Functions ---

    // Fetch Commission Slabs for Downline Creation
    async function fetchCommissionSlabs() {
        try {
            const response = await fetch(`${window.BASE_URL}/commissionslabs`); // Assuming you'll create this API
            const data = await response.json();
            if (data.success) {
                downlineCommissionSlabSelect.innerHTML = '<option value="">Select Commission Slab</option>';
                data.slabs.forEach(slab => {
                    const option = document.createElement('option');
                    option.value = slab._id;
                    option.textContent = slab.name;
                    downlineCommissionSlabSelect.appendChild(option);
                });
            } else {
                console.error('Failed to fetch commission slabs:', data.message);
            }
        } catch (error) {
            console.error('Error fetching commission slabs:', error);
        }
    }

    // Create Downline User
    if (createDownlineForm) {
        createDownlineForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('downlineName').value;
            const mobileNumber = document.getElementById('downlineMobile').value;
            const password = document.getElementById('downlinePassword').value;
            const role = downlineRoleSelect.value;
            const commissionSlabId = downlineCommissionSlabSelect.value;

            if (!currentUserId) {
                showMessage('Kripya login karein.', false);
                return;
            }
            if (!name || !mobileNumber || !password || !role || !commissionSlabId) {
                showMessage('Kripya sabhi jaankari bharein.', false);
                return;
            }

            try {
                const response = await fetch(`${window.BASE_URL}/user/createDownline`, { // Assuming this API will be created
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name, mobileNumber, password, role,
                        commissionSlab: commissionSlabId,
                        referredBy: currentUserId // The current logged-in user is the referrer
                    })
                });
                const data = await response.json();
                if (data.success) {
                    showMessage(data.message, true);
                    createDownlineForm.reset();
                    fetchDownlineUsers(currentUserId);
                } else {
                    showMessage(data.message, false);
                }
            } catch (err) {
                console.error('Create downline error:', err);
                showMessage('Downline user banane mein error hua!', false);
            }
        });
    }

    // Fetch Downline Users
    async function fetchDownlineUsers(userId) {
        if (!userId) return;
        try {
            const response = await fetch(`${window.BASE_URL}/user/downline/${userId}`); // Assuming this API will be created
            const data = await response.json();
            downlineList.innerHTML = '';
            if (data.success && data.downline.length > 0) {
                data.downline.forEach(downlineUser => {
                    const li = document.createElement('li');
                    li.innerHTML = `
                        <span>${downlineUser.name} (${downlineUser.mobileNumber})</span>
                        <span>Role: ${downlineUser.role}</span>
                        <span>Status: ${downlineUser.status}</span>
                        <span>Wallet: ₹${downlineUser.walletBalance.toFixed(2)}</span>
                        ${downlineUser.commissionSlab ? `<span>Slab: ${downlineUser.commissionSlab.name}</span>` : ''}
                    `;
                    downlineList.appendChild(li);
                });
            } else {
                downlineList.innerHTML = '<p>Koi downline user nahi mila.</p>';
            }
        } catch (error) {
            console.error('Error fetching downline users:', error);
            downlineList.innerHTML = '<p>Downline users fetch karte samay error hua.</p>';
        }
    }

    // Balance Transfer
    if (balanceTransferForm) {
        balanceTransferForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const receiverMobile = document.getElementById('transferMobile').value;
            const amount = parseFloat(document.getElementById('transferAmount').value);

            if (!currentUserId) {
                showMessage('Kripya login karein.', false);
                return;
            }
            if (!receiverMobile || isNaN(amount) || amount <= 0) {
                showMessage('Kripya sabhi jaankari sahi daalein.', false);
                return;
            }

            try {
                const response = await fetch(`${window.BASE_URL}/wallet/transfer`, { // Assuming this API will be created
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ senderId: currentUserId, receiverMobile, amount })
                });
                const data = await response.json();
                if (data.success) {
                    showMessage(data.message, true);
                    balanceTransferForm.reset();
                    fetchWalletBalance(currentUserId);
                    showSection('dashboardSection');
                } else {
                    showMessage(data.message, false);
                }
            } catch (err) {
                console.error('Balance transfer error:', err);
                showMessage('Balance transfer mein error hua!', false);
            }
        });
    }

    // Fetch Commission Report (assuming history API can filter by type 'commission_credit')
    async function fetchCommissionReport(userId) {
        if (!userId) return;
        try {
            // Reusing history API, assuming it can filter or we'll filter on frontend
            const response = await fetch(`${window.BASE_URL}/history/${userId}`);
            const data = await response.json();
            commissionReportList.innerHTML = '';
            if (data.success && data.transactions.length > 0) {
                const commissionTransactions = data.transactions.filter(t => t.type === 'commission_credit');
                if (commissionTransactions.length > 0) {
                    commissionTransactions.forEach(transaction => {
                        const li = document.createElement('li');
                        li.innerHTML = `
                            <span>${new Date(transaction.createdAt).toLocaleString()}</span>
                            <span>Commission: ₹${transaction.amount.toFixed(2)} (${transaction.commissionPercentage}%)</span>
                            <span>For recharge by: ${transaction.rechargeUser ? (transaction.rechargeUser.name || transaction.rechargeUser.mobileNumber) : 'Self'}</span>
                        `;
                        commissionReportList.appendChild(li);
                    });
                } else {
                    commissionReportList.innerHTML = '<p>Koi commission history nahi mili.</p>';
                }
            } else {
                commissionReportList.innerHTML = '<p>Koi commission history nahi mili.</p>';
            }
        } catch (error) {
            console.error('Error fetching commission report:', error);
            commissionReportList.innerHTML = '<p>Commission report fetch karte samay error hua.</p>';
        }
    }


    // --- Event Listeners for Navigation ---
    if (showSignupFormBtn) showSignupFormBtn.addEventListener('click', () => showSection('signupSection'));
    if (showLoginFormBtn) showLoginFormBtn.addEventListener('click', () => showSection('loginSection'));
    if (showRechargeFormBtn) showRechargeFormBtn.addEventListener('click', () => showSection('rechargeSection'));
    if (showAddMoneyFormBtn) showAddMoneyFormBtn.addEventListener('click', () => showSection('addMoneySection'));
    if (showProfileBtn) {
        showProfileBtn.addEventListener('click', () => {
            if (currentUserId) {
                fetchProfile(currentUserId);
                showSection('profileSection');
            } else {
                showMessage('Kripya login karein.', false);
            }
        });
    }
    if (showHistoryBtn) {
        showHistoryBtn.addEventListener('click', () => {
            if (currentUserId) {
                fetchHistory(currentUserId);
                showSection('historySection');
            } else {
                showMessage('Kripya login karein.', false);
            }
        });
    }

    // New Event Listeners for Multi-Level System
    if (showManageDownlineBtn) {
        showManageDownlineBtn.addEventListener('click', () => {
            if (currentUserId) {
                fetchDownlineUsers(currentUserId);
                fetchCommissionSlabs(); // Load slabs for new downline creation
                showSection('manageDownlineSection');
            } else {
                showMessage('Kripya login karein.', false);
            }
        });
    }
    if (showBalanceTransferBtn) {
        showBalanceTransferBtn.addEventListener('click', () => {
            if (currentUserId) {
                showSection('balanceTransferSection');
            } else {
                showMessage('Kripya login karein.', false);
            }
        });
    }
    if (showCommissionReportBtn) {
        showCommissionReportBtn.addEventListener('click', () => {
            if (currentUserId) {
                fetchCommissionReport(currentUserId);
                showSection('commissionReportSection');
            } else {
                showMessage('Kripya login karein.', false);
            }
        });
    }

    // Initial UI update on page load
    updateNavAndUI();
});