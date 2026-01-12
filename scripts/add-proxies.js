#!/usr/bin/env node
/**
 * Helper script to add residential proxies to .env file
 *
 * Usage:
 *   node scripts/add-proxies.js proxies.txt
 *
 * Where proxies.txt contains one proxy per line in format:
 *   host:port:username:password
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const proxyFile = process.argv[2];

if (!proxyFile) {
  console.error('Usage: node scripts/add-proxies.js <proxy-file>');
  console.error('');
  console.error('Example proxy file format (one per line):');
  console.error('  residential.pingproxies.com:8138:username1:password1');
  console.error('  residential.pingproxies.com:8138:username2:password2');
  process.exit(1);
}

if (!fs.existsSync(proxyFile)) {
  console.error(`Error: File not found: ${proxyFile}`);
  process.exit(1);
}

// Read and validate proxies
const proxiesContent = fs.readFileSync(proxyFile, 'utf-8');
const proxies = proxiesContent
  .split('\n')
  .map(line => line.trim())
  .filter(line => line && !line.startsWith('#'));

console.log(`Found ${proxies.length} proxies in ${proxyFile}`);

// Validate format
const invalidProxies = [];
for (const proxy of proxies) {
  const parts = proxy.split(':');
  if (parts.length !== 4) {
    invalidProxies.push(proxy);
  }
}

if (invalidProxies.length > 0) {
  console.error('\nError: Invalid proxy format detected:');
  invalidProxies.forEach(p => console.error(`  ${p}`));
  console.error('\nExpected format: host:port:username:password');
  process.exit(1);
}

// Read .env file
const envPath = path.join(__dirname, '..', '.env');
if (!fs.existsSync(envPath)) {
  console.error('Error: .env file not found. Copy .env.example to .env first.');
  process.exit(1);
}

let envContent = fs.readFileSync(envPath, 'utf-8');

// Replace or add RESIDENTIAL_PROXIES
const proxyString = proxies.join(',');
const proxyLine = `RESIDENTIAL_PROXIES=${proxyString}`;

if (envContent.includes('RESIDENTIAL_PROXIES=')) {
  // Replace existing
  envContent = envContent.replace(/RESIDENTIAL_PROXIES=.*/g, proxyLine);
  console.log('\nUpdated RESIDENTIAL_PROXIES in .env');
} else {
  // Add new
  envContent += `\n\n# Residential Proxies\n${proxyLine}\n`;
  console.log('\nAdded RESIDENTIAL_PROXIES to .env');
}

// Write back
fs.writeFileSync(envPath, envContent);

console.log(`✓ Successfully added ${proxies.length} proxies to .env`);
console.log('\nYou can now restart your server to use the proxies.');
