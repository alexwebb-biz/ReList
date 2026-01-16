# Database Schema Reference

Generated from Supabase on 2026-01-16

## Tables

### users
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary Key |
| email | string | |
| password_hash | string | |
| full_name | string | |
| location_postcode | string | |
| location_lat | number | |
| location_lng | number | |
| subscription_tier | string | |
| subscription_status | string | |
| stripe_customer_id | string | |
| stripe_subscription_id | string | |
| ai_credits_remaining | integer | |
| created_at | string | |
| updated_at | string | |
| last_login_at | string | |
| reset_token_hash | string | |
| reset_token_expires | string | |
| notification_email | boolean | |
| notification_push | boolean | |
| notification_telegram | boolean | |
| telegram_chat_id | string | |
| notification_discord | boolean | Enable Discord webhook notifications |
| discord_webhook_url | string | Discord webhook URL for notifications |

### alerts
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary Key |
| user_id | uuid | FK -> users.id |
| name | string | |
| keywords | array | |
| exclude_keywords | array | |
| platforms | array | |
| categories | array | |
| price_min | number | |
| price_max | number | |
| condition | array | |
| radius_miles | integer | |
| location_postcode | string | |
| check_frequency_minutes | integer | |
| is_active | boolean | |
| notification_channels | array | |
| last_checked_at | string | |
| created_at | string | |
| updated_at | string | |

### alert_results
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary Key |
| alert_id | uuid | FK -> alerts.id |
| external_id | string | |
| platform | string | |
| title | string | |
| description | string | |
| price | number | |
| currency | string | |
| location | string | |
| condition | string | |
| image_urls | array | |
| url | string | |
| seller_name | string | |
| posted_at | string | |
| notified_at | string | |
| is_read | boolean | |
| is_saved | boolean | |
| created_at | string | |

### inventory
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary Key |
| user_id | uuid | FK -> users.id |
| title | string | |
| description | string | |
| category | string | |
| brand | string | |
| condition | string | |
| purchase_price | number | |
| purchase_date | string | |
| purchase_platform | string | |
| purchase_location | string | |
| selling_price | number | |
| sold_price | number | |
| sold_date | string | |
| sold_platform | string | |
| fees_total | number | |
| postage_cost | number | |
| status | string | |
| images | array | |
| notes | string | |
| created_at | string | |
| updated_at | string | |

### listings
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary Key |
| inventory_id | uuid | FK -> inventory.id |
| platform | string | |
| external_id | string | |
| title | string | |
| description | string | |
| price | number | |
| url | string | |
| status | string | |
| listed_at | string | |
| sold_at | string | |
| views_count | integer | |
| created_at | string | |
| user_id | string | |
| notes | string | |
| updated_at | string | |

### cross_listings
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary Key |
| inventory_id | uuid | FK -> inventory.id |
| user_id | uuid | FK -> users.id |
| platform | string | The marketplace platform (eBay, Vinted, Depop, etc.) |
| external_listing_id | string | The listing ID on the external platform |
| title | string | |
| description | string | |
| price | number | |
| url | string | |
| status | string | Listing status: draft, active, sold, ended, error |
| error_message | string | |
| listed_at | string | |
| synced_at | string | Last time this listing was synced with the platform |
| created_at | string | |
| updated_at | string | |

### notifications
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary Key |
| user_id | uuid | FK -> users.id |
| type | string | |
| title | string | |
| message | string | |
| data | jsonb | |
| channels | array | |
| is_read | boolean | |
| sent_at | string | |

### watched_items
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary Key |
| user_id | string | |
| alert_result_id | uuid | FK -> alert_results.id |
| external_id | string | |
| platform | string | |
| title | string | |
| url | string | |
| image_url | string | |
| initial_price | number | |
| current_price | number | |
| target_price | number | |
| currency | string | |
| last_checked_at | string | |
| is_active | boolean | |
| created_at | string | |
| updated_at | string | |

### price_history
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary Key |
| watched_item_id | uuid | FK -> watched_items.id |
| price | number | |
| recorded_at | string | |

### ai_enhancements
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary Key |
| user_id | uuid | FK -> users.id |
| inventory_id | uuid | FK -> inventory.id |
| enhancement_type | string | |
| input_data | jsonb | |
| output_data | jsonb | |
| platform_variant | string | |
| cost_credits | integer | |
| processing_time_ms | integer | |
| created_at | string | |

### scraping_jobs
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary Key |
| alert_id | uuid | FK -> alerts.id |
| platform | string | |
| search_params | jsonb | |
| status | string | |
| results_count | integer | |
| error_message | string | |
| started_at | string | |
| completed_at | string | |
| created_at | string | |

### user_goals
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary Key |
| user_id | string | |
| goal_type | string | |
| target_value | number | |
| current_value | number | |
| period_start | string | |
| period_end | string | |
| is_achieved | boolean | |
| created_at | string | |
| updated_at | string | |

### user_reputation
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary Key |
| user_id | string | |
| reputation_score | integer | |
| deals_shared | integer | |
| deals_claimed | integer | |
| successful_sales | integer | |
| total_profit_generated | number | |
| total_commission_earned | number | |
| upvotes_received | integer | |
| downvotes_received | integer | |
| badges | jsonb | |
| created_at | string | |
| updated_at | string | |

### shared_deals
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary Key |
| user_id | string | |
| title | string | |
| description | string | |
| url | string | |
| image_url | string | |
| platform | string | |
| buy_price | number | |
| estimated_sell_price | number | |
| estimated_profit | number | |
| estimated_roi | number | |
| category | string | |
| location | string | |
| condition | string | |
| status | string | |
| claimed_by | string | |
| claimed_at | string | |
| actual_sell_price | number | |
| actual_profit | number | |
| commission_paid | number | |
| outcome_reported_at | string | |
| upvotes | integer | |
| downvotes | integer | |
| views | integer | |
| created_at | string | |
| expires_at | string | |
| updated_at | string | |

### deal_votes
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary Key |
| deal_id | uuid | FK -> shared_deals.id |
| user_id | string | |
| vote_type | string | |
| created_at | string | |

### deal_feed
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary Key |
| user_id | string | |
| title | string | |
| description | string | |
| url | string | |
| image_url | string | |
| platform | string | |
| buy_price | number | |
| estimated_sell_price | number | |
| estimated_profit | number | |
| estimated_roi | number | |
| category | string | |
| location | string | |
| condition | string | |
| status | string | |
| claimed_by | string | |
| claimed_at | string | |
| actual_sell_price | number | |
| actual_profit | number | |
| commission_paid | number | |
| outcome_reported_at | string | |
| upvotes | integer | |
| downvotes | integer | |
| views | integer | |
| created_at | string | |
| expires_at | string | |
| updated_at | string | |
| sharer_name | string | |
| sharer_email | string | |
| sharer_reputation | integer | |
| sharer_badges | jsonb | |
| user_vote | string | |
