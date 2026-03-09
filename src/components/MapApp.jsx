import { useEffect, useRef, useState, useCallback } from 'react';
import { getCookie, setCookie, generateUniqueId } from '../utils/cookies';
import { useAudio } from '../hooks/useAudio';
import Header from './Header';
import PinDetailsPanel from './PinDetailsPanel';
import FloatingControls from './FloatingControls';
import Notification from './Notification';
import './MapApp.css';

// Pin color hex map for Google Maps markers
const COLOR_HEX = {
  red: '#ff4757', blue: '#4f8eff', green: '#2ed573',
  purple: '#a855f7', orange: '#ffa502', yellow: '#ffd32a',
};

export default function MapApp() {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const userMarkerRef = useRef(null);
  const userCircleRef = useRef(null);
  const directionsServiceRef = useRef(null);
  const directionsRendererRef = useRef(null);
  const destinationMarkerRef = useRef(null);
  const searchAutocompleteRef = useRef(null);
  const destinationAutocompleteRef = useRef(null);
  const searchInputRef = useRef(null);
  const destinationInputRef = useRef(null);
  const pinsRef = useRef([]);
  const alertsRef = useRef({});
  const userPositionRef = useRef(null);
  const watchIdRef = useRef(null);
  const currentRouteRef = useRef(null);
  const currentRouteIndexRef = useRef(0);

  const [hasRoute, setHasRoute] = useState(false);
  const [hasAlternativeRoutes, setHasAlternativeRoutes] = useState(false);
  const [editingPin, setEditingPin] = useState(null);
  const [notification, setNotification] = useState(null);
  const [isLocating, setIsLocating] = useState(false);

  const { startRepeatingBeep, stopBeep, createBeep } = useAudio();

  // ---- Notification helper ----
  const showNotif = useCallback((msg, type = 'info') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  }, []);

  // ---- Save pins to cookie ----
  const savePins = useCallback(() => {
    try {
      const data = pinsRef.current.map(p => ({
        id: p.id, name: p.name, color: p.color,
        alertDistance: p.alertDistance, alertSound: p.alertSound,
        position: {
          lat: p.marker.getPosition().lat(),
          lng: p.marker.getPosition().lng(),
        },
      }));
      setCookie('utilixMapPins', JSON.stringify(data), 365);
    } catch (e) { console.error('savePins:', e); }
  }, []);

  // ---- Stop All Alarms ----
  const stopAllAlarms = useCallback(() => {
    Object.values(alertsRef.current).forEach(({ interval, pin }) => {
      stopBeep(interval);
      if (pin.marker) pin.marker.setAnimation(null);
    });
    alertsRef.current = {};
    showNotif('All alarms stopped', 'success');
  }, [stopBeep, showNotif]);

  // ---- Check pin proximity alerts ----
  const checkAlerts = useCallback(() => {
    if (!userPositionRef.current || !window.google) return;
    const userLL = new window.google.maps.LatLng(
      userPositionRef.current.lat, userPositionRef.current.lng
    );
    pinsRef.current.forEach(pin => {
      const dist = window.google.maps.geometry.spherical.computeDistanceBetween(
        userLL, pin.marker.getPosition()
      );
      if (dist <= pin.alertDistance) {
        if (!alertsRef.current[pin.id]) {
          const interval = startRepeatingBeep(pin.alertSound || 'beep1');
          alertsRef.current[pin.id] = { interval, pin };
          pin.marker.setAnimation(window.google.maps.Animation.BOUNCE);
          showNotif(`Alert: You are near "${pin.name}"!`, 'warning');
        }
      } else {
        if (alertsRef.current[pin.id]) {
          stopBeep(alertsRef.current[pin.id].interval);
          pin.marker.setAnimation(null);
          delete alertsRef.current[pin.id];
        }
      }
    });
  }, [startRepeatingBeep, stopBeep, showNotif]);

  // ---- Create a pin on the map ----
  const createPin = useCallback((id, position, name, color, alertDistance, alertSound) => {
    const G = window.google.maps;
    const latLng = new G.LatLng(position.lat, position.lng);
    const hex = COLOR_HEX[color] || COLOR_HEX.red;

    const marker = new G.Marker({
      position: latLng, map: mapInstance.current, draggable: true,
      icon: { path: G.SymbolPath.BACKWARD_CLOSED_ARROW, scale: 7,
        fillColor: hex, fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 },
      optimized: true, zIndex: 200,
    });

    const circle = new G.Circle({
      map: mapInstance.current, center: latLng, radius: alertDistance,
      fillColor: hex, fillOpacity: 0.1, strokeColor: hex,
      strokeWeight: 1.5, strokeOpacity: 0.6, clickable: false,
    });

    const pin = { id, marker, circle, name, color, alertDistance, alertSound, position };
    pinsRef.current.push(pin);

    marker.addListener('click', () => setEditingPin({ ...pin, isNew: false }));

    marker.addListener('dragstart', () => { circle.setMap(null); });
    marker.addListener('drag', (e) => {
      const ll = e.latLng;
      for (const other of pinsRef.current) {
        if (other.id === pin.id) continue;
        const d = G.geometry.spherical.computeDistanceBetween(ll, other.marker.getPosition());
        if (d <= other.alertDistance) {
          marker.setPosition(new G.LatLng(pin.position.lat, pin.position.lng));
          return;
        }
      }
    });
    marker.addListener('dragend', (e) => {
      const newPos = e.latLng;
      pin.position = { lat: newPos.lat(), lng: newPos.lng() };
      circle.setCenter(newPos);
      circle.setMap(mapInstance.current);
      savePins();
      checkAlerts();
    });

    checkAlerts();
    return pin;
  }, [savePins, checkAlerts]);

  // ---- Calculate route ----
  const calculateRoute = useCallback((destination) => {
    if (!userPositionRef.current) {
      showNotif('Enable location services to get directions', 'error'); return;
    }
    const G = window.google.maps;
    if (!destinationMarkerRef.current) {
      destinationMarkerRef.current = new G.Marker({
        position: destination, map: mapInstance.current, draggable: false,
        icon: { path: G.SymbolPath.BACKWARD_CLOSED_ARROW, scale: 7,
          fillColor: '#ff4757', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 },
      });
      destinationMarkerRef.current.addListener('dblclick', () => {
        const dm = destinationMarkerRef.current;
        const isDrag = dm.getDraggable();
        dm.setDraggable(!isDrag);
        dm.setIcon({ ...dm.getIcon(), fillColor: isDrag ? '#ff4757' : '#2ed573' });
      });
      destinationMarkerRef.current.addListener('dragend', () => {
        const p = destinationMarkerRef.current.getPosition();
        calculateRoute({ lat: p.lat(), lng: p.lng() });
      });
    } else {
      destinationMarkerRef.current.setPosition(destination);
    }

    directionsServiceRef.current.route({
      origin: userPositionRef.current, destination,
      travelMode: G.TravelMode.DRIVING, provideRouteAlternatives: true,
    }, (result, status) => {
      if (status === G.DirectionsStatus.OK) {
        directionsRendererRef.current.setDirections(result);
        currentRouteRef.current = result;
        currentRouteIndexRef.current = 0;
        setHasRoute(true);
        setHasAlternativeRoutes(result.routes.length > 1);
        destinationMarkerRef.current.setMap(mapInstance.current);
      } else {
        showNotif('Could not calculate route: ' + status, 'error');
      }
    });
  }, [showNotif]);

  // ---- Map init callback ----
  const initMap = useCallback(() => {
    const G = window.google.maps;

    directionsServiceRef.current = new G.DirectionsService();
    directionsRendererRef.current = new G.DirectionsRenderer({
      suppressMarkers: true,
      polylineOptions: {
        strokeColor: '#4f8eff', strokeWeight: 5, strokeOpacity: 0.85,
      },
    });

    const map = new G.Map(mapRef.current, {
      zoom: 2, center: { lat: 0, lng: 0 },
      mapTypeId: G.MapTypeId.ROADMAP,
      zoomControl: true, mapTypeControl: false, scaleControl: false,
      streetViewControl: false, rotateControl: false, fullscreenControl: false,
      gestureHandling: 'greedy', maxZoom: 19,
      styles: [
        { featureType: 'all', elementType: 'geometry', stylers: [{ color: '#1a1d27' }] },
        { featureType: 'all', elementType: 'labels.text.fill', stylers: [{ color: '#8890ab' }] },
        { featureType: 'all', elementType: 'labels.text.stroke', stylers: [{ color: '#141829' }] },
        { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#252a40' }] },
        { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2d3450' }] },
        { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#6b7ab0' }] },
        { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f1322' }] },
        { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4f5d78' }] },
        { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#141829' }] },
        { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#1c2138' }] },
        { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
        { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#1c2138' }] },
        { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#2d3450' }] },
      ],
    });

    mapInstance.current = map;
    directionsRendererRef.current.setMap(map);

    // User marker
    userMarkerRef.current = new G.Marker({
      map, icon: { path: G.SymbolPath.CIRCLE, scale: 10,
        fillColor: '#4f8eff', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2.5 },
      optimized: true, zIndex: 1000,
    });

    userCircleRef.current = new G.Circle({
      map, fillColor: '#4f8eff', fillOpacity: 0.08,
      strokeColor: '#4f8eff', strokeWeight: 1.5, strokeOpacity: 0.4, clickable: false,
    });

    // Autocomplete
    searchAutocompleteRef.current = new G.places.Autocomplete(searchInputRef.current, {
      fields: ['geometry', 'name'], strictBounds: false,
      types: ['geocode', 'establishment'],
    });
    destinationAutocompleteRef.current = new G.places.Autocomplete(destinationInputRef.current, {
      fields: ['geometry', 'name'], strictBounds: false,
      types: ['geocode', 'establishment'],
    });

    searchAutocompleteRef.current.addListener('place_changed', () => {
      const place = searchAutocompleteRef.current.getPlace();
      if (!place.geometry) return;
      map.setCenter(place.geometry.location);
      map.setZoom(16);
      for (const pin of pinsRef.current) {
        const d = G.geometry.spherical.computeDistanceBetween(
          place.geometry.location, pin.marker.getPosition()
        );
        if (d <= pin.alertDistance) {
          showNotif("Cannot place pin within another pin's alert radius", 'error');
          return;
        }
      }
      setEditingPin({ id: generateUniqueId(), isNew: true, name: '', color: 'red',
        alertDistance: 500, alertSound: 'beep1',
        position: { lat: place.geometry.location.lat(), lng: place.geometry.location.lng() },
      });
    });

    destinationAutocompleteRef.current.addListener('place_changed', () => {
      const place = destinationAutocompleteRef.current.getPlace();
      if (!place.geometry) return;
      calculateRoute({ lat: place.geometry.location.lat(), lng: place.geometry.location.lng() });
    });

    map.addListener('click', (e) => {
      const ll = e.latLng;
      for (const pin of pinsRef.current) {
        const d = G.geometry.spherical.computeDistanceBetween(ll, pin.marker.getPosition());
        if (d <= pin.alertDistance) {
          showNotif("Cannot place pin within another pin's alert radius", 'error');
          return;
        }
      }
      setEditingPin({ id: generateUniqueId(), isNew: true, name: '', color: 'red',
        alertDistance: 500, alertSound: 'beep1',
        position: { lat: ll.lat(), lng: ll.lng() },
      });
    });

    // Location tracking
    if ('geolocation' in navigator) {
      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude: lat, longitude: lng, accuracy } = pos.coords;
          userPositionRef.current = { lat, lng };
          const ll = new G.LatLng(lat, lng);
          userMarkerRef.current.setPosition(ll);
          userCircleRef.current.setCenter(ll);
          userCircleRef.current.setRadius(accuracy);
          map.setCenter({ lat, lng });
          map.setZoom(16);
          setIsLocating(false);
          checkAlerts();
        },
        (err) => {
          console.error('Geolocation error:', err);
          showNotif('Unable to get your location. Please enable GPS.', 'error');
          setIsLocating(false);
        },
        { enableHighAccuracy: true }
      );

      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude: lat, longitude: lng, accuracy } = pos.coords;
          userPositionRef.current = { lat, lng };
          const ll = new G.LatLng(lat, lng);
          userMarkerRef.current.setPosition(ll);
          userCircleRef.current.setCenter(ll);
          userCircleRef.current.setRadius(accuracy);
          checkAlerts();
        },
        (err) => console.error('Watch error:', err),
        { enableHighAccuracy: true, maximumAge: 1000 }
      );
    } else {
      showNotif('Geolocation is not supported by your browser', 'error');
    }

    // Restore saved pins
    try {
      const saved = getCookie('utilixMapPins');
      if (saved) {
        JSON.parse(saved).forEach(p => createPin(p.id, p.position, p.name, p.color, p.alertDistance, p.alertSound));
      }
    } catch (e) { console.error('restore pins:', e); }
  }, [calculateRoute, checkAlerts, createPin, showNotif]);

  // Register map init callback
  useEffect(() => {
    if (window.google && window.google.maps) {
      initMap();
    } else {
      window.__mapInitCallback = initMap;
    }
    return () => {
      if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, [initMap]);

  // ---- Center on user ----
  const centerOnUser = useCallback(() => {
    if (userPositionRef.current && mapInstance.current) {
      mapInstance.current.setCenter(userPositionRef.current);
      mapInstance.current.setZoom(16);
    } else {
      showNotif('Location not available yet', 'warning');
    }
  }, [showNotif]);

  // ---- Route actions ----
  const handleAddDestination = useCallback(() => {
    const place = destinationAutocompleteRef.current?.getPlace();
    if (!place || !place.geometry) {
      showNotif('Please select a destination from the dropdown', 'warning'); return;
    }
    calculateRoute({ lat: place.geometry.location.lat(), lng: place.geometry.location.lng() });
  }, [calculateRoute, showNotif]);

  const handleRemoveDestination = useCallback(() => {
    if (directionsRendererRef.current) directionsRendererRef.current.setDirections({ routes: [] });
    if (destinationMarkerRef.current) { destinationMarkerRef.current.setMap(null); destinationMarkerRef.current = null; }
    currentRouteRef.current = null;
    currentRouteIndexRef.current = 0;
    if (destinationInputRef.current) destinationInputRef.current.value = '';
    setHasRoute(false);
    setHasAlternativeRoutes(false);
  }, []);

  const handleAnotherRoute = useCallback(() => {
    const route = currentRouteRef.current;
    if (!route || route.routes.length <= 1) return;
    currentRouteIndexRef.current = (currentRouteIndexRef.current + 1) % route.routes.length;
    directionsRendererRef.current.setDirections({
      ...route, routes: [route.routes[currentRouteIndexRef.current]],
    });
  }, []);

  // ---- Save / Delete pin ----
  const handleSavePin = useCallback(({ name, color, alertDistance, alertSound }) => {
    if (!editingPin) return;
    if (editingPin.isNew) {
      createPin(editingPin.id, editingPin.position, name, color, alertDistance, alertSound);
    } else {
      const pin = pinsRef.current.find(p => p.id === editingPin.id);
      if (pin) {
        const G = window.google.maps;
        pin.name = name; pin.color = color;
        pin.alertDistance = alertDistance; pin.alertSound = alertSound;
        const hex = COLOR_HEX[color] || COLOR_HEX.red;
        pin.marker.setIcon({ path: G.SymbolPath.BACKWARD_CLOSED_ARROW, scale: 7,
          fillColor: hex, fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 });
        pin.circle.setRadius(alertDistance);
        pin.circle.setOptions({ fillColor: hex, strokeColor: hex });
        checkAlerts();
      }
    }
    savePins();
    setEditingPin(null);
    showNotif('Pin saved!', 'success');
  }, [editingPin, createPin, checkAlerts, savePins, showNotif]);

  const handleDeletePin = useCallback(() => {
    if (!editingPin || editingPin.isNew) return;
    const pin = pinsRef.current.find(p => p.id === editingPin.id);
    if (pin) {
      pin.marker.setMap(null); pin.circle.setMap(null);
      if (alertsRef.current[pin.id]) {
        stopBeep(alertsRef.current[pin.id].interval);
        delete alertsRef.current[pin.id];
      }
      pinsRef.current = pinsRef.current.filter(p => p.id !== editingPin.id);
      savePins();
    }
    setEditingPin(null);
    showNotif('Pin deleted', 'info');
  }, [editingPin, stopBeep, savePins, showNotif]);

  const handleTestSound = useCallback(() => {
    // Read selected sound from form
    const sel = document.querySelector('#pin-sound');
    if (sel) createBeep(sel.value);
  }, [createBeep]);

  return (
    <div className="map-app">
      <Header
        searchInputRef={searchInputRef}
        destinationInputRef={destinationInputRef}
        hasRoute={hasRoute}
        hasAlternativeRoutes={hasAlternativeRoutes}
        onAddDestination={handleAddDestination}
        onRemoveDestination={handleRemoveDestination}
        onAnotherRoute={handleAnotherRoute}
        onStopAlarms={stopAllAlarms}
      />

      <div className="map-container">
        <div ref={mapRef} className="map-canvas" />

        {isLocating && (
          <div className="locating-indicator">
            <div className="locating-spinner" />
            <span>Getting your location…</span>
          </div>
        )}
      </div>

      <FloatingControls onCenterLocation={centerOnUser} />

      {editingPin && (
        <PinDetailsPanel
          pin={editingPin}
          onSave={handleSavePin}
          onDelete={handleDeletePin}
          onClose={() => setEditingPin(null)}
          onTestSound={handleTestSound}
        />
      )}

      {notification && (
        <Notification message={notification.msg} type={notification.type} />
      )}
    </div>
  );
}
