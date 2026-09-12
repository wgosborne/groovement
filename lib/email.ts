import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendAdminNotificationEmail(
  userEmail: string,
  userName: string,
  referralSource: string | null,
  requestReason: string | null
): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL;

  if (!adminEmail) {
    throw new Error(
      'ADMIN_EMAIL environment variable is not set. ' +
      'Admin notification emails cannot be sent.'
    );
  }

  const subject = `New Groovement signup request from ${userName}`;
  const body = `
New user signup request:

Name: ${userName}
Email: ${userEmail}
Referral Source: ${referralSource || '(not provided)'}
Request Reason: ${requestReason || '(not provided)'}

Visit your admin panel to approve or deny this request:
https://groovement.dev/admin
  `.trim();

  try {
    await resend.emails.send({
      from: 'noreply@groovement.dev',
      to: adminEmail,
      subject,
      text: body,
    });
  } catch (error) {
    console.error('Failed to send admin notification email:', error);
    throw error;
  }
}

export async function sendApprovalEmail(
  userEmail: string,
  userName: string,
  connectToken: string
): Promise<void> {
  const connectUrl = `https://groovement.dev/connect?token=${connectToken}`;
  const subject = 'Your Groovement access is approved!';
  const body = `
Hi ${userName},

Your request for access to Groovement has been approved!

Click the link below to connect your Strava and Spotify accounts:
${connectUrl}

This link is unique to your account and will expire in 24 hours.

Welcome to Groovement!
  `.trim();

  try {
    await resend.emails.send({
      from: 'noreply@groovement.dev',
      to: userEmail,
      subject,
      text: body,
    });
  } catch (error) {
    console.error('Failed to send approval email:', error);
    throw error;
  }
}
