import { createTransport, getTestMessageUrl } from 'nodemailer';

const transport = createTransport({
  host: process.env.MAIL_HOST,
  port: process.env.MAIL_PORT,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

function emailFrame(text: string) {
  return `
      <div className="email" 
        style="padding: 20px; font-family: sans-serif; line-height: 2; font-size: 1rem;">
        <h2>Hello,</h2>
        <p>${text}</p>
        <p>lifeseed.online</p>
      </div>
    `;
}

export interface MailResponse {
  accepted?: string[] | null;
  rejected?: null[] | null;
  envelopeTime: number;
  messageTime: number;
  messageSize: number;
  response: string;
  envelope: Envelope;
  messageId: string;
}
export interface Envelope {
  from: string;
  to?: string[] | null;
}

export async function sendPasswordResetEmail(
  resetToken: string,
  to: string
): Promise<void> {
  // email the user a token
  const info = (await transport.sendMail({
    to,
    from: 'test@example.com',
    subject: 'lifeseed.online password reset token',
    html: emailFrame(`By clicking the following link you can reset you password.
        <a href="${process.env.FRONTEND_URL}/reset?token=${resetToken}">Reset password</a>
      `),
  })) as MailResponse;
  if (process.env.MAIL_USER.includes('ethereal.email')) {
    console.log(`💌 Message Sent!  Preview it at ${getTestMessageUrl(info)}`);
  }
}
