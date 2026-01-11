// Platform fee structures for UK reselling platforms
// Fees are approximate and may vary based on seller status, categories, and promotions

export interface FeeBreakdown {
  platform_fee: number;
  payment_processing_fee: number;
  final_value_fee: number;
  total_fees: number;
  net_proceeds: number;
  fee_percentage: number;
}

export interface PlatformFeeConfig {
  name: string;
  // Final Value Fee (percentage of sale price)
  fvf_percent: number;
  // Minimum FVF
  fvf_min?: number;
  // Maximum FVF
  fvf_max?: number;
  // Payment processing fee (percentage)
  payment_percent: number;
  // Fixed payment fee (per transaction)
  payment_fixed: number;
  // Flat platform fee (if any)
  platform_flat?: number;
}

// Platform fee configurations (UK rates as of 2024)
const PLATFORM_FEES: Record<string, PlatformFeeConfig> = {
  'eBay': {
    name: 'eBay',
    fvf_percent: 12.8, // Standard FVF for most categories
    payment_percent: 0, // Included in FVF for managed payments
    payment_fixed: 0.30, // Fixed fee per order
  },
  'Vinted': {
    name: 'Vinted',
    fvf_percent: 0, // Vinted charges buyers, not sellers
    payment_percent: 0,
    payment_fixed: 0,
    platform_flat: 0, // Seller pays nothing on Vinted UK
  },
  'Depop': {
    name: 'Depop',
    fvf_percent: 10, // 10% selling fee
    payment_percent: 2.9, // PayPal/Depop Payments
    payment_fixed: 0.30,
  },
  'Facebook Marketplace': {
    name: 'Facebook Marketplace',
    fvf_percent: 0, // No fees for local pickup
    payment_percent: 2.9, // If using Facebook Pay for shipping
    payment_fixed: 0.30,
  },
  'Gumtree': {
    name: 'Gumtree',
    fvf_percent: 0, // No selling fees
    payment_percent: 0,
    payment_fixed: 0,
  },
  'Poshmark': {
    name: 'Poshmark',
    fvf_percent: 20, // 20% for items over £15
    fvf_min: 0,
    payment_percent: 0,
    payment_fixed: 0,
  },
  'Etsy': {
    name: 'Etsy',
    fvf_percent: 6.5, // Transaction fee
    payment_percent: 4, // Payment processing
    payment_fixed: 0.20,
    platform_flat: 0.16, // Listing fee
  },
  'Amazon': {
    name: 'Amazon',
    fvf_percent: 15, // Average referral fee (varies by category)
    payment_percent: 0,
    payment_fixed: 0.75, // Per item sold
  },
};

// Calculate fees for a sale
export const calculateFees = (
  soldPrice: number,
  platform: string,
  postage: number = 0
): FeeBreakdown => {
  const config = PLATFORM_FEES[platform] || PLATFORM_FEES['eBay']; // Default to eBay

  // Calculate Final Value Fee (on total including postage for most platforms)
  const fvfBase = platform === 'eBay' ? soldPrice + postage : soldPrice;
  let finalValueFee = (fvfBase * config.fvf_percent) / 100;

  // Apply min/max if configured
  if (config.fvf_min !== undefined) {
    finalValueFee = Math.max(finalValueFee, config.fvf_min);
  }
  if (config.fvf_max !== undefined) {
    finalValueFee = Math.min(finalValueFee, config.fvf_max);
  }

  // Calculate payment processing fee
  const paymentFee = ((soldPrice + postage) * config.payment_percent) / 100 + config.payment_fixed;

  // Platform flat fee
  const platformFee = config.platform_flat || 0;

  // Total fees
  const totalFees = finalValueFee + paymentFee + platformFee;

  // Net proceeds (before postage cost)
  const netProceeds = soldPrice - totalFees;

  return {
    platform_fee: Math.round(platformFee * 100) / 100,
    payment_processing_fee: Math.round(paymentFee * 100) / 100,
    final_value_fee: Math.round(finalValueFee * 100) / 100,
    total_fees: Math.round(totalFees * 100) / 100,
    net_proceeds: Math.round(netProceeds * 100) / 100,
    fee_percentage: Math.round((totalFees / soldPrice) * 100 * 10) / 10,
  };
};

// Get fee estimate for display purposes
export const getFeeEstimate = (
  price: number,
  platform: string
): { estimated_fees: number; estimated_net: number; fee_percent: number } => {
  const breakdown = calculateFees(price, platform);
  return {
    estimated_fees: breakdown.total_fees,
    estimated_net: breakdown.net_proceeds,
    fee_percent: breakdown.fee_percentage,
  };
};

// Get all supported platforms with their fee info
export const getSupportedPlatforms = (): Array<{
  name: string;
  fvf_percent: number;
  description: string;
}> => {
  return Object.entries(PLATFORM_FEES).map(([key, config]) => ({
    name: key,
    fvf_percent: config.fvf_percent,
    description: getFeeDescription(key),
  }));
};

// Get human-readable fee description
const getFeeDescription = (platform: string): string => {
  switch (platform) {
    case 'eBay':
      return '12.8% final value fee + £0.30 per order';
    case 'Vinted':
      return 'No seller fees (buyers pay)';
    case 'Depop':
      return '10% selling fee + 2.9% + £0.30 payment fee';
    case 'Facebook Marketplace':
      return 'No fees for local pickup, 2.9% + £0.30 for shipping';
    case 'Gumtree':
      return 'No selling fees';
    case 'Poshmark':
      return '20% commission on sales';
    case 'Etsy':
      return '6.5% transaction fee + 4% + £0.20 payment fee';
    case 'Amazon':
      return '~15% referral fee + £0.75 per item';
    default:
      return 'Fee structure unknown';
  }
};

export default {
  calculateFees,
  getFeeEstimate,
  getSupportedPlatforms,
};
