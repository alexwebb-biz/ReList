// Residential proxy configuration
// Format: host:port:username:password

export interface ProxyConfig {
  host: string;
  port: number;
  username: string;
  password: string;
}

// Parse proxy string format: host:port:username:password
export const parseProxy = (proxyString: string): ProxyConfig | null => {
  const parts = proxyString.split(':');
  if (parts.length !== 4) {
    console.error('Invalid proxy format. Expected: host:port:username:password');
    return null;
  }

  const [host, portStr, username, password] = parts;
  const port = parseInt(portStr, 10);

  if (isNaN(port)) {
    console.error('Invalid proxy port:', portStr);
    return null;
  }

  return { host, port, username, password };
};

// Load proxies from environment variable or config
export const loadProxies = (): ProxyConfig[] => {
  const proxiesEnv = process.env.RESIDENTIAL_PROXIES || '';

  if (!proxiesEnv) {
    console.warn('No residential proxies configured. Set RESIDENTIAL_PROXIES environment variable.');
    return [];
  }

  // Split by newline or comma
  const proxyStrings = proxiesEnv.split(/[\n,]/).map(s => s.trim()).filter(s => s);

  const proxies: ProxyConfig[] = [];
  for (const proxyStr of proxyStrings) {
    const proxy = parseProxy(proxyStr);
    if (proxy) {
      proxies.push(proxy);
    }
  }

  console.log(`Loaded ${proxies.length} residential proxies`);
  return proxies;
};

// Simple round-robin proxy rotation
let currentProxyIndex = 0;
const proxies = loadProxies();

export const getNextProxy = (): ProxyConfig | null => {
  if (proxies.length === 0) {
    return null;
  }

  const proxy = proxies[currentProxyIndex];
  currentProxyIndex = (currentProxyIndex + 1) % proxies.length;
  return proxy;
};

// Get a random proxy (more unpredictable than round-robin)
export const getRandomProxy = (): ProxyConfig | null => {
  if (proxies.length === 0) {
    return null;
  }

  const randomIndex = Math.floor(Math.random() * proxies.length);
  return proxies[randomIndex];
};

// Convert proxy config to authentication string
export const getProxyAuth = (proxy: ProxyConfig): string => {
  return `${proxy.username}:${proxy.password}`;
};

// Convert proxy config to URL format
export const getProxyUrl = (proxy: ProxyConfig): string => {
  return `http://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`;
};

export default {
  loadProxies,
  getNextProxy,
  getRandomProxy,
  parseProxy,
  getProxyAuth,
  getProxyUrl,
};
