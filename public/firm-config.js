/**
 * ============================================================
 *   FIRM CONFIGURATION FILE
 *   ⚠️  ONLY CHANGE THIS FILE FOR A NEW CLIENT / NEW FIRM
 * ============================================================
 *
 *  HOW TO USE:
 *  1. Change the values below to match the new firm.
 *  2. That's it. Every page reads from here automatically.
 *  3. DO NOT touch index.html, login.html, verification.html,
 *     app.js, server.js — they all read from this file.
 * ============================================================
 */

window.FIRM_CONFIG = {

  // ── BASIC IDENTITY ──────────────────────────────────────────
  /** Full legal name. Shown on login page, dashboard, letterhead, badges */
  name:          'Valley Security Service Agency',

  /** Short name for sidebar header (usually 1-2 words) */
  nameShort:     'VALLEY',

  /** Sub-title shown in sidebar under short name */
  nameSub:       'SECURITY AGENCY',

  /** Short code prefix used for employee IDs, e.g. "VSA" → VSA-1001 */
  /** ⚠️  This prefix is also used in server.js — update server.js line 421, 423, 429 to match */
  empIdPrefix:   'VSA',

  // ── CONTACT DETAILS ─────────────────────────────────────────
  /** Contact phone number, shown on letterhead and verification page */
  phone:         '7889311608',

  /** Official email, shown on letterhead and as login placeholder hint */
  email:         'VLLSCRTSERVICE@GMAIL.COM',

  /** Full address, shown on letterhead and verification page */
  address:       'SHAHEED GUNJ NATH COMPLEX SRINAGAR 190001',

  /** PSARA / business license number, shown on letterhead and verification page */
  licenseNo:     'PSA | L | 99 | JK |2024 | DEC | 3| 62',

  // ── DEFAULT ADMIN CREDENTIALS ───────────────────────────────
  /** Admin email (also shown as login placeholder hint in login.html) */
  adminEmail:    'vllscrtservice@gmail.com',

  // ── DEFAULT BADGE HEADER ────────────────────────────────────
  /** Default text pre-filled in the ID badge header text field */
  badgeHeader:   'VALLEY SECURITY AGENCY',

  // ── DASHBOARD SUBTITLE ──────────────────────────────────────
  /** Subtitle shown under "Dashboard Overview" in the main header */
  dashSubtitle:  'Valley Security operations control center.',

};
