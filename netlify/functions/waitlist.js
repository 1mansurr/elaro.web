const { Resend } = require('resend');
const { google } = require('googleapis');

const resend = new Resend(process.env.RESEND_API_KEY);

async function getGoogleSheetsClient() {
    const auth = new google.auth.GoogleAuth({
        credentials: {
            client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    
    const authClient = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: authClient });
    return sheets;
}

exports.handler = async (event, context) => {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
            },
            body: '',
        };
    }

    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }

    try {
        const { email } = JSON.parse(event.body);

        // Validate email
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return {
                statusCode: 400,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ error: 'Valid email is required' }),
            };
        }

        // Add to Google Sheets
        const sheets = await getGoogleSheetsClient();
        const spreadsheetId = process.env.GOOGLE_SHEET_ID;
        const range = 'Sheet1!A:B';

        const timestamp = new Date().toISOString();

        await sheets.spreadsheets.values.append({
            spreadsheetId,
            range,
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: [[email, timestamp]],
            },
        });

        // Send welcome email via Resend
        const { data, error } = await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL || 'ELARO <onboarding@resend.dev>',
            to: email,
            subject: 'Welcome to the ELARO Waitlist! 🎉',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                </head>
                <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h1 style="color: #1d8cf8; font-size: 32px; margin: 0;">ELARO</h1>
                    </div>
                    <div style="background: linear-gradient(135deg, #1d8cf8 0%, #1670c7 100%); padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 30px;">
                        <h2 style="color: white; margin: 0 0 15px 0; font-size: 28px;">Welcome to the Waitlist! 🎉</h2>
                        <p style="color: rgba(255, 255, 255, 0.95); margin: 0; font-size: 16px;">Thank you for joining us on this journey.</p>
                    </div>
                    <div style="background: #f8f9fa; padding: 25px; border-radius: 8px; margin-bottom: 30px;">
                        <p style="margin: 0 0 15px 0; font-size: 16px;">Hi there,</p>
                        <p style="margin: 0 0 15px 0; font-size: 16px;">We're thrilled that you've joined the ELARO waitlist! You're now part of an exclusive group that will be the first to know when we launch.</p>
                        <p style="margin: 0 0 15px 0; font-size: 16px;">ELARO is designed to help you never forget what you study. With intelligent reminders and spaced repetition, we'll help you stay organized and retain information better.</p>
                        <p style="margin: 0; font-size: 16px;">We'll notify you as soon as we're ready to launch. In the meantime, feel free to learn more about <a href="https://myelaro.com/how-it-works.html" style="color: #1d8cf8; text-decoration: none;">how ELARO works</a>.</p>
                    </div>
                    <div style="text-align: center; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                        <p style="margin: 0; color: #64748b; font-size: 14px;">Best regards,<br>The ELARO Team</p>
                    </div>
                </body>
                </html>
            `,
        });

        if (error) {
            console.error('Resend error:', error);
        }

        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                success: true,
                message: 'Successfully added to waitlist',
                emailSent: !error,
            }),
        };

    } catch (error) {
        console.error('Error adding to waitlist:', error);
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                error: 'Failed to add to waitlist. Please try again later.',
            }),
        };
    }
};

