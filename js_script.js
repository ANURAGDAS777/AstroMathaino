// ============ Shared Utility Functions ============

// Format date
function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

// Format time
function formatTime(dateString) {
  return new Date(dateString).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Show notification
function showNotification(message, type = 'success', duration = 3000) {
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 15px 20px;
    border-radius: 8px;
    z-index: 10000;
    animation: slideIn 0.3s ease-out;
    ${type === 'success' ? 'background: #22c55e; color: white;' : 'background: #ef4444; color: white;'}
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  `;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, duration);
}

// API call wrapper
async function apiCall(endpoint, method = 'GET', data = null) {
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(`http://localhost:3000${endpoint}`, options);
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'API Error');
    }

    return result;
  } catch (error) {
    console.error('API Error:', error);
    showNotification(error.message, 'error');
    throw error;
  }
}

// Check if logged in
function isLoggedIn() {
  const user = localStorage.getItem('astro_user');
  return user ? JSON.parse(user) : null;
}

// Logout
function logout() {
  localStorage.removeItem('astro_user');
  window.location.href = 'index.html';
}

// Get random color
function getRandomColor() {
  const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316'];
  return colors[Math.floor(Math.random() * colors.length)];
}

// Validate email
function isValidEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

// Validate password
function isValidPassword(password) {
  return password && password.length >= 6;
}

// Debounce function
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Throttle function
function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  // Add any global initialization here
  console.log('✅ Application ready');
});