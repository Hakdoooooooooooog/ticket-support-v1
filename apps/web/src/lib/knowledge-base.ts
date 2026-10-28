export interface KnowledgeArticle {
  id: string;
  slug: string;
  title: string;
  department: 'TECHNICAL_SUPPORT' | 'GENERAL';
  category: string;
  summary: string;
  readTime: string;
  tags: string[];
  steps: string[];
  keywords: string[];
  helpfulCount: number;
  unhelpfulCount: number;
  deflectionCount: number;
  updatedAt: string;
}

export const KNOWLEDGE_BASE_ARTICLES: KnowledgeArticle[] = [
  {
    id: 'kb-vpn-01',
    slug: 'vpn-connection-gateway-troubleshooting',
    title: 'VPN Connection & Gateway Troubleshooting',
    department: 'TECHNICAL_SUPPORT',
    category: 'Network & Connectivity',
    summary: 'Step-by-step resolution for VPN client timeouts, DNS routing stalls, and secure tunnel gateway connection failures.',
    readTime: '2 min read',
    tags: ['VPN', 'Network', 'DNS', 'Tunnel'],
    keywords: ['vpn', 'anyconnect', 'wireguard', 'tunnel', 'disconnect', 'gateway', 'timeout', 'network', 'dns', 'connect'],
    steps: [
      'Disconnect your active VPN session and completely quit the VPN client from the system tray.',
      'Open a terminal or PowerShell as Administrator and run: "ipconfig /flushdns" (or "sudo dscacheutil -flushcache" on macOS).',
      'Toggle your Wi-Fi or Ethernet adapter off for 5 seconds and reconnect.',
      'Launch the VPN client, ensure the gateway is set to "vpn.company.internal", and authenticate with your current 2FA code.',
      'If error 412 or handshake failure persists, reboot your laptop to release locked TAP/TUN adapter drivers.',
    ],
    helpfulCount: 42,
    unhelpfulCount: 2,
    deflectionCount: 38,
    updatedAt: '2026-10-27T10:00:00.000Z',
  },
  {
    id: 'kb-sso-02',
    slug: 'sso-2fa-reset-authentication-guide',
    title: 'SSO & Two-Factor Authentication (2FA) Reset Guide',
    department: 'TECHNICAL_SUPPORT',
    category: 'Identity & Access',
    summary: 'Self-service procedure to clear corrupted identity sessions or register a replacement 2FA authenticator device.',
    readTime: '3 min read',
    tags: ['SSO', '2FA', 'MFA', 'Security'],
    keywords: ['sso', '2fa', 'mfa', 'login', 'authenticator', 'otp', 'lockout', 'password', 'token', 'auth'],
    steps: [
      'Open an Incognito or Private browsing window to rule out expired cookies or corrupted local browser storage.',
      'Navigate to the corporate Identity Management portal: https://auth.company.internal/myaccount.',
      'On the verification prompt, click "Try another way" to authenticate via SMS backup or hardware FIDO2 key.',
      'Once signed in, access "Security Info" to register your new mobile authenticator app (Google Authenticator or Microsoft Authenticator).',
      'If your account is temporarily locked due to repeated incorrect codes, the automated security cooldown expires after 15 minutes.',
    ],
    helpfulCount: 35,
    unhelpfulCount: 1,
    deflectionCount: 29,
    updatedAt: '2026-10-26T14:30:00.000Z',
  },
  {
    id: 'kb-email-03',
    slug: 'email-sync-outlook-client-connection-errors',
    title: 'Email Sync & Outlook Client Connection Errors',
    department: 'TECHNICAL_SUPPORT',
    category: 'Mail & Communications',
    summary: 'Fix Exchange connection drops, "Working Offline" status, and stale mail folder synchronization in Outlook and Webmail.',
    readTime: '2 min read',
    tags: ['Outlook', 'Email', 'Exchange', 'Sync'],
    keywords: ['email', 'outlook', 'exchange', 'mail', 'sync', 'offline', 'disconnected', 'inbox', 'smtp'],
    steps: [
      'Check the Outlook status bar at the bottom right. If it says "Disconnected" or "Working Offline", click the "Send / Receive" ribbon and toggle "Work Offline" off.',
      'Click "Update Folder" under the Send / Receive tab to force an immediate IMAP/Exchange synchronization.',
      'If prompted with a persistent password dialog, open Windows Credential Manager and remove entries under "MicrosoftOffice16_Data".',
      'Restart Outlook in Safe Mode by running "outlook.exe /safe" to verify whether a third-party add-in is causing mailbox stalls.',
    ],
    helpfulCount: 28,
    unhelpfulCount: 3,
    deflectionCount: 22,
    updatedAt: '2026-10-25T09:15:00.000Z',
  },
  {
    id: 'kb-docker-04',
    slug: 'docker-desktop-memory-allocation-wsl-troubleshooting',
    title: 'Docker Desktop Memory & WSL2 Engine Troubleshooting',
    department: 'TECHNICAL_SUPPORT',
    category: 'Developer Environment',
    summary: 'Resolve Docker engine daemon crashes, out-of-memory container terminations, and WSL2 integration hang-ups.',
    readTime: '3 min read',
    tags: ['Docker', 'DevOps', 'WSL2', 'Containers'],
    keywords: ['docker', 'container', 'wsl', 'wsl2', 'memory', 'oom', 'build', 'daemon', 'crash'],
    steps: [
      'Open Docker Desktop Settings > Resources > Advanced and ensure at least 4 GB RAM and 2 virtual CPUs are allocated.',
      'In PowerShell, run "wsl --status" to verify WSL2 kernel version is up to date and default distribution is running.',
      'Reclaim orphaned container layers and dangling volumes by running: "docker system prune -af --volumes".',
      'Create or update "C:\\Users\\<user>\\.wslconfig" with "[wsl2] memory=8GB" to cap background Windows host RAM consumption.',
      'Restart the Docker Desktop service from the taskbar tray icon.',
    ],
    helpfulCount: 31,
    unhelpfulCount: 0,
    deflectionCount: 26,
    updatedAt: '2026-10-24T16:45:00.000Z',
  },
  {
    id: 'kb-dock-05',
    slug: 'external-monitor-and-usb-c-docking-station-setup',
    title: 'External Monitor & USB-C Docking Station Setup',
    department: 'TECHNICAL_SUPPORT',
    category: 'Hardware & Peripherals',
    summary: 'Fix dual display detection issues, flickering monitors, and USB-C peripheral dropouts on corporate laptops.',
    readTime: '2 min read',
    tags: ['Hardware', 'Monitors', 'Display', 'Docking'],
    keywords: ['monitor', 'display', 'dock', 'usb-c', 'hdmi', 'flicker', 'dual screen', 'resolution', 'screen'],
    steps: [
      'Unplug the USB-C dock connector from your laptop, wait 5 seconds, and firmly reseat it in a Thunderbolt-enabled port.',
      'Press Windows + P and verify your projection setting is configured to "Extend" rather than "PC screen only".',
      'Power cycle the docking station by disconnecting its AC power brick for 15 seconds.',
      'Navigate to Windows Settings > System > Display > Advanced Display and confirm refresh rate matches monitor native spec (60Hz or 120Hz).',
    ],
    helpfulCount: 19,
    unhelpfulCount: 1,
    deflectionCount: 15,
    updatedAt: '2026-10-23T11:20:00.000Z',
  },
  {
    id: 'kb-invoice-06',
    slug: 'invoice-and-billing-receipt-retrieval-guide',
    title: 'Invoice & Billing Receipt Retrieval Guide',
    department: 'GENERAL',
    category: 'Billing & Accounting',
    summary: 'Instant self-service retrieval for past monthly SaaS subscription invoices, tax receipts, and payment method updates.',
    readTime: '2 min read',
    tags: ['Billing', 'Invoice', 'Finance', 'Receipt'],
    keywords: ['invoice', 'billing', 'receipt', 'charge', 'payment', 'tax', 'vat', 'statement', 'accounting', 'bill'],
    steps: [
      'Sign in to the Customer Billing Portal at https://billing.company.internal.',
      'Select "Invoices & Receipts" from the main navigation menu.',
      'Locate the billing cycle by date and click "Download PDF" for an itemized, VAT-compliant tax receipt.',
      'To update the billing email address for automated delivery, open "Billing Contacts" and enter your AP finance alias.',
    ],
    helpfulCount: 52,
    unhelpfulCount: 2,
    deflectionCount: 47,
    updatedAt: '2026-10-27T08:00:00.000Z',
  },
  {
    id: 'kb-license-07',
    slug: 'software-license-and-saas-tool-provisioning',
    title: 'Software License & SaaS Tool Provisioning',
    department: 'GENERAL',
    category: 'Software & Tools',
    summary: 'Guidelines, pre-approved software catalogs, and turnaround times for Slack, GitHub, Figma, and IDE licenses.',
    readTime: '3 min read',
    tags: ['Software', 'License', 'Figma', 'GitHub', 'SaaS'],
    keywords: ['license', 'software', 'saas', 'figma', 'github', 'slack', 'jetbrains', 'provision', 'access'],
    steps: [
      'Check the Enterprise App Catalog on the company intranet for automatic pre-approved developer and design tools.',
      'Standard tier requests (GitHub Copilot, Slack Pro, Figma Editor) are auto-provisioned within 2 business hours of manager approval.',
      'For specialized or paid tools not listed in the catalog, obtain cost center approval from your budget holder before submitting an IT ticket.',
    ],
    helpfulCount: 39,
    unhelpfulCount: 1,
    deflectionCount: 34,
    updatedAt: '2026-10-26T12:00:00.000Z',
  },
  {
    id: 'kb-perm-08',
    slug: 'account-role-permissions-and-access-escalation',
    title: 'Account Role Permissions & Access Escalation',
    department: 'GENERAL',
    category: 'Security & Compliance',
    summary: 'How to request temporary elevated privileges, database staging access, or IT Admin console delegation.',
    readTime: '2 min read',
    tags: ['Permissions', 'Access', 'Security', 'Roles'],
    keywords: ['permission', 'access', 'role', '403', 'forbidden', 'unauthorized', 'escalate', 'admin', 'privilege'],
    steps: [
      'Verify that your account has completed the annual Security & Data Privacy compliance module.',
      'Identify the exact system resource required (e.g., Staging DB Read-Only, AWS Developer Role, or Admin Helpdesk Operator).',
      'Submit a formal access request with business justification and include your manager as an approval CC.',
      'Temporary elevated permissions are granted via Just-In-Time (JIT) access tokens valid for 8 hours.',
    ],
    helpfulCount: 27,
    unhelpfulCount: 2,
    deflectionCount: 20,
    updatedAt: '2026-10-25T15:10:00.000Z',
  },
  {
    id: 'kb-wifi-09',
    slug: 'office-guest-wifi-pass-and-network-policy',
    title: 'Office Guest Wi-Fi Pass & Network Policy',
    department: 'GENERAL',
    category: 'Facilities & Visitors',
    summary: 'Quick guide for setting up secure Wi-Fi access codes for visiting clients, external partners, and vendors.',
    readTime: '1 min read',
    tags: ['Wi-Fi', 'Guest', 'Visitor', 'Facilities'],
    keywords: ['wifi', 'guest', 'network', 'visitor', 'passcode', 'internet', 'wireless', 'office'],
    steps: [
      'Instruct visitors to connect their device to the "Company-Guest" wireless network (SSID).',
      'The browser will open a captive portal automatically. Enter your sponsor employee email address or scan the lobby QR code.',
      'Guest passes remain valid for 24 hours. For multi-day workshops, reception can issue multi-day conference vouchers.',
    ],
    helpfulCount: 24,
    unhelpfulCount: 0,
    deflectionCount: 21,
    updatedAt: '2026-10-24T10:00:00.000Z',
  },
  {
    id: 'kb-asset-10',
    slug: 'it-hardware-refresh-and-equipment-return-policy',
    title: 'IT Hardware Refresh & Equipment Return Policy',
    department: 'GENERAL',
    category: 'Asset Management',
    summary: 'Standard 3-year laptop refresh schedule, broken equipment replacement, and prepaid return shipping procedures.',
    readTime: '3 min read',
    tags: ['Hardware', 'Refresh', 'Laptop', 'Equipment'],
    keywords: ['laptop', 'refresh', 'hardware', 'return', 'equipment', 'asset', 'upgrade', 'replacement'],
    steps: [
      'Company laptops become eligible for standard lifecycle refresh after 36 months of active service.',
      'Upon receiving your replacement device, transfer all local data to corporate cloud storage (OneDrive / Google Workspace).',
      'Pack your decommissioned hardware into the prepaid return kit provided and drop it off at any authorized courier depot within 14 days.',
    ],
    helpfulCount: 33,
    unhelpfulCount: 1,
    deflectionCount: 28,
    updatedAt: '2026-10-23T14:00:00.000Z',
  },
];

export interface ScoredKnowledgeArticle {
  article: KnowledgeArticle;
  score: number;
}

/**
 * Searches and scores knowledge base articles against a query string and optional department.
 * High score implies strong keyword/title match suitable for proactive deflection.
 */
export function searchKnowledgeBaseArticles(
  articles: KnowledgeArticle[],
  query: string,
  department?: string,
): ScoredKnowledgeArticle[] {
  let list = [...articles];

  if (department && department !== 'ALL') {
    // We keep all articles, but boost department matches or prioritize them
  }

  const cleanQuery = query.trim().toLowerCase();
  if (!cleanQuery) {
    if (department && department !== 'ALL') {
      list = list.filter((a) => a.department === department);
    }
    return list.map((article) => ({ article, score: 0 }));
  }

  const tokens = cleanQuery
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2);

  if (tokens.length === 0) {
    return [];
  }

  const scored: ScoredKnowledgeArticle[] = [];

  for (const article of list) {
    let score = 0;
    const titleLower = article.title.toLowerCase();
    const summaryLower = article.summary.toLowerCase();
    const tagsLower = article.tags.map((t) => t.toLowerCase());
    const keywordsLower = article.keywords.map((k) => k.toLowerCase());

    for (const token of tokens) {
      if (titleLower.includes(token)) score += 10;
      if (keywordsLower.some((k) => k === token || k.includes(token))) score += 8;
      if (tagsLower.some((t) => t === token || t.includes(token))) score += 5;
      if (summaryLower.includes(token)) score += 3;
    }

    if (department && department !== 'ALL' && article.department === department) {
      if (score > 0) score += 4;
    }

    if (score > 0) {
      scored.push({ article, score });
    }
  }

  return scored.sort((a, b) => b.score - a.score);
}
