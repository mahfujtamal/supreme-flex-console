# SupremeFlex — Backoffice Admin UAT Guide

**Version:** 1.0  
**Date:** 2026-05-25  
**Audience:** Backoffice Admin (non-technical tester, no prior knowledge of the system)  
**System URL:** `http://localhost:3000` (staging URL provided by IT)

---

## Before You Start

**What is SupremeFlex?**  
SupremeFlex is the internal operations console for managing GPFI (Grameenphone FWA) customers, connections, products, orders, and field operations. You will use it to manage customers, set up products and prices, run campaigns, issue invoices, and oversee field activity.

**What you need:**
- A computer with a browser (Chrome or Firefox recommended)
- Your registered mobile number (provided by the system administrator)
- This document open alongside the browser

**How to mark results:**  
After each test step, write one of:
- PASS — the result matches exactly what is described
- FAIL — the result does not match; write down what actually happened
- BLOCKED — you could not complete the step (e.g., button missing, error appeared)

---

## Glossary

| Term | Meaning |
|------|---------|
| **Customer** | A person or business that has a GPFI connection |
| **Connection / Active Service** | A single GPFI line owned by a customer |
| **Anchor** | The physical device (CPE) tied to a connection |
| **DH** | Distribution House — the local delivery entity that handles CPE and field agents |
| **KAM** | Key Account Manager — manages B2B customers |
| **Channel / Sub-Channel** | Sales distribution partners |
| **Order** | A request to activate/change a product on a connection |
| **Addon** | An extra product added on top of a base plan |
| **OTT** | Over-The-Top streaming package (e.g., video streaming services) |
| **CPE** | Customer Premises Equipment — the physical router/device |
| **Real IP** | A dedicated public IP address assigned to a connection |
| **Invoice** | A bill generated for a customer |

---

## Module 1 — Login

### TC-1.1: Open the application
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Open browser and navigate to the system URL | A login page appears with the heading **SupremeFlex** and sub-heading **GPFI Operations Console** |
| 2 | Observe the page | There is a **Mobile number** field with a `+880` prefix already shown, and a **Send OTP** button |

### TC-1.2: Login with valid mobile number
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Type your 10-digit mobile number (digits only, e.g. `1711086859`) | Only digits are accepted; letters are automatically ignored |
| 2 | Click **Send OTP** | Button shows **Sending…** briefly, then the page changes to an OTP entry screen |
| 3 | Observe the OTP screen | Shows: *OTP sent to +880XXXXXXXXXX*, a 6-digit input field, a **Verify OTP** button, and a **Use a different number** link |
| 4 | Retrieve your 6-digit OTP (from SMS or as instructed by the system admin) | OTP received |
| 5 | Enter the 6-digit OTP | Only digits are accepted; the **Verify OTP** button activates after 6 digits are entered |
| 6 | Click **Verify OTP** | Page redirects to the main dashboard |

### TC-1.3: Wrong OTP handling
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Repeat TC-1.2 steps 1–3 to reach the OTP screen | OTP screen visible |
| 2 | Enter `000000` (an incorrect OTP) and click **Verify OTP** | An error message appears: *Invalid or expired OTP*. The OTP field is cleared. You stay on the OTP screen. |

### TC-1.4: Change number during OTP flow
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | On the OTP screen, click **Use a different number** | Returns to the mobile number entry screen with a blank field |

---

## Module 2 — Dashboard

### TC-2.1: Home dashboard loads
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | After login, observe the main page | A dashboard loads with summary cards or charts |
| 2 | Look at the left navigation bar | Menu items are visible for all major modules |

### TC-2.2: GPFI Operations Dashboard
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Click **GPFI Dashboard** in the navigation | A dashboard page loads with operational metrics |
| 2 | Observe the content | Cards and/or charts show connection stats, order volumes, or similar figures |

### TC-2.3: Manager Dashboard
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Click **Manager Dashboard** in the navigation | Dashboard loads with manager-level KPIs |

---

## Module 3 — Master Data

> **Purpose:** Set up foundational reference data — locations, delivery entities, sales channels — that the rest of the system depends on.

### TC-3.1: View Network Zones
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Click **Master Data** in the navigation | Opens the Master Data page with tabs across the top |
| 2 | Ensure **Network Zones** tab is selected (it is the default) | A table loads with columns: Name, Status, Created |
| 3 | Observe the rows | Each row shows a zone name and a coloured status badge (ACTIVE or INACTIVE) |

### TC-3.2: Search within a tab
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | On the Network Zones tab, type a few letters in the **Search** box | The table filters in real time to show only matching rows |
| 2 | Clear the search box | All rows return |

### TC-3.3: Bulk Insert — Network Zones
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Click **+ Bulk Insert** (top right of the tab) | A dialog box opens |
| 2 | Observe the dialog | Shows a CSV template with columns `name, status` and an upload or paste area |
| 3 | Close the dialog without uploading | Dialog closes; table is unchanged |

### TC-3.4: Navigate all 8 Master Data tabs
Click each tab and confirm the table loads with the expected columns:

| Tab | Expected Columns |
|-----|-----------------|
| Network Zones | Name, Status, Created |
| Districts | Name, Status |
| Areas | Name, District, Status |
| Channels | Name, Delivery Mode, Pull Mode, Status |
| Sub-Channels | Name, Channel, Delivery Ownership, Status |
| Distribution Houses | Name, Manager, Status |
| Field Agents | Name, DH, Status |
| KAMs | Name, Region, Status |

**Expected Result for each:** Table loads without error messages (may be empty if no records exist yet).

### TC-3.5: Pagination
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | On any tab with more than 20 rows, look at the bottom of the table | Pagination controls appear (Previous / Next or page numbers) |
| 2 | Click **Next** | The next 20 records load |

---

## Module 4 — Customers

### TC-4.1: View customer list
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Click **Customers** in the navigation | Customers page loads with a table |
| 2 | Observe columns | Name (blue clickable link), Mobile, Type (B2C / B2B), Status, Joined date |

### TC-4.2: Search customers
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Type a customer name or mobile number in the search box | Table filters to show matching customers |
| 2 | Clear the search | All customers return |

### TC-4.3: Open customer 360-view
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Click on any customer's name (blue link) | Navigates to the customer detail page |
| 2 | Observe the page | Shows the customer's profile information and their connection(s) |
| 3 | Look for sections or tabs | May include: Profile, Active Services, Order History, Invoices, Referrals |
| 4 | Click **Back** in the browser | Returns to the customer list |

### TC-4.4: Select multiple customers
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Click the checkbox on two or three customer rows | Checkboxes are ticked; a bulk action bar appears showing the count (e.g., **3 selected**) |
| 2 | Click **Clear Selection** | Checkboxes are cleared; the bulk action bar disappears |

---

## Module 5 — Assets

### TC-5.1: View assets list
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Click **Assets** in the navigation | A table loads showing CPE/hardware assets |
| 2 | Observe columns | Asset type, serial number or ID, assigned status, associated connection |

---

## Module 6 — Product Engine

### TC-6.1: View product tabs
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Click **Product Engine** in the navigation | Opens with multiple tabs |
| 2 | Click each tab | Each loads a table of products (Base Plans, Addon Plans, OTT Packages, CPE Models, or similar) |

### TC-6.2: Product table content
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | On the Base Plans tab | Table shows product name, code/SKU, data quota or description, status |
| 2 | Status badges | Products show ACTIVE or INACTIVE |

---

## Module 7 — Pricing Engine

### TC-7.1: View pricing table
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Click **Pricing Engine** in the navigation | A table loads with current pricing entries |
| 2 | Observe columns | Product, Price, Effective From, Effective To, Status |

### TC-7.2: Price versioning
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Look for a product with multiple rows | Multiple rows appear for the same product showing different effective date ranges |
| 2 | Identify the current active price | The row with the most recent Effective From date and an ACTIVE badge is the current price |

---

## Module 8 — Campaign Engine

### TC-8.1: Navigate campaign tabs
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Click **Campaign Engine** in the navigation | Opens with multiple tabs |
| 2 | Observe the tabs | Should include: Campaigns, Targeting Rules, Product Rules, Coupons, Referrals |
| 3 | Click each tab | Each loads a table; may be empty if no campaigns are configured yet |

### TC-8.2: Campaign list
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | On the Campaigns tab | Table shows campaign name, status, start and end dates |
| 2 | Active campaigns | Show an ACTIVE status badge |

---

## Module 9 — Invoicing

### TC-9.1: Navigate invoicing tabs
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Click **Invoicing** in the navigation | Opens with tabs |
| 2 | Click each tab | Each loads an invoice table (Invoices, One-Time Invoices, Summary Invoices, or similar) |

### TC-9.2: Invoice table content
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | On the main Invoices tab | Columns include Invoice ID, Customer, Amount, Status, Date |
| 2 | Status badges | Show PAID, UNPAID, CANCELLED, or similar |

### TC-9.3: Search invoices
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Type in the search box | Table filters by customer name or invoice ID |

---

## Module 10 — Accessories

### TC-10.1: View accessories
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Click **Accessories** in the navigation | A table loads |
| 2 | Observe columns | Accessory name, type, status, price, or similar |

---

## Module 11 — OTT Orders

### TC-11.1: View OTT orders
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Click **OTT Orders** in the navigation | Table loads with OTT order history |
| 2 | Observe columns | Customer, OTT package, Order date, Status |

### TC-11.2: Search OTT orders
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Enter a customer name in the search box | Table filters to matching records |

---

## Module 12 — Location Change

### TC-12.1: View location change requests
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Click **Location Change** in the navigation | Table loads |
| 2 | Observe columns | Customer/connection, current area, requested area, status, requested date |

### TC-12.2: Status badges
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Look at the Status column | Badges show PENDING, APPROVED, REJECTED, or COMPLETED |

---

## Module 13 — Real IP Assignments

### TC-13.1: View Real IP list
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Click **Real IP** in the navigation | Table loads |
| 2 | Observe columns | IP address, assigned connection, assigned date, status |

### TC-13.2: Status display
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Observe the status column | Badges show ACTIVE or RELEASED |

---

## Module 14 — Stock Transfers

### TC-14.1: View stock transfer log
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Click **Stock Transfers** in the navigation | Table loads |
| 2 | Observe columns | Transfer ID, From entity, To entity, Item count, Status, Date |

### TC-14.2: Search transfers
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Enter a search term | Table filters by transfer ID or entity name |

---

## Module 15 — Bulk Inwarding

### TC-15.1: Bulk inward page loads
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Click **Bulk Inwarding** in the navigation | Page loads with an import interface |
| 2 | Observe the controls | A file upload or paste area, a CSV template option, and a submit button are present |

### TC-15.2: Template visibility
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Look for a template download or header reference | The expected CSV column headers are shown or downloadable |

---

## Module 16 — Field Execution

### TC-16.1: View field execution records
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Click **Field Execution** in the navigation | Table loads with field task records |
| 2 | Observe columns | Task type, Field agent, Customer/connection, Status, Date |

### TC-16.2: Status badges
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Observe status column | Shows PENDING, IN_PROGRESS, COMPLETED, or FAILED |

---

## Module 17 — Operations

### TC-17.1: Operations page loads
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Click **Operations** in the navigation | Operations page loads without error |
| 2 | Observe the content | Shows pending tasks, order queues, or operational alerts |

---

## Module 18 — Audit Logs

### TC-18.1: View audit logs
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Click **Logs** in the navigation | Audit log table loads |
| 2 | Observe columns | Action type, Actor (which user did it), Target entity, Timestamp |

### TC-18.2: Search logs
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Enter a search term (e.g., your username or an action type) | Log entries filter to matching records |

---

## Module 19 — Governance

### TC-19.1: Governance page loads
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Click **Governance** in the navigation | Governance page loads without error |
| 2 | Observe content | Shows system configuration, role assignments, or compliance settings |

---

## Module 20 — Logout

### TC-20.1: Session ends correctly
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Find the logout option (usually top-right corner — profile icon or menu) | A logout button or option is visible |
| 2 | Click **Logout** | Redirected to the login page |
| 3 | Press the browser **Back** button | Does NOT return to the dashboard — stays on the login page or is redirected back to it |

---

## E2E Scenario — Full Admin Setup Walkthrough

Run this scenario after completing the individual module tests. It simulates a realistic first day of setup.

**Scenario:** Configure a new operational zone, verify it appears, explore a customer record, and confirm the action is logged.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Log in with your credentials | Dashboard is visible |
| 2 | Go to **Master Data → Network Zones** tab | Zones table loads; note the current number of rows |
| 3 | Click **+ Bulk Insert** | Dialog opens |
| 4 | Download or copy the CSV template | Template columns `name, status` are shown |
| 5 | Fill in one row: `UAT Test Zone, ACTIVE` and upload/paste it | Success message appears; dialog closes |
| 6 | Observe the Zones table | Row count increased by 1; new row "UAT Test Zone" with ACTIVE badge is visible |
| 7 | Go to **Master Data → Districts** | Districts table loads without error |
| 8 | Go to **Customers** | Customer list loads |
| 9 | Search for a customer by name | Matching customers appear |
| 10 | Click a customer name | Customer 360-view opens showing profile and connections |
| 11 | Press browser **Back** | Returns to customer list |
| 12 | Go to **Invoicing** | Invoice table loads |
| 13 | Go to **Audit Logs** | The bulk insert from step 5 appears as an entry with action type `BULK_IMPORT` |
| 14 | Log out | Returns to the login page |

---

## Known Limitations During Staging

The following features may show mock or empty data while IT connects live API endpoints. These are **not test failures**:

- GP Shop integration (addon order creation uses mock API)
- Real IP assignment via external API (mock)
- Location Change via external API (mock)
- OTP delivered via SMS (dev-peek method used instead during local testing)

When the IT team enables each live endpoint, these will be retested.

---

## How to Report a Failure

For every FAIL result, record:

1. **Test Case ID** (e.g., TC-4.3)
2. **Step number** where it failed
3. **What actually happened** — exact error message, wrong value, or missing element
4. **Screenshot** if possible

Send your findings to the project contact.

---

*UAT document v1.0 — SupremeFlex — 2026-05-25*
