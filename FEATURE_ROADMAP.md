# ReList Feature Roadmap - Progress Tracker

## Completed Features

### 1. Cross-Platform Autopilot
- **Files**: `server/src/services/crossListingService.ts`, `server/src/routes/crossListing.ts`, `components/CrossListingManager.tsx`
- **Migration**: `006_cross_listings.sql`
- **Features**: One-click multi-marketplace listing, auto-sync, platform-optimized descriptions

### 2. Live Arbitrage Scanner
- **Files**: `server/src/services/arbitrageScannerService.ts`, `server/src/routes/arbitrage.ts`, `components/ArbitrageScanner.tsx`
- **Migration**: None needed (uses existing watchlist/inventory tables)
- **Features**: Real-time cross-platform price comparison, profit calculator, map view with Leaflet

### 3. Deal Sharing Marketplace
- **Files**: `server/src/services/dealSharingService.ts`, `server/src/routes/deals.ts`, `components/DealMarketplace.tsx`
- **Migration**: `005_deal_sharing.sql`
- **Features**: Community deal sharing, reputation system, 5% commissions, badges, leaderboard

---

## Remaining Features (7)

### 4. Photo-First Listing
AI vision for instant listing creation from photos.
- Groq Vision API (free tier) or Ollama local
- Auto-detect brand, category, condition
- Generate title/description from image

### 5. Smart Auto-Repricing
Automated price optimization rules.
- Age-based rules ("reduce 5% every 7 days")
- Competitor tracking
- Floor price protection

### 6. Barcode Scanner
Mobile UPC scanning for in-store sourcing.
- `quagga2` or `html5-qrcode` library
- UPCitemdb API (free 100/day)
- Instant profit lookup

### 7. AI Sourcing Assistant
Conversational research chat interface.
- Natural language queries
- RAG over inventory/sales data
- Groq or Ollama for inference

### 8. Authentication Network
Community-powered item verification.
- Expert verification workflow
- Expertise areas (Nike, Supreme, Vintage)
- PDF certificate generation

### 9. Sourcing Intelligence Hub
Crowdsourced location database with maps.
- Charity shops, car boots, auctions
- Ratings and reviews
- Restock schedules

### 10. Voice Input Mode
Hands-free inventory management.
- Web Speech API (built-in, free)
- Natural language commands
- "Add Nike Air Max size 10, paid 25 pounds"

---

## Technical Notes

### Database Migrations
Run in Supabase SQL editor in order:
1. `003_create_listings_table.sql`
2. `004_watched_items_and_price_history.sql`
3. `005_deal_sharing.sql`
4. `006_cross_listings.sql`

### Free API Strategy
| Feature | Primary API | Fallback |
|---------|-------------|----------|
| Vision AI | Groq (Llava) | Ollama, HuggingFace |
| Chat AI | Groq (Llama 3.1) | Ollama |
| Maps | OpenStreetMap + Leaflet | - |
| Barcode | UPCitemdb | eBay search |

### Navigation Added
- Cross-Post (Globe icon)
- Arbitrage (Zap icon)
- Deal Hub (Users icon)

---

*Full detailed plan: `.claude/plans/smooth-wiggling-crown.md`*
