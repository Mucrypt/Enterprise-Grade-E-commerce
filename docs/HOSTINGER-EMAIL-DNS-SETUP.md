# Hostinger Email DNS Setup Guide for techtoolstore.com

Complete your Hostinger email setup by adding these DNS records in Cloudflare.

## 🚨 Current Status

Your Hostinger dashboard shows 4 incomplete DNS settings:

1. ❌ MX Record - Required to receive emails
2. ❌ SPF Record - Prevents email spoofing
3. ❌ DKIM Record - Authenticates your emails
4. ❌ DMARC Record - Handles failed authentication

## 📋 Step-by-Step Setup

### Step 1: Log into Cloudflare

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com)
2. Select **techtoolstore.com**
3. Click **DNS** in the sidebar

---

### Step 2: Add MX Record (Receive Emails)

| Field            | Value                 |
| ---------------- | --------------------- |
| **Type**         | MX                    |
| **Name**         | @                     |
| **Mail server**  | mx1.hostinger.com     |
| **Priority**     | 10                    |
| **Proxy status** | DNS only (gray cloud) |

> **Important:** MX records MUST be DNS only, not proxied.

Click **Save** then add a second MX record:

| Field            | Value                 |
| ---------------- | --------------------- |
| **Type**         | MX                    |
| **Name**         | @                     |
| **Mail server**  | mx2.hostinger.com     |
| **Priority**     | 20                    |
| **Proxy status** | DNS only (gray cloud) |

---

### Step 3: Add SPF Record (Prevent Spoofing)

| Field       | Value                                    |
| ----------- | ---------------------------------------- |
| **Type**    | TXT                                      |
| **Name**    | @                                        |
| **Content** | `v=spf1 include:_spf.hostinger.com ~all` |

This tells email servers which servers can send email for your domain.

---

### Step 4: Add DKIM Record

1. Go to Hostinger → Emails → Domain settings
2. Click on "Stop others from sending fake emails using your domain"
3. Copy the DKIM record value (long string starting with `v=DKIM1;`)

Add in Cloudflare:

| Field       | Value                                 |
| ----------- | ------------------------------------- |
| **Type**    | TXT                                   |
| **Name**    | `default._domainkey`                  |
| **Content** | (paste the DKIM value from Hostinger) |

**Example DKIM value:**

```
v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC...
```

---

### Step 5: Add DMARC Record

| Field       | Value                                                  |
| ----------- | ------------------------------------------------------ |
| **Type**    | TXT                                                    |
| **Name**    | `_dmarc`                                               |
| **Content** | `v=DMARC1; p=none; rua=mailto:admin@techtoolstore.com` |

**DMARC policy options:**

- `p=none` - Monitor only (recommended to start)
- `p=quarantine` - Send failures to spam
- `p=reject` - Reject failed emails

---

## ✅ Verification

After adding all records, wait 15-30 minutes, then:

1. Go to Hostinger → Emails → Domain settings
2. Click **Check status** button
3. All 4 items should show green checkmarks ✅

### Test Your Email

Send a test email from noreply@techtoolstore.com to [mail-tester.com](https://www.mail-tester.com/)

---

## 📧 Email Aliases to Create in Hostinger

Go to Hostinger → Emails → **Email Alias** and create:

| Alias                     | Forwards To     |
| ------------------------- | --------------- |
| support@techtoolstore.com | Your main inbox |
| orders@techtoolstore.com  | Your main inbox |
| billing@techtoolstore.com | Your main inbox |
| returns@techtoolstore.com | Your main inbox |
| info@techtoolstore.com    | Your main inbox |

Or create as separate **Mailboxes** if you want individual inboxes.

---

## 🔧 Server Configuration

Add these to your production `.env` file:

```env
# Email Configuration (Hostinger SMTP)
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=noreply@techtoolstore.com
SMTP_PASS=your_email_password
SMTP_FROM=noreply@techtoolstore.com

# Frontend URL for email links
FRONTEND_URL=https://techtoolstore.com
```

Then rebuild the API container:

```bash
docker-compose -f infrastructure/docker-compose.prod.yml up -d --build tech-tools-api
```

---

## 🎯 Summary of Cloudflare DNS Records

| Type | Name                | Content                                              | Proxy    |
| ---- | ------------------- | ---------------------------------------------------- | -------- |
| MX   | @                   | mx1.hostinger.com (Priority: 10)                     | DNS only |
| MX   | @                   | mx2.hostinger.com (Priority: 20)                     | DNS only |
| TXT  | @                   | v=spf1 include:\_spf.hostinger.com ~all              | -        |
| TXT  | default.\_domainkey | (DKIM from Hostinger)                                | -        |
| TXT  | \_dmarc             | v=DMARC1; p=none; rua=mailto:admin@techtoolstore.com | -        |

---

## 🔒 Security Tips

1. **Use App Passwords**: If available, create app-specific passwords for SMTP
2. **Monitor DMARC Reports**: Add `rua=mailto:admin@techtoolstore.com` to receive reports
3. **Upgrade DMARC Policy**: After testing, change `p=none` to `p=quarantine` or `p=reject`
4. **Rate Limit Contact Form**: Already implemented (5 submissions per 15 minutes)

---

## ❓ Troubleshooting

### Emails going to spam?

- Check all DNS records are correctly set
- Ensure DKIM is properly configured
- Test with mail-tester.com

### Can't send emails?

- Verify SMTP credentials in .env
- Check if Hostinger requires SSL (port 465) vs TLS (port 587)
- Ensure firewall allows outbound port 465/587

### Not receiving emails?

- Verify MX records are set to DNS only (not proxied)
- Check Hostinger mailbox quota
- Look in spam folder

---

## 📞 Support

- **Hostinger Support**: [hpanel.hostinger.com](https://hpanel.hostinger.com) → Ask AI / Live Chat
- **Cloudflare Docs**: [developers.cloudflare.com](https://developers.cloudflare.com/dns)
