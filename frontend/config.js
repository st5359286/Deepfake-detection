// Configuration for SynthShield
// Uses global config object for all pages.
const API_URL = "http://localhost:3000";

const config = {
  API_URL,
};

if (typeof window !== 'undefined') {
  window.config = config;
}

console.log("Config loaded:", config.API_URL);
