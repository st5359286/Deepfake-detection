// Configuration for Deepfake Detector
// For production, set API_URL to your deployed backend URL
const API_URL = "http://localhost:3000";

// Make config globally available
window.config = {
  API_URL: API_URL,
};

console.log("Config loaded:", window.config.API_URL);
