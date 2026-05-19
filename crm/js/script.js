document.addEventListener('DOMContentLoaded', () => {
    // --- Sidebar Toggle ---
    const sidebar = document.getElementById('sidebar');
    const sidebarToggleBtn = document.getElementById('sidebar-toggle');

    sidebarToggleBtn.addEventListener('click', () => {
        // For desktop
        if (window.innerWidth > 768) {
            sidebar.classList.toggle('collapsed');
        } else {
            // For mobile
            sidebar.classList.toggle('mobile-active');
        }
    });

    // Handle resize events to reset sidebar state
    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
            sidebar.classList.remove('mobile-active');
        } else {
            sidebar.classList.remove('collapsed');
        }
    });

    // --- View Switching Logic (SPA Simulation) ---
    const menuItems = document.querySelectorAll('.menu-item');
    const views = document.querySelectorAll('.view');

    menuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Remove active class from all menu items
            menuItems.forEach(mi => mi.classList.remove('active'));
            
            // Add active class to clicked item
            item.classList.add('active');

            // Hide all views
            views.forEach(v => {
                v.classList.remove('active');
            });

            // Show target view
            const targetId = item.getAttribute('data-target');
            if (targetId) {
                const targetView = document.getElementById(targetId);
                if (targetView) {
                    targetView.classList.add('active');
                }
            }

            // On mobile, close sidebar after clicking a link
            if (window.innerWidth <= 768) {
                sidebar.classList.remove('mobile-active');
            }
        });
    });

    // --- Quick Add Modal ---
    const modalOverlay = document.getElementById('quick-add-modal');
    const addNewBtn = document.getElementById('add-new-btn');
    const closeModalBtn = document.getElementById('close-modal');

    // Open modal via Topbar Add Button
    if (addNewBtn) {
        addNewBtn.addEventListener('click', () => {
            modalOverlay.classList.add('active');
        });
    }

    // Open modal via specific primary buttons in views
    const primaryBtns = document.querySelectorAll('.primary-btn');
    primaryBtns.forEach(btn => {
        if(btn.innerText.includes('Create New Job') || btn.innerText.includes('New Appointment')) {
            btn.addEventListener('click', () => {
                modalOverlay.classList.add('active');
            });
        }
    });

    // Close Modal
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            modalOverlay.classList.remove('active');
        });
    }

    // Close modal on click outside content
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            modalOverlay.classList.remove('active');
        }
    });

    // --- Chat Interface Interactions (Mock) ---
    const chatItems = document.querySelectorAll('.chat-item');
    
    chatItems.forEach(item => {
        item.addEventListener('click', () => {
            // Remove active from all
            chatItems.forEach(c => c.classList.remove('active'));
            // Add active to clicked
            item.classList.add('active');
            // Remove unread status if it exists
            item.classList.remove('unread');
            
            // In a real app, this would fetch messages for the selected chat
            const chatName = item.querySelector('.chat-name').innerText;
            const chatHeaderTitle = document.querySelector('.chat-title h3');
            if(chatHeaderTitle) {
                chatHeaderTitle.innerText = chatName;
            }
        });
    });

    // Mock Send Message
    const sendBtn = document.querySelector('.send-btn');
    const chatInput = document.querySelector('.chat-input-area input');
    const chatMessages = document.querySelector('.chat-messages');

    if (sendBtn && chatInput && chatMessages) {
        sendBtn.addEventListener('click', sendMessage);
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });

        function sendMessage() {
            const text = chatInput.value.trim();
            if (text === '') return;

            const now = new Date();
            const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            const msgDiv = document.createElement('div');
            msgDiv.className = 'message outgoing';
            msgDiv.style.alignSelf = 'flex-end';
            
            msgDiv.innerHTML = `
                <div class="message-bubble" style="background-color: var(--primary-color); color: white; border-radius: 15px 15px 0 15px;">
                    <p>${text}</p>
                    <span class="time" style="color: rgba(255,255,255,0.7);">${timeString}</span>
                </div>
            `;

            chatMessages.appendChild(msgDiv);
            chatInput.value = '';
            
            // Scroll to bottom
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }
});
