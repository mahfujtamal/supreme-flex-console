# SupremeFlex — Campaign Engine Reference

## Tables
`campaign_master` → `campaign_targeting_rules` (geo + channel filter)  
`campaign_master` → `campaign_product_rules` → `campaign_discount_mappings` (component-level discounts)  
`campaign_master` → `coupons` (coupon-based trigger)  
`campaign_master` → `referral_programs` → `referral_redemptions` → `referral_reward_ledger`

## Campaign Trigger Types
`RULE_BASED` — auto-applies when targeting rules match  
`COUPON_BASED` — requires coupon_code entry  
`REFERRAL_BASED` — triggered by referral_code  
`HYBRID` — combination

## Targeting Rules (`campaign_targeting_rules`)
Fields: `network_zone_id`, `district_id`, `area_id`, `channel_id`, `sub_channel_id`, `network_type ENUM('4G','5G','ANY')`, `min_network_age_days`, `max_network_age_days`, `block_id`  
All fields nullable — omitted fields = no restriction on that dimension.

## Product Rules (`campaign_product_rules`)
`rule_type ENUM('EXCLUSIVE','UNAVAILABLE','DISCOUNT')`  
DISCOUNT rules reference `campaign_discount_mappings` for component-level BDT amounts.  
`applicable_components JSON` — which price components the discount applies to.

## Referral Reward Lifecycle
```
PENDING
  → AWAITING_ACTIVATION  (invoice paid, service not yet active)
  → AWAITING_PAYMENT     (service active, invoice not paid)
  → EARNED               (both active + paid)
  → APPLIED              (reward used)
  → FORCE_APPROVED       (admin override)
```
**Rule:** Only `check_and_release_referral_reward` stored procedure may transition status. Never update `reward_status` directly.

## Campaign Clone
`POST /api/campaigns/{id}/clone` — deep-copies campaign + all targeting/product rules. Use for A/B variants.

## `campaign_rank`
Lower number = higher priority. When multiple campaigns match, apply the one with the lowest rank.

## `on_ownership_transfer_behavior`
`KEEP` — campaign stays on order if ownership transfers  
`REMOVE` — campaign removed on transfer
