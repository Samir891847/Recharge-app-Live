let userId = null;

// --- IMPORTANT: Replace this with your actual Render backend URL ---
// Example: const BASE_URL = "https://your-recharge-app-backend.onrender.com";
const BASE_URL = "https://recharge-app-live.onrender.com"; // Your main Render app URL

function showLoading() {
    document.getElementById('loading-spinner').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loading-spinner').style.display = 'none';
}

async function waitForElements() {
    return new Promise(resolve => {
        const check = () => {
            const rechargeAppUI = document.getElementById('recharge-app-ui');
            const authContainer = document.getElementById('auth-container');
            if (rechargeAppUI && authContainer) {
                resolve({ rechargeAppUI, authContainer });
            } else {
                setTimeout(check, 50);
            }
        };
        check();
    });
}

document.addEventListener('DOMContentLoaded', async function() {
    try {
        const { rechargeAppUI, authContainer } = await waitForElements();
        checkLoginState(rechargeAppUI, authContainer);
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
    } else {
        rechargeAppUI.style.display = 'none';
        authContainer.style.display = 'block';
    }
}

async function initApp() {
    await fetchHistory();
    await updateWalletBalance();

    document.getElementById('operator').addEventListener('change', async function() {
        const operator = this.value;
        if (operator) {
            await fetchPlans(operator);
        } else {
            document.getElementById('plansContainer').innerHTML = '';
        }
    });
}

document.getElementById('auth-form').addEventListener('submit', async function(event) {
    event.preventDefault();
    const mobileNumber = document.getElementById('auth-mobile').value;
    const password = document.getElementById('auth-password').value;
    const isLogin = document.getElementById('auth-button').textContent === 'Login';

    if (mobileNumber.length !== 10) {
        alert('Kripya sahi 10-ankon ka mobile number daalein.');
        return;
    }

    let endpoint = isLogin ? `${BASE_URL}/login` : `${BASE_URL}/signup`; // BASE_URL added
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
                document.getElementById('auth-title').textContent = 'Login';
                document.getElementById('auth-button').textContent = 'Login';
                document.getElementById('toggle-signup').textContent = 'Already have an account? Login';
                document.getElementById('auth-name').style.display = 'none';
                document.getElementById('auth-email').style.display = 'none';
                document.getElementById('auth-address').style.display = 'none';
            }
        } else {
            alert(data.message);
        }
    } catch (error) {
        alert('Connection error. Server running hai kya?');
    } finally {
        hideLoading();
    }
});

document.getElementById('toggle-signup').addEventListener('click', function(e) {
    e.preventDefault();
    const title = document.getElementById('auth-title');
    const button = document.getElementById('auth-button');
    const nameField = document.getElementById('auth-name');
    const emailField = document.getElementById('auth-email');
    const addressField = document.getElementById('auth-address');

    if (title.textContent === 'Login') {
        title.textContent = 'Sign Up';
        button.textContent = 'Sign Up';
        this.textContent = 'Already have an account? Login';
        nameField.style.display = 'block';
        emailField.style.display = 'block';
        addressField.style.display = 'block';
        nameField.required = true;
        emailField.required = true;
        addressField.required = false;
    } else {
        title.textContent = 'Login';
        button.textContent = 'Login';
        this.textContent = 'Don\'t have an account? Sign up';
        nameField.style.display = 'none';
        emailField.style.display = 'none';
        addressField.style.display = 'none';
        nameField.required = false;
        emailField.required = false;
        addressField.required = false;
    }
});

document.getElementById('logoutBtn').addEventListener('click', async function() {
    localStorage.removeItem('userId');
    const { rechargeAppUI, authContainer } = await waitForElements();
    checkLoginState(rechargeAppUI, authContainer);
});

document.getElementById('forgot-password-link').addEventListener('click', function(e) {
    e.preventDefault();
    document.getElementById('forgot-password-modal').style.display = 'flex';
});

document.getElementById('close-forgot-modal').addEventListener('click', function() {
    document.getElementById('forgot-password-modal').style.display = 'none';
    document.getElementById('forgot-password-form').reset();
});

document.getElementById('forgot-password-form').addEventListener('submit', async function(event) {
    event.preventDefault();
    const mobileNumber = document.getElementById('forgot-mobile').value;
    const newPassword = document.getElementById('forgot-new-password').value;
    
    showLoading();
    try {
        const response = await fetch(`${BASE_URL}/forgot-password`, { // BASE_URL added
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
});

document.getElementById('rechargeForm').addEventListener('submit', async function(event) {
    event.preventDefault();
    const mobileNumber = document.getElementById('mobileNumber').value;
    const operator = document.getElementById('operator').value;
    const amount = document.getElementById('amount').value;
    
    if (!mobileNumber || mobileNumber.length !== 10 || !operator || !amount) {
        alert('Kripya sahi jaankari daalein.');
        return;
    }

    showLoading();
    try {
        const response = await fetch(`${BASE_URL}/recharge`, { // BASE_URL added
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
});

document.getElementById('addMoneyForm').addEventListener('submit', async function(event) {
    event.preventDefault();
    const amount = document.getElementById('addAmount').value;
    if (amount <= 0) {
        alert('Kripya ek valid amount daalein.');
        return;
    }
    startPayment();
});

async function startPayment() {
    const amount = document.getElementById('addAmount').value;
    if (!amount) {
        alert("Kripya amount daalein.");
        return;
    }
    if (!userId) {
        alert("Paisa dalne ke liye kripya pehle login karein.");
        return;
    }
    
    showLoading();
    try {
        // BASE_URL added here
        const userResponse = await fetch(`${BASE_URL}/user/${userId}`); 
        const userData = await userResponse.json();
        if(!userData.success) {
            alert("User details nahi mil payi!");
            return;
        }
        const { name, email, mobileNumber } = userData.user;

        // BASE_URL added here
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
                key: 'rzp_test_REG7HP4iXJBXHc', // This key should ideally also come from an environment variable for security
                amount: orderData.amount,
                currency: "INR",
                name: "Recharge App",
                description: "Wallet Add Money",
                order_id: orderData.id,
                handler: async function (response) {
                    alert("Payment Successful!");
                    
                    // BASE_URL added here
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
                        alert("Wallet mein balance jod diya gaya hai!");
                    } else {
                        alert("Balance update karne mein error hua!");
                    }
                },
                prefill: {
                    name: name,
                    email: email,
                    contact: mobileNumber,
                },
                theme: {
                    color: "#3399cc"
                }
            };
            const rzp1 = new Razorpay(options);
            rzp1.open();
        } else {
            alert("Order banane mein error hua!");
        }
    } catch (error) {
        console.error("Payment start error:", error);
        alert("Payment start karne mein error hua!");
    } finally {
        hideLoading();
    }
}

async function fetchPlans(operator) {
    try {
        const plansContainer = document.getElementById('plansContainer');
        plansContainer.innerHTML = '';
        // BASE_URL added here
        const response = await fetch(`${BASE_URL}/plans/${operator}`); 
        const data = await response.json();

        if (response.ok && data.plans && data.plans.length > 0) {
            data.plans.forEach(plan => {
                const planCard = document.createElement('div');
                planCard.classList.add('plan-card');
                planCard.style.cssText = 'border: 1px solid #ddd; padding: 10px; border-radius: 8px; margin-top: 10px; cursor: pointer; background-color: #f9f9f9;';
                planCard.innerHTML = `
                    <div class="plan-amount" style="font-weight: bold;">₹${plan.amount}</div>
                    <div class="plan-description" style="font-size: 14px;">${plan.description}</div>
                `;
                planCard.addEventListener('click', () => {
                    document.getElementById('amount').value = plan.amount;
                });
                plansContainer.appendChild(planCard);
            });
        } else {
            console.error('Failed to fetch plans:', data.message);
        }
    } catch (error) {
        console.error('Error fetching plans:', error);
        document.getElementById('plansContainer').innerHTML = '<p style="text-align:center; color:red;">Plans load nahi ho paye.</p>';
    }
}

async function fetchHistory() {
    try {
        const historyList = document.getElementById('historyList');
        historyList.innerHTML = '';
        // BASE_URL added here
        const response = await fetch(`${BASE_URL}/history/${userId}`); 
        const data = await response.json();
        
        if (response.ok) {
            if (data.transactions.length === 0) {
                historyList.innerHTML = '<li class="history-item">Koi history nahi hai.</li>';
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
                        amountColor = '#dc3545';
                    } else if (item.type === 'add_money') {
                        description = `Balance added`;
                        amountDisplay = `+ ₹${item.amount}`;
                        amountColor = '#28a745';
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
        }
    } catch (error) {
        console.error('Network Error:', error);
    }
}

async function updateWalletBalance() {
    try {
        // BASE_URL added here
        const response = await fetch(`${BASE_URL}/wallet/${userId}`); 
        const data = await response.json();

        if (response.ok) {
            document.querySelector('.wallet-amount').textContent = `₹ ${data.walletBalance.toFixed(2)}`;
        } else {
            console.error('Failed to fetch wallet balance:', data.message);
        }
    } catch (error) {
        console.error('Network Error:', error);
    }
}