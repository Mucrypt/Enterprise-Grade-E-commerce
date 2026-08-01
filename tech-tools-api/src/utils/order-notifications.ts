/**
 * Shared HTML fragment for the admin "new order" notification email.
 * Extracted so both order.controller.ts (legacy pre-payment order creation,
 * still used by mobile) and stripe.service.ts (webhook-driven confirmation
 * for the new checkout-session flow) can send an identical-looking admin
 * alert without stripe.service.ts statically importing order.controller.ts
 * (which itself dynamically imports stripe.service.ts -- a static import
 * back would create a circular dependency).
 */
export const buildOrderAdminAlertHtml = (data: {
  orderNumber: string
  customerName: string
  customerEmail: string
  grandTotal: number
  itemCount: number
}) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Order Received</title>
</head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background:#f8fafc;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;margin:0 auto;background:#ffffff;">
    <tr>
      <td style="background:linear-gradient(135deg,#111827 0%,#f97316 100%);padding:32px 40px;color:#ffffff;">
        <h1 style="margin:0;font-size:24px;font-weight:700;">New Order Received</h1>
        <p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,0.86);">Order ${
          data.orderNumber
        }</p>
      </td>
    </tr>
    <tr>
      <td style="padding:32px 40px;">
        <p style="margin:0 0 10px;color:#0f172a;font-size:14px;"><strong>Customer:</strong> ${
          data.customerName
        }</p>
        <p style="margin:0 0 10px;color:#0f172a;font-size:14px;"><strong>Email:</strong> ${
          data.customerEmail
        }</p>
        <p style="margin:0 0 10px;color:#0f172a;font-size:14px;"><strong>Items:</strong> ${
          data.itemCount
        }</p>
        <p style="margin:0 0 18px;color:#0f172a;font-size:14px;"><strong>Total:</strong> €${data.grandTotal.toFixed(
          2,
        )}</p>
        <a href="${
          process.env.ADMIN_DASHBOARD_URL ||
          'https://techtoolstore.com/admin/dashboard'
        }/orders" style="display:inline-block;background:#f97316;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;">Open orders dashboard</a>
      </td>
    </tr>
  </table>
</body>
</html>`
