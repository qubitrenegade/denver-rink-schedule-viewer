// Simple script to create basic PWA icons
// Run with: node scripts/create-icons.js

const fs = require('fs');

// Create a simple SVG icon
const svgIcon = `
<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#2563eb;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#0ea5e9;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="75" fill="url(#gradient)"/>
  <text x="256" y="280" font-family="Arial, sans-serif" font-size="180" font-weight="bold" text-anchor="middle" fill="white">🏒</text>
  <text x="256" y="380" font-family="Arial, sans-serif" font-size="48" font-weight="bold" text-anchor="middle" fill="white">RINK</text>
</svg>
`.trim();

// Write SVG file
fs.writeFileSync('/home/qbrd/denver-rink-schedule-viewer/public/icon.svg', svgIcon);

console.log('Created icon.svg - you can convert this to PNG using online tools or imagemagick');
console.log('For now, updating manifest to use SVG...');