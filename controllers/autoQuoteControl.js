const { transporter } = require('../utils/emailConfig');
const { generateQuotePdf } = require('../services/quotePDF');

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

        const mailOptions = {
            from: 'Traffic & Barrier Solutions LLC <tbsolutions9@gmail.com>',
            to: email,
            bcc: [
                { name: 'Traffic & Barrier Solutions LLC', address: 'tbsolutions9@gmail.com' },
            ],
            subject: `Quote for ${customer} - ${company}`,
            html: `
            <!DOCTYPE html>
            <html lang="en">
            <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #e7e7e7;">
                <div style="background-color: #e7e7e7; padding: 20px;">
                    <header style="background-color: #1dd2ff; padding: 20px; text-align: center;">
                        <h2 style="margin: 0; font-size: 36px; color: #000000;">TRAFFIC & BARRIER SOLUTIONS, LLC/MATERIAL WORX</h2>
                    </header>
                    
                    <div style="background-color: white; padding: 30px; margin-top: 20px;">
                        <h2 style="font-size: 28px; color: #000000;">Dear ${customer},</h2>
                        
                        <p style="font-size: 18px; line-height: 1.6; margin: 20px 0;">
                            Thank you for your interest in Traffic & Barrier Solutions, LLC/Material WorX! We appreciate the opportunity to provide you with a quote for your project.
                        </p>
                        
                        <p style="font-size: 18px; line-height: 1.6; margin: 20px 0;">
                            Please see the attached quote for detailed pricing and services. If you have any questions or would like to proceed with this quote, please don't hesitate to email us or call at <strong>706-263-0175</strong>.
                        </p>

                        <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #1dd2ff;">
                            <h3 style="font-size: 24px; color: #000000;">Contact Information:</h3>
                            <p style="font-size: 16px; margin: 5px 0;">Bryson C Davis</p>
                            <p style="font-size: 16px; margin: 5px 0;">Traffic and Barrier Solutions, LLC/Material WorX</p>
                            <p style="font-size: 16px; margin: 5px 0;">723 N Wall Street</p>
                            <p style="font-size: 16px; margin: 5px 0;">Calhoun, GA 30701</p>
                            <p style="font-size: 16px; margin: 5px 0;">Cell: 706-263-0175</p>
                            <p style="font-size: 16px; margin: 5px 0;">Website: <a href="http://www.trafficbarriersolutions.com">www.trafficbarriersolutions.com</a></p>
                        </div>
                        
                        <p style="font-size: 18px; line-height: 1.6; margin: 30px 0 10px 0; font-weight: bold;">
                            We look forward to working with you!
                        </p>
                        
                        <p style="font-size: 16px; margin: 5px 0;">Best Regards,<br/>The TBS Team</p>
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
