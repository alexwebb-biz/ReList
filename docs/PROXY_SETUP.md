# Residential Proxy Setup for Vinted Scraper

This guide explains how to configure residential proxies to avoid 403 errors when scraping Vinted from AWS or datacenter IPs.

## Why You Need Proxies

Vinted blocks requests from:
- AWS/GCP/Azure datacenter IPs
- VPNs and known proxy IPs
- Requests without proper browser fingerprints

Residential proxies solve this by routing requests through real residential IPs.

## Quick Setup

### Option 1: Add Proxies Manually

1. Open your `.env` file
2. Add your proxies to the `RESIDENTIAL_PROXIES` variable:

```bash
RESIDENTIAL_PROXIES=residential.pingproxies.com:8138:98113_Pqewn_c_gb_city_manchester:Rbazlqiucx,residential.pingproxies.com:8138:username2:password2
```

Multiple proxies can be separated by commas.

### Option 2: Use the Helper Script (Recommended for 100 proxies)

1. Create a text file with your proxies (one per line):

```text
residential.pingproxies.com:8138:98113_Pqewn_c_gb_city_manchester:Rbazlqiucx
residential.pingproxies.com:8138:username2:password2
residential.pingproxies.com:8138:username3:password3
...
```

2. Run the helper script:

```bash
node scripts/add-proxies.js proxies.txt
```

3. Restart your server:

```bash
npm run dev
# or for production
npm start
```

## Proxy Format

Each proxy must follow this format:
```
host:port:username:password
```

Example:
```
residential.pingproxies.com:8138:98113_Pqewn_c_gb_city_manchester:Rbazlqiucx
```

## How It Works

1. **Random Rotation**: Each scraping session picks a random proxy from your pool
2. **Session Persistence**: The same proxy is used for all requests in a single session
3. **Automatic Retry**: If a proxy fails, a new session with a different proxy is created
4. **Caching**: Sessions are cached for 1.5 hours to reduce overhead

## Testing

To verify proxies are working:

1. Check server logs for:
```
Using proxy: residential.pingproxies.com:8138
```

2. Watch for successful scrapes:
```
Vinted page 1: 96 items (total: 96)
Found 96 total items on Vinted
```

## Troubleshooting

### Still Getting 403 Errors

1. **Check proxy credentials**: Make sure username/password are correct
2. **Verify proxy format**: Must be `host:port:username:password`
3. **Test proxy independently**: Use curl to test:
```bash
curl -x http://username:password@host:port https://www.vinted.co.uk
```

### No Proxies Loaded

Check server startup logs for:
```
Loaded X residential proxies
```

If you see `Loaded 0 residential proxies`, check:
- RESIDENTIAL_PROXIES is set in .env
- No extra spaces or invalid formatting
- Proxies are separated by commas or newlines

### Proxy Connection Timeout

- Your proxies might be rate-limited
- Increase delays between requests in `vintedScraper.ts`
- Contact your proxy provider about limits

## Proxy Providers

Your current provider: **PingProxies** (residential.pingproxies.com)

Other good providers:
- Bright Data
- Oxylabs
- SmartProxy
- ScraperAPI (handles anti-bot automatically)

## Performance Tips

1. **Use location-specific proxies**: UK proxies work best for Vinted UK
2. **Monitor success rate**: Track which proxies work best
3. **Rotate regularly**: Don't overuse the same proxy
4. **Respect rate limits**: Too many requests = bans

## Code Changes

The proxy integration includes:

1. **`server/src/config/proxies.ts`**: Proxy configuration and rotation logic
2. **`server/src/scrapers/vintedScraper.ts`**: Updated to use proxies
3. **`https-proxy-agent`**: NPM package for proxy support

All proxies are loaded from the `RESIDENTIAL_PROXIES` environment variable.
