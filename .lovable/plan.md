

# SupremeFlex - Enterprise FWA Campaign Engine

## Step 1: Global App Shell & Design System

Build the persistent app layout with the enterprise design brief:

- **Left Sidebar (280px, fixed):** Dark slate (#0F172A) background with navigation items for Dashboard, Master Data, Product Engine, Pricing Engine, Campaign Engine, Operations, Governance, and Logs. Each item has an icon + text label, with a left-border active indicator in blue.
- **Top Header (64px):** White bar with a centered search input and right-aligned admin profile dropdown (avatar + name).
- **Design tokens:** Update CSS variables and Tailwind config to match the design brief — Inter font, tight border radius (6px), slate palette, status accent colors.
- **Currency helper:** Utility function to format numbers with "BDT" suffix.

## Step 2: Supabase Database Schema (Phase 1)

Initialize Lovable Cloud and create 5 tables with RLS:

1. **user_account** — user_id (UUID PK), user_name, employee_id, email (unique), role_status (bool), created_at
2. **role_master** — role_id (UUID PK), role_name, role_description, created_at
3. **permission_master** — permission_id (UUID PK), permission_name, module, description
4. **role_permission** — composite key (role_id FK → role_master, permission_id FK → permission_master)
5. **user_role** — composite key (user_id FK → user_account, role_id FK → role_master)

RLS policies using a `has_role` security-definer function pattern to prevent recursive policy issues. Authenticated users can read; admin-level writes where appropriate.

## Step 3: Role Management Screen (Governance)

- Route: `/governance/roles`
- **Data table** reading from `role_master` — columns: Role Name, Description, Created At
- Compact density, full-width, paginated
- **"Create Role" button** opens a centered modal with form fields for role_name and role_description
- On submit, inserts into `role_master` and refreshes the table
- Toast notifications for success/error feedback

