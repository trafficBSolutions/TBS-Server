const { transporter } = require('../utils/emailConfig');
const { generateQuotePdf } = require('../services/quotePDF');
const path = require('path');
const fs = require('fs');

function toDataUri(absPath) {
  try {
    if (!fs.existsSync(absPath)) return '';
    const ext = path.extname(absPath).toLowerCase();
    const mime = ext === '.svg' ? 'image/svg+xml' : ext === '.png' ? 'image/png' : 'image/jpeg';
    const buf = fs.readFileSync(absPath);
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch {
    return '';
  }
}

const submitQuote = async (req, res) => {
    try {
        const { 
            date, company, customer, address, city, state, zip, email, phone,
            taxRate, isTaxExempt, payMethod, rows, computed
        } = req.body;

        if (!email) {
            return res.status(400).json({ error: "Email is required" });
        }

        const pdfBuffer = await generateQuotePdf(req.body);
        const tbsLogo = toDataUri(path.resolve(__dirname, '../public/TBSPDF7.svg'));
        const mxLogo = toDataUri(path.resolve(__dirname, '../public/Material WorX Tan.svg'));

        const mailOptions = {
            from: 'Traffic & Barrier Solutions LLC <tbsolutions9@gmail.com>',
            to: email,
            bcc: [
                { name: 'Traffic & Barrier Solutions LLC', address: 'tbsolutions9@gmail.com' },
            ],
            subject: `Quote for ${customer} - ${company}`,
            html: `
            <!DOCTYPE html>
            <html>
            <body style="font-family:Arial,sans-serif;margin:0;padding:20px;background:#f5f5f5;">
                <div style="max-width:600px;margin:0 auto;background:#fff;padding:30px;border-radius:8px;">
                    <div style="text-align:center;margin-bottom:20px;">
                        ${tbsLogo ? `<img src="${tbsLogo}" alt="TBS" style="height:60px;margin:0 10px;"/>` : ''}
                        ${mxLogo ? `<img src="${mxLogo}" alt="Material WorX" style="height:60px;margin:0 10px;"/>` : ''}
                    </div>
                    
                    <h2 style="color:#17365D;margin-top:0;">Dear ${customer},</h2>
                    
                    <p style="font-size:16px;line-height:1.6;">
                        Thank you for your interest in Traffic & Barrier Solutions! Please see the attached quote for your project.
                    </p>
                    
                    <p style="font-size:16px;line-height:1.6;">
                        If you have any questions or would like to proceed, please email us or call <strong>706-263-0175</strong>.
                    </p>

                    <div style="margin-top:30px;padding-top:20px;border-top:1px solid #ddd;font-size:14px;color:#666;">
                        <p style="margin:5px 0;"><strong>Bryson C Davis</strong></p>
                        <p style="margin:5px 0;">Traffic & Barrier Solutions, LLC</p>
                        <p style="margin:5px 0;">723 N Wall Street, Calhoun, GA 30701</p>
                        <p style="margin:5px 0;">Cell: 706-263-0175</p>
                        <p style="margin:5px 0;">www.trafficbarriersolutions.com</p>
                    </div>
                </div>
            </body>
            </html>`,
            attachments: [
                {
                    filename: `TBS_Quote_${customer.replace(/\s+/g, '_')}_${date}.pdf`,
                    content: pdfBuffer
                }
            ]
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.log('Error sending quote email:', error);
                return res.status(500).json({ error: 'Failed to send quote email' });
            } else {
                console.log('Quote email sent:', info.response);
                res.status(200).json({ message: 'Quote sent successfully' });
            }
        });

    } catch (error) {
        console.error('Error submitting quote:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

module.exports = { submitQuote };
