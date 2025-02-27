// Create a namespace for our application
window.app = window.app || {};

// Check if cookies are accepted
function checkCookieConsent() {
  return getCookie('utilixMapConsent') === 'accepted';
}

// Handle cookie consent
function handleCookieConsent() {
  document.getElementById('accept-cookies').addEventListener('click', () => {
    setCookie('utilixMapConsent', 'accepted', 365);
    document.getElementById('cookie-consent').style.display = 'none';
    document.querySelector('.app-container').style.display = 'flex';
    // Initialize the app after consent
    initializeApp();
  });
}

// Initialize the application
function initializeApp() {
  // Load saved pins from cookies
  loadPinsFromCookies();
  
  // Initialize audio
  initializeAudio();
  
  // Setup event listeners that don't depend on map
  setupInitialEventListeners();
}

// Global variables
let map;
let userMarker;
let userCircle;
let userPosition = null;
let pins = [];
let currentEditingPin = null;
let watchId;
let alertsPlaying = {};
let searchBox;
let destinationBox;
let directionsService;
let directionsRenderer;
let currentRoute = null;
let destinationMarker = null;
let currentRouteIndex = 0;
let mapLoaded = false;

// Initialize audio context
let audioContext;

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  if (checkCookieConsent()) {
    // If consent already given, show app and initialize
    document.getElementById('cookie-consent').style.display = 'none';
    document.querySelector('.app-container').style.display = 'flex';
    initializeApp();
  } else {
    // Otherwise, show cookie consent and wait for acceptance
    document.getElementById('cookie-consent').style.display = 'flex';
    document.querySelector('.app-container').style.display = 'none';
    handleCookieConsent();
  }
});

// Initialize audio
function initializeAudio() {
  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  } catch (error) {
    console.error('Web Audio API not supported:', error);
  }
}

// Create a beep sound
function createBeep(type = 'beep1') {
  if (!audioContext) return;

  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  // Different beep types
  const types = {
    beep1: { freq: 800, duration: 200, interval: 300 },  // Fast annoying beep
    beep2: { freq: 600, duration: 300, interval: 500 },  // Medium beep
    beep3: { freq: 400, duration: 400, interval: 700 },  // Slow beep
    beep4: { freq: 1000, duration: 100, interval: 200 }  // Very fast beep
  };

  const settings = types[type] || types.beep1;

  oscillator.type = 'square';  // More annoying than sine
  oscillator.frequency.value = settings.freq;
  gainNode.gain.value = 0.3;

  oscillator.start();
  
  setTimeout(() => {
    oscillator.stop();
    gainNode.disconnect();
  }, settings.duration);

  return { oscillator, gainNode, settings };
}

// Setup event listeners
function setupInitialEventListeners() {
  document.getElementById('stop-alarms').addEventListener('click', stopAllAlarms);
  document.getElementById('test-sound').addEventListener('click', testAlertSound);
}

// Start alert for a pin
function startAlert(pin) {
  if (alertsPlaying[pin.id]) return;

  const beepType = pin.alertSound || 'beep1';
  const beep = createBeep(beepType);
  
  if (beep) {
    // Create repeating beep
    const interval = setInterval(() => {
      if (alertsPlaying[pin.id]) {
        createBeep(beepType);
      }
    }, beep.settings.interval);

    alertsPlaying[pin.id] = {
      interval: interval,
      pin: pin
    };

    // Add bounce animation to pin marker
    pin.marker.setAnimation(google.maps.Animation.BOUNCE);
    
    // Show notification
    showNotification(`Alert: You are near ${pin.name}!`);
  }
}

// Stop alert for a pin
function stopAlert(pin) {
  const alert = alertsPlaying[pin.id];
  if (!alert) return;

  clearInterval(alert.interval);
  pin.marker.setAnimation(null);
  delete alertsPlaying[pin.id];
}

// Stop all alarms
function stopAllAlarms() {
  Object.values(alertsPlaying).forEach(alert => {
    clearInterval(alert.interval);
    alert.pin.marker.setAnimation(null);
  });
  alertsPlaying = {};
}

// Test alert sound
function testAlertSound() {
  const selectedType = document.getElementById('alert-sound').value;
  createBeep(selectedType);
}

// Load pins from cookies
function loadPinsFromCookies() {
  try {
    const savedPins = getCookie('utilixMapPins');
    if (savedPins) {
      const pinData = JSON.parse(savedPins);
      window.savedPinData = pinData;
    }
  } catch (error) {
    console.error('Error loading pins from cookies:', error);
  }
}

// Save pins to cookies
function savePinsToCookies() {
  try {
    const pinData = pins.map(pin => ({
      id: pin.id,
      position: {
        lat: pin.marker.getPosition().lat(),
        lng: pin.marker.getPosition().lng()
      },
      name: pin.name,
      color: pin.color,
      alertDistance: pin.alertDistance,
      alertSound: pin.alertSound
    }));
    
    setCookie('utilixMapPins', JSON.stringify(pinData), 365);
  } catch (error) {
    console.error('Error saving pins to cookies:', error);
  }
}

// Cookie utilities
function setCookie(name, value, days) {
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = name + '=' + encodeURIComponent(value) + ';expires=' + expires.toUTCString() + ';path=/';
}

function getCookie(name) {
  const nameEQ = name + '=';
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return decodeURIComponent(c.substring(nameEQ.length, c.length));
  }
  return null;
}

// Initialize map (called by Google Maps API when loaded)
window.app.initMap = function() {
  // Initialize Directions Service and Renderer
  directionsService = new google.maps.DirectionsService();
  directionsRenderer = new google.maps.DirectionsRenderer({
    suppressMarkers: true,
    polylineOptions: {
      strokeColor: '#1877f2',
      strokeWeight: 5
    }
  });
  const mapOptions = {
    zoom: 2,
    center: { lat: 0, lng: 0 },
    mapTypeId: google.maps.MapTypeId.ROADMAP,
    zoomControl: true,
    mapTypeControl: false,
    scaleControl: true,
    streetViewControl: false,
    rotateControl: false,
    fullscreenControl: false,
    gestureHandling: 'greedy',
    maxZoom: 19,
    styles: [
      {
        featureType: "poi",
        elementType: "labels",
        stylers: [{ visibility: "off" }]
      }
    ]
  };
  
  map = new google.maps.Map(document.getElementById('map'), mapOptions);
  
  // Initialize the Places Autocomplete for both search boxes
  const input = document.getElementById('search-input');
  const destinationInput = document.getElementById('destination-input');
  
  searchBox = new google.maps.places.Autocomplete(input, {
    fields: ['geometry', 'name'],
    strictBounds: false,
    types: ['geocode', 'establishment']
  });
  
  destinationBox = new google.maps.places.Autocomplete(destinationInput, {
    fields: ['geometry', 'name'],
    strictBounds: false,
    types: ['geocode', 'establishment']
  });
  
  // Set the directions renderer to the map
  directionsRenderer.setMap(map);
  
  // Create user marker
  userMarker = new google.maps.Marker({
    map: map,
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 10,
      fillColor: "#1877f2",
      fillOpacity: 1,
      strokeColor: "#ffffff",
      strokeWeight: 2
    },
    optimized: true,
    zIndex: 1000
  });
  
  userCircle = new google.maps.Circle({
    map: map,
    fillColor: "#1877f2",
    fillOpacity: 0.1,
    strokeColor: "#1877f2",
    strokeWeight: 1,
    clickable: false
  });
  
  // Setup remaining event listeners
  setupMapEventListeners();
  
  // Start tracking user location
  startLocationTracking();
  
  // Restore saved pins
  if (window.savedPinData) {
    window.savedPinData.forEach(pinData => {
      createPin(
        pinData.id,
        pinData.position,
        pinData.name,
        pinData.color,
        pinData.alertDistance,
        pinData.alertSound
      );
    });
    delete window.savedPinData;
  }
  
  mapLoaded = true;
};

// Set up map event listeners
function setupMapEventListeners() {
  document.getElementById('my-location-btn').addEventListener('click', centerOnUserLocation);
  document.getElementById('close-pin-details').addEventListener('click', closePinDetails);
  document.getElementById('save-pin').addEventListener('click', savePin);
  document.getElementById('delete-pin').addEventListener('click', deletePin);
  document.getElementById('add-destination').addEventListener('click', addDestination);
  document.getElementById('remove-destination').addEventListener('click', removeDestination);
  document.getElementById('another-route').addEventListener('click', showNextRoute);
  searchBox.addListener('place_changed', handlePlaceSelection);
  destinationBox.addListener('place_changed', handleDestinationSelection);
  map.addListener('click', handleMapClick);
}

// Handle destination selection from autocomplete
function handleDestinationSelection() {
  const place = destinationBox.getPlace();
  if (!place.geometry) return;
  
  const destination = {
    lat: place.geometry.location.lat(),
    lng: place.geometry.location.lng()
  };
  
  calculateAndDisplayRoute(destination);
}

// Add destination and calculate route
function addDestination() {
  const destinationInput = document.getElementById('destination-input');
  if (!destinationInput.value) {
    alert('Please enter a destination');
    return;
  }
  
  const place = destinationBox.getPlace();
  if (!place || !place.geometry) {
    alert('Please select a valid destination from the dropdown');
    return;
  }
  
  const destination = {
    lat: place.geometry.location.lat(),
    lng: place.geometry.location.lng()
  };
  
  calculateAndDisplayRoute(destination);
}

// Remove destination and clear route
function removeDestination() {
  if (currentRoute) {
    directionsRenderer.setDirections({ routes: [] });
    currentRoute = null;
    currentRouteIndex = 0;
    document.getElementById('destination-input').value = '';
    document.getElementById('another-route').style.display = 'none';
    
    // Remove destination marker
    if (destinationMarker) {
      destinationMarker.setMap(null);
      destinationMarker = null;
    }
  }
}

// Show next alternative route
function showNextRoute() {
  if (!currentRoute || !currentRoute.routes || currentRoute.routes.length <= 1) return;
  
  currentRouteIndex = (currentRouteIndex + 1) % currentRoute.routes.length;
  
  const newRoute = {
    ...currentRoute,
    routes: [currentRoute.routes[currentRouteIndex]]
  };
  
  directionsRenderer.setDirections(newRoute);
}

// Calculate and display route
function calculateAndDisplayRoute(destination) {
  if (!userPosition) {
    alert('Please enable location services to get directions');
    return;
  }

    // Create or update destination marker
    if (!destinationMarker) {
      destinationMarker = new google.maps.Marker({
        position: destination,
        map: map,
        draggable: false, // Start as non-draggable
        icon: {
          path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
          scale: 6,
          fillColor: "#dc3545",
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2
        }
      });

      // Add double click listener to toggle draggable state
      destinationMarker.addListener('dblclick', () => {
        const isDraggable = destinationMarker.getDraggable();
        destinationMarker.setDraggable(!isDraggable);
        
        // Change cursor and color to indicate draggable state
        if (!isDraggable) {
          destinationMarker.setIcon({
            ...destinationMarker.getIcon(),
            fillColor: "#28a745" // Green when draggable
          });
          destinationMarker.setCursor('move');
        } else {
          destinationMarker.setIcon({
            ...destinationMarker.getIcon(),
            fillColor: "#dc3545" // Red when not draggable
          });
          destinationMarker.setCursor('pointer');
        }
      });

      // Add drag event listeners
      destinationMarker.addListener('dragend', () => {
        const newPos = destinationMarker.getPosition();
        calculateAndDisplayRoute({
          lat: newPos.lat(),
          lng: newPos.lng()
        });
      });
  } else {
    destinationMarker.setPosition(destination);
  }
  
  const request = {
    origin: userPosition,
    destination: destination,
    travelMode: google.maps.TravelMode.DRIVING,
    provideRouteAlternatives: true // Request alternative routes
  };
  
  directionsService.route(request, (result, status) => {
    if (status === google.maps.DirectionsStatus.OK) {
      directionsRenderer.setDirections(result);
      currentRoute = result;
      currentRouteIndex = 0;
      
      // Show "Another Route" button if there are alternative routes
      const anotherRouteBtn = document.getElementById('another-route');
      anotherRouteBtn.style.display = result.routes.length > 1 ? 'block' : 'none';
      
      // Keep destination marker visible
      destinationMarker.setMap(map);
    } else {
      alert('Could not calculate directions: ' + status);
    }
  });
}

// Handle place selection from autocomplete
function handlePlaceSelection() {
  const place = searchBox.getPlace();
  if (!place.geometry) return;
  
  map.setCenter(place.geometry.location);
  map.setZoom(16);
  
  // Check if location is within any existing pin's radius
  for (const pin of pins) {
    const distance = google.maps.geometry.spherical.computeDistanceBetween(
      place.geometry.location,
      pin.marker.getPosition()
    );
    
    if (distance <= pin.alertDistance) {
      alert("Cannot create a pin within another pin's alert radius");
      return;
    }
  }
  
  openPinDetailsForNew({
    lat: place.geometry.location.lat(),
    lng: place.geometry.location.lng()
  });
}

// Start tracking user location
function startLocationTracking() {
  if ('geolocation' in navigator) {
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
  
  const latLng = new google.maps.LatLng(latitude, longitude);
  userMarker.setPosition(latLng);
  userCircle.setCenter(latLng);
  userCircle.setRadius(accuracy);
  
  checkPinAlerts();
}

// Center the map on user's current location
function centerOnUserLocation() {
  if (userPosition) {
    map.setCenter(userPosition);
    map.setZoom(16);
  }
}

// Handle map click to add a new pin
function handleMapClick(e) {
  const clickLatLng = e.latLng;
  
  for (const pin of pins) {
    const distance = google.maps.geometry.spherical.computeDistanceBetween(
      clickLatLng,
      pin.marker.getPosition()
    );
    
    if (distance <= pin.alertDistance) {
      alert("Cannot create a pin within another pin's alert radius");
      return;
    }
  }
  
  openPinDetailsForNew({
    lat: clickLatLng.lat(),
    lng: clickLatLng.lng()
  });
}

// Open pin details panel for creating a new pin
function openPinDetailsForNew(position) {
  currentEditingPin = {
    id: generateUniqueId(),
    position: position,
    name: '',
    color: 'red',
    alertDistance: 500,
    alertSound: 'beep1',
    isNew: true
  };
  
  document.getElementById('pin-name').value = '';
  document.getElementById('pin-color').value = 'red';
  document.getElementById('alert-distance').value = '500';
  document.getElementById('alert-sound').value = 'beep1';
  
  document.getElementById('pin-details').style.display = 'block';
  document.getElementById('delete-pin').style.display = 'none';
}

// Open pin details panel for editing an existing pin
function openPinDetailsForEdit(pin) {
  currentEditingPin = pin;
  
  document.getElementById('pin-name').value = pin.name;
  document.getElementById('pin-color').value = pin.color;
  document.getElementById('alert-distance').value = pin.alertDistance;
  document.getElementById('alert-sound').value = pin.alertSound;
  
  document.getElementById('pin-details').style.display = 'block';
  document.getElementById('delete-pin').style.display = 'block';
}

// Close pin details panel
function closePinDetails() {
  document.getElementById('pin-details').style.display = 'none';
  currentEditingPin = null;
}

// Save pin
function savePin() {
  const name = document.getElementById('pin-name').value.trim();
  const color = document.getElementById('pin-color').value;
  const alertDistance = parseInt(document.getElementById('alert-distance').value, 10);
  const alertSound = document.getElementById('alert-sound').value;
  
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
      createPin(currentEditingPin.id, currentEditingPin.position, name, color, alertDistance, alertSound);
    } else {
      updatePin(currentEditingPin, name, color, alertDistance, alertSound);
    }
  }
  
  savePinsToCookies();
  closePinDetails();
}

// Create a new pin
function createPin(id, position, name, color, alertDistance, alertSound) {
  const latLng = new google.maps.LatLng(position.lat, position.lng);
  
  const marker = new google.maps.Marker({
    position: latLng,
    map: map,
    draggable: true,
    icon: {
      path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
      scale: 6,
      fillColor: color,
      fillOpacity: 1,
      strokeColor: '#ffffff',
      strokeWeight: 2
    },
    optimized: true
  });
  
  const circle = new google.maps.Circle({
    map: map,
    center: latLng,
    radius: alertDistance,
    fillColor: color,
    fillOpacity: 0.1,
    strokeColor: color,
    strokeWeight: 1,
    clickable: false
  });
  
  const pin = {
    id,
    marker,
    circle,
    name,
    color,
    alertDistance,
    alertSound,
    position
  };
  
  pins.push(pin);
  
  marker.addListener('click', () => {
    openPinDetailsForEdit(pin);
  });
  
  marker.addListener('dragstart', () => {
    circle.setMap(null);
  });
  
  marker.addListener('drag', (e) => {
    const dragLatLng = e.latLng;
    
    for (const otherPin of pins) {
      if (otherPin.id === pin.id) continue;
      
      const distance = google.maps.geometry.spherical.computeDistanceBetween(
        dragLatLng,
        otherPin.marker.getPosition()
      );
      
      if (distance <= otherPin.alertDistance) {
        marker.setPosition(new google.maps.LatLng(pin.position.lat, pin.position.lng));
        return;
      }
    }
  });
  
  marker.addListener('dragend', (e) => {
    const newPos = e.latLng;
    pin.position = { lat: newPos.lat(), lng: newPos.lng() };
    
    circle.setCenter(newPos);
    circle.setMap(map);
    
    savePinsToCookies();
    checkPinAlerts();
  });
  
  checkPinAlerts();
}

// Update an existing pin
function updatePin(pin, name, color, alertDistance, alertSound) {
  pin.name = name;
  pin.color = color;
  pin.alertDistance = alertDistance;
  pin.alertSound = alertSound;
  
  pin.marker.setIcon({
    path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
    scale: 6,
    fillColor: color,
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 2
  });
  
  pin.circle.setRadius(alertDistance);
  pin.circle.setOptions({
    fillColor: color,
    strokeColor: color
  });
  
  savePinsToCookies();
  checkPinAlerts();
}

// Delete a pin
function deletePin() {
  if (currentEditingPin && !currentEditingPin.isNew) {
    currentEditingPin.marker.setMap(null);
    currentEditingPin.circle.setMap(null);
    
    pins = pins.filter(pin => pin.id !== currentEditingPin.id);
    
    if (alertsPlaying[currentEditingPin.id]) {
      stopAlert(currentEditingPin);
    }
    
    savePinsToCookies();
    closePinDetails();
  }
}

// Check if user is near any pins with alerts
function checkPinAlerts() {
  if (!userPosition) return;
  
  const userLatLng = new google.maps.LatLng(userPosition.lat, userPosition.lng);
  
  pins.forEach(pin => {
    const distance = google.maps.geometry.spherical.computeDistanceBetween(
      userLatLng,
      pin.marker.getPosition()
    );
    
    if (distance <= pin.alertDistance) {
      if (!alertsPlaying[pin.id]) {
        startAlert(pin);
      }
    } else {
      if (alertsPlaying[pin.id]) {
        stopAlert(pin);
      }
    }
  });
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

// Generate a unique ID
function generateUniqueId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}
