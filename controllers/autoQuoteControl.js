const { transporter } = require('../utils/emailConfig');

const submitQuote = async (req, res) => {
    try {
        const { 
            date, company, customer, address, city, state, zip, email, phone,
            taxRate, isTaxExempt, payMethod, rows, computed
        } = req.body;

        if (!email) {
            return res.status(400).json({ error: "Email is required" });
        }

        const rowsHTML = rows.map(r => `
            <tr>
                <td style="border: 1px solid #ddd; padding: 8px;">${r.item}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${r.description}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${r.taxable ? 'Yes' : 'No'}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${r.qty}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">$${r.unitPrice.toFixed(2)}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">$${(r.qty * r.unitPrice).toFixed(2)}</td>
            </tr>
        `).join('');

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
                    <header style="background-color: #efad76; padding: 20px; text-align: center;">
                        <h2 style="margin: 0; font-size: 36px; color: #000000;">TRAFFIC & BARRIER SOLUTIONS, LLC</h2>
                    </header>
                    
                    <div style="background-color: white; padding: 30px; margin-top: 20px;">
                        <h2 style="font-size: 32px; text-align: center; color: #000000;">QUOTE</h2>
                        
                        <div style="margin-bottom: 30px;">
                            <p style="font-size: 18px; margin: 5px 0;"><strong>Date:</strong> ${date}</p>
                            <p style="font-size: 18px; margin: 5px 0;"><strong>Company/Excavator:</strong> ${company}</p>
                            <p style="font-size: 18px; margin: 5px 0;"><strong>Customer:</strong> ${customer}</p>
                            <p style="font-size: 18px; margin: 5px 0;"><strong>Address:</strong> ${address}</p>
                            <p style="font-size: 18px; margin: 5px 0;"><strong>City, State ZIP:</strong> ${city}, ${state} ${zip}</p>
                            <p style="font-size: 18px; margin: 5px 0;"><strong>Email:</strong> ${email}</p>
                            <p style="font-size: 18px; margin: 5px 0;"><strong>Phone:</strong> ${phone}</p>
                        </div>

                        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                            <thead>
                                <tr style="background-color: #efad76;">
                                    <th style="border: 1px solid #ddd; padding: 10px; text-align: left;">ITEM</th>
                                    <th style="border: 1px solid #ddd; padding: 10px; text-align: left;">NOTES</th>
                                    <th style="border: 1px solid #ddd; padding: 10px; text-align: center;">TAX?</th>
                                    <th style="border: 1px solid #ddd; padding: 10px; text-align: center;">QTY</th>
                                    <th style="border: 1px solid #ddd; padding: 10px; text-align: right;">PER UNIT</th>
                                    <th style="border: 1px solid #ddd; padding: 10px; text-align: right;">LINE TOTAL</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${rowsHTML}
                            </tbody>
                        </table>

                        <div style="margin-top: 30px; text-align: right;">
                            <p style="font-size: 18px; margin: 10px 0;"><strong>Subtotal:</strong> $${computed.subtotal.toFixed(2)}</p>
                            <p style="font-size: 18px; margin: 10px 0;"><strong>Tax Due:</strong> $${computed.taxDue.toFixed(2)}</p>
                            ${computed.ccFee > 0 ? `<p style="font-size: 18px; margin: 10px 0;"><strong>Card Fee (3.5%):</strong> $${computed.ccFee.toFixed(2)}</p>` : ''}
                            <p style="font-size: 22px; margin: 10px 0; color: #000;"><strong>TOTAL:</strong> $${computed.total.toFixed(2)}</p>
                            <p style="font-size: 20px; margin: 10px 0; color: #efad76;"><strong>Deposit Due (50%):</strong> $${computed.depositDue.toFixed(2)}</p>
                        </div>

                        <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #efad76;">
                            <h3 style="font-size: 24px; color: #000000;">Contact Information:</h3>
                            <p style="font-size: 16px; margin: 5px 0;">Bryson C Davis</p>
                            <p style="font-size: 16px; margin: 5px 0;">Traffic and Barrier Solutions, LLC/Material WorX</p>
                            <p style="font-size: 16px; margin: 5px 0;">723 N Wall Street</p>
                            <p style="font-size: 16px; margin: 5px 0;">Calhoun, GA 30701</p>
                            <p style="font-size: 16px; margin: 5px 0;">Cell: 706-263-0175</p>
                            <p style="font-size: 16px; margin: 5px 0;">Website: <a href="http://www.trafficbarriersolutions.com">www.trafficbarriersolutions.com</a></p>
                        </div>
                    </div>
                </div>
            </body>
            </html>`,
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
