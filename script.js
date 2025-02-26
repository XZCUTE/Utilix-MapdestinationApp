// Global variables
let map;
let userMarker;
let userCircle;
let userPosition = null;
let pins = [];
let currentEditingPin = null;
let watchId;
let alertSound;
let alertsPlaying = {};

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  initMap();
  setupEventListeners();
  alertSound = document.getElementById('alert-sound');
});

// Initialize the map
function initMap() {
  // Create map centered at a default location (will be updated when user location is available)
  map = L.map('map').setView([0, 0], 2);
  
  // Add OpenStreetMap tile layer
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  }).addTo(map);
  
  // Create user marker (will be positioned when location is available)
  const userIcon = L.divIcon({
    className: 'user-marker',
    html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#1877f2" width="24" height="24">
            <circle cx="12" cy="12" r="10" fill="#1877f2" opacity="0.3"/>
            <circle cx="12" cy="12" r="5" fill="#1877f2"/>
          </svg>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
  
  userMarker = L.marker([0, 0], { icon: userIcon, zIndexOffset: 1000 }).addTo(map);
  userCircle = L.circle([0, 0], { radius: 0, color: '#1877f2', fillColor: '#1877f2', fillOpacity: 0.1 }).addTo(map);
  
  // Start tracking user location
  startLocationTracking();
  
  // Enable map click to add pins
  map.on('click', handleMapClick);
}

// Set up event listeners
function setupEventListeners() {
  // My location button
  document.getElementById('my-location-btn').addEventListener('click', centerOnUserLocation);
  
  // Search input
  const searchInput = document.getElementById('search-input');
  searchInput.addEventListener('input', debounce(handleSearchInput, 300));
  
  // Close pin details
  document.getElementById('close-pin-details').addEventListener('click', closePinDetails);
  
  // Save pin
  document.getElementById('save-pin').addEventListener('click', savePin);
  
  // Delete pin
  document.getElementById('delete-pin').addEventListener('click', deletePin);
}

// Start tracking user location
function startLocationTracking() {
  if ('geolocation' in navigator) {
    // Get initial position
    navigator.geolocation.getCurrentPosition(
      position => {
        updateUserPosition(position);
        centerOnUserLocation();
      },
      error => {
        console.error('Error getting location:', error);
        alert('Unable to get your location. Please enable location services and refresh the page.');
      },
      { enableHighAccuracy: true }
    );
    
    // Watch position for real-time updates
    watchId = navigator.geolocation.watchPosition(
      updateUserPosition,
      error => console.error('Error watching location:', error),
      { enableHighAccuracy: true, maximumAge: 1000 }
    );
  } else {
    alert('Geolocation is not supported by your browser');
  }
}

// Update user position marker and check for alerts
function updateUserPosition(position) {
  const { latitude, longitude, accuracy } = position.coords;
  userPosition = { lat: latitude, lng: longitude };
  
  // Update user marker and accuracy circle
  userMarker.setLatLng([latitude, longitude]);
  userCircle.setLatLng([latitude, longitude]);
  userCircle.setRadius(accuracy);
  
  // Check if user is near any pins with alerts
  checkPinAlerts();
}

// Center the map on user's current location
function centerOnUserLocation() {
  if (userPosition) {
    map.setView([userPosition.lat, userPosition.lng], 16, { animate: true });
  }
}

// Handle map click to add a new pin
function handleMapClick(e) {
  // Check if the click is near any existing pin's radius
  const clickLatLng = e.latlng;
  
  // Check if click is within any existing pin's alert radius
  for (const pin of pins) {
    const pinLatLng = pin.marker.getLatLng();
    const distance = clickLatLng.distanceTo(pinLatLng);
    
    if (distance <= pin.alertDistance) {
      alert("Cannot create a pin within another pin's alert radius");
      return;
    }
  }
  
  // Create a temporary marker at the clicked location
  const tempPosition = { lat: e.latlng.lat, lng: e.latlng.lng };
  
  // Open pin details panel for creating a new pin
  openPinDetailsForNew(tempPosition);
}

// Open pin details panel for creating a new pin
function openPinDetailsForNew(position) {
  currentEditingPin = {
    id: generateUniqueId(),
    position: position,
    name: '',
    color: 'red',
    alertDistance: 500,
    isNew: true
  };
  
  // Reset form fields
  document.getElementById('pin-name').value = '';
  document.getElementById('pin-color').value = 'red';
  document.getElementById('alert-distance').value = '500';
  
  // Show pin details panel
  document.getElementById('pin-details').style.display = 'block';
  document.getElementById('delete-pin').style.display = 'none'; // Hide delete button for new pins
}

// Open pin details panel for editing an existing pin
function openPinDetailsForEdit(pin) {
  currentEditingPin = pin;
  
  // Set form fields
  document.getElementById('pin-name').value = pin.name;
  document.getElementById('pin-color').value = pin.color;
  document.getElementById('alert-distance').value = pin.alertDistance;
  
  // Show pin details panel
  document.getElementById('pin-details').style.display = 'block';
  document.getElementById('delete-pin').style.display = 'block'; // Show delete button for existing pins
}

// Close pin details panel
function closePinDetails() {
  document.getElementById('pin-details').style.display = 'none';
  currentEditingPin = null;
}

// Save pin (create new or update existing)
function savePin() {
  const name = document.getElementById('pin-name').value.trim();
  const color = document.getElementById('pin-color').value;
  const alertDistance = parseInt(document.getElementById('alert-distance').value, 10);
  
  if (!name) {
    alert('Please enter a pin name');
    return;
  }
  
  if (isNaN(alertDistance) || alertDistance < 100) {
    alert('Please enter a valid alert distance (minimum 100 meters)');
    return;
  }
  
  if (currentEditingPin) {
    if (currentEditingPin.isNew) {
      // Create new pin
      createPin(currentEditingPin.id, currentEditingPin.position, name, color, alertDistance);
    } else {
      // Update existing pin
      updatePin(currentEditingPin, name, color, alertDistance);
    }
  }
  
  closePinDetails();
}

// Create a new pin
function createPin(id, position, name, color, alertDistance) {
  // Create custom icon
  const pinIcon = createPinIcon(color);
  
  // Create marker
  const marker = L.marker([position.lat, position.lng], {
    icon: pinIcon,
    draggable: true
  }).addTo(map);
  
  // Create alert radius circle
  const circle = L.circle([position.lat, position.lng], {
    radius: alertDistance,
    color: color,
    fillColor: color,
    fillOpacity: 0.1,
    weight: 1
  }).addTo(map);
  
  // Create pin object
  const pin = {
    id,
    marker,
    circle,
    name,
    color,
    alertDistance,
    position
  };
  
  // Add to pins array
  pins.push(pin);
  
  // Add event listeners
  marker.on('click', () => {
    openPinPopup(pin);
  });
  
  marker.on('dragstart', () => {
    map.removeLayer(circle);
  });
  
  marker.on('drag', (e) => {
    // Check if dragging into another pin's radius
    const dragLatLng = e.latlng;
    
    for (const otherPin of pins) {
      if (otherPin.id === pin.id) continue;
      
      const otherPinLatLng = otherPin.marker.getLatLng();
      const distance = dragLatLng.distanceTo(otherPinLatLng);
      
      // If dragging into another pin's radius, prevent by returning to original position
      if (distance <= otherPin.alertDistance) {
        setTimeout(() => {
          marker.setLatLng([pin.position.lat, pin.position.lng]);
        }, 0);
        return;
      }
    }
  });
  
  marker.on('dragend', (e) => {
    const newPos = e.target.getLatLng();
    pin.position = { lat: newPos.lat, lng: newPos.lng };
    
    // Update circle position
    circle.setLatLng(newPos);
    map.addLayer(circle);
    
    // Check for alerts after moving
    checkPinAlerts();
  });
  
  // Check for alerts
  checkPinAlerts();
}

// Update an existing pin
function updatePin(pin, name, color, alertDistance) {
  // Update pin properties
  pin.name = name;
  pin.color = color;
  pin.alertDistance = alertDistance;
  
  // Update marker icon
  const newIcon = createPinIcon(color);
  pin.marker.setIcon(newIcon);
  
  // Update circle
  pin.circle.setRadius(alertDistance);
  pin.circle.setStyle({
    color: color,
    fillColor: color
  });
  
  // Check for alerts after updating
  checkPinAlerts();
}

// Delete a pin
function deletePin() {
  if (currentEditingPin && !currentEditingPin.isNew) {
    // Remove marker and circle from map
    map.removeLayer(currentEditingPin.marker);
    map.removeLayer(currentEditingPin.circle);
    
    // Remove from pins array
    pins = pins.filter(pin => pin.id !== currentEditingPin.id);
    
    // Stop any playing alerts for this pin
    if (alertsPlaying[currentEditingPin.id]) {
      delete alertsPlaying[currentEditingPin.id];
    }
    
    closePinDetails();
  }
}

// Open popup for a pin
function openPinPopup(pin) {
  const popupContent = `
    <div class="custom-popup">
      <h3>${pin.name}</h3>
      <p>Alert distance: ${pin.alertDistance}m</p>
      <div class="custom-popup-actions">
        <button class="edit-pin-btn">Edit</button>
      </div>
    </div>
  `;
  
  const popup = L.popup().setContent(popupContent);
  pin.marker.bindPopup(popup).openPopup();
  
  // Add event listener to edit button after popup is opened
  setTimeout(() => {
    const editBtn = document.querySelector('.edit-pin-btn');
    if (editBtn) {
      editBtn.addEventListener('click', () => {
        pin.marker.closePopup();
        openPinDetailsForEdit(pin);
      });
    }
  }, 10);
}

// Check if user is near any pins with alerts
function checkPinAlerts() {
  if (!userPosition) return;
  
  const userLatLng = L.latLng(userPosition.lat, userPosition.lng);
  
  pins.forEach(pin => {
    const pinLatLng = pin.marker.getLatLng();
    const distance = userLatLng.distanceTo(pinLatLng);
    
    if (distance <= pin.alertDistance) {
      // User is within alert radius
      if (!alertsPlaying[pin.id]) {
        // Start alert
        startAlert(pin);
      }
    } else {
      // User is outside alert radius
      if (alertsPlaying[pin.id]) {
        // Stop alert
        stopAlert(pin);
      }
    }
  });
}

// Start alert for a pin
function startAlert(pin) {
  // Add to playing alerts
  alertsPlaying[pin.id] = true;
  
  // Add pulse animation to pin marker
  const icon = pin.marker.getElement();
  if (icon) {
    icon.classList.add('alert-active');
  }
  
  // Play sound
  playAlertSound();
  
  // Show notification
  showNotification(`Alert: You are near ${pin.name}!`);
}

// Stop alert for a pin
function stopAlert(pin) {
  // Remove from playing alerts
  delete alertsPlaying[pin.id];
  
  // Remove pulse animation from pin marker
  const icon = pin.marker.getElement();
  if (icon) {
    icon.classList.remove('alert-active');
  }
}

// Play alert sound
function playAlertSound() {
  // Play an annoying sound
  alertSound.currentTime = 0;
  alertSound.play();
  
  // Loop the sound for extra annoyance
  setTimeout(() => {
    if (Object.keys(alertsPlaying).length > 0) {
      playAlertSound();
    }
  }, 2000);
}

// Show notification
function showNotification(message) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('UTILIX MAP ALERT', {
      body: message,
      icon: 'https://cdn-icons-png.flaticon.com/512/1865/1865269.png'
    });
  } else if ('Notification' in window && Notification.permission !== 'denied') {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        showNotification(message);
      }
    });
  }
}

// Handle search input
function handleSearchInput() {
  const query = document.getElementById('search-input').value.trim();
  const resultsContainer = document.getElementById('search-results');
  
  if (query.length < 3) {
    resultsContainer.style.display = 'none';
    return;
  }
  
  // Use Nominatim API for geocoding (OpenStreetMap)
  fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`)
    .then(response => response.json())
    .then(data => {
      if (data && data.length > 0) {
        // Display results
        resultsContainer.innerHTML = '';
        data.forEach(result => {
          const item = document.createElement('div');
          item.className = 'search-result-item';
          item.textContent = result.display_name;
          item.addEventListener('click', () => {
            selectSearchResult(result);
          });
          resultsContainer.appendChild(item);
        });
        resultsContainer.style.display = 'block';
      } else {
        resultsContainer.innerHTML = '<div class="search-result-item">No results found</div>';
        resultsContainer.style.display = 'block';
      }
    })
    .catch(error => {
      console.error('Error searching for location:', error);
      resultsContainer.innerHTML = '<div class="search-result-item">Error searching for location</div>';
      resultsContainer.style.display = 'block';
    });
}

// Select a search result
function selectSearchResult(result) {
  const lat = parseFloat(result.lat);
  const lon = parseFloat(result.lon);
  
  // Clear search results
  document.getElementById('search-results').style.display = 'none';
  document.getElementById('search-input').value = result.display_name;
  
  // Center map on result
  map.setView([lat, lon], 16);
  
  // Create a pin at the search result location
  const position = { lat, lng: lon };
  
  // Check if the location is within any existing pin's alert radius
  const resultLatLng = L.latLng(lat, lon);
  
  for (const pin of pins) {
    const pinLatLng = pin.marker.getLatLng();
    const distance = resultLatLng.distanceTo(pinLatLng);
    
    if (distance <= pin.alertDistance) {
      alert("Cannot create a pin within another pin's alert radius");
      return;
    }
  }
  
  // Open pin details for creating a new pin
  openPinDetailsForNew(position);
}

// Create pin icon with specified color
function createPinIcon(color) {
  return L.divIcon({
    className: 'custom-pin',
    html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" width="32" height="32">
            <path d="M12 0C7.802 0 4 3.403 4 7.602C4 11.8 7.469 16.812 12 24C16.531 16.812 20 11.8 20 7.602C20 3.403 16.199 0 12 0ZM12 11C10.343 11 9 9.657 9 8C9 6.343 10.343 5 12 5C13.657 5 15 6.343 15 8C15 9.657 13.657 11 12 11Z"/>
          </svg>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
  });
}

// Generate a unique ID
function generateUniqueId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// Debounce function to limit how often a function is called
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}