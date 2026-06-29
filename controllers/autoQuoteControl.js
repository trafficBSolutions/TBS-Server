const { transporter } = require('../utils/emailConfig');
const { generateQuotePdf, generateInvoicePdf } = require('../services/quotePDF');
const Quote = require('../models/quoteuser');
const ShopInvoice = require('../models/shopinvoice');
const path = require('path');
const fs = require('fs');

const submitQuote = async (req, res) => {
    try {
        const { 
            date, company, customer, email, phone,
            taxRate, isTaxExempt, payMethod, rows, computed
        } = req.body;

        if (!email) {
            return res.status(400).json({ error: "Email is required" });
        }

        const newQuote = await Quote.create(req.body);

        const pdfBuffer = await generateQuotePdf(req.body);

        const emailList = email.split(',').map(e => e.trim()).filter(e => e);

        const mailOptions = {
            from: 'Traffic & Barrier Solutions LLC <tbsolutions9@gmail.com>',
            to: emailList,
            cc: [
                { name: 'Traffic & Barrier Solutions LLC', address: 'tbsolutions9@gmail.com' },
                { name: 'Carson Speer', address: 'tbsolutions4@gmail.com' },
                { name: 'Bryson Davis', address: 'tbsolutions3@gmail.com' },
                { name: 'bryson davis', address: 'mxbrysondavis@gmail.com' },
            ],
            subject: `Quote for ${customer} - ${company}`,
            html: `
            <!DOCTYPE html>
            <html>
            <body style="font-family:Arial,sans-serif;margin:0;padding:20px;background:#f5f5f5;">
                <div style="max-width:600px;margin:0 auto;background:#fff;padding:30px;border-radius:8px;">
                    
                    <h2 style="color:#17365D;margin-top:0;">Dear ${customer},</h2>
                    
                    <p style="font-size:16px;line-height:1.6;">
                        Thank you for your interest in Traffic & Barrier Solutions! Please see the attached quote for your project.
                    </p>
                    
                    <p style="font-size:16px;line-height:1.6;">
                        If you have any questions or would like to proceed, please email us at <strong><a href="mailto:materialworx2@gmail.com">materialworx2@gmail.com</a></strong>.
                    </p>

                    <div style="text-align:center;margin:30px 0;">
                        <a href="${process.env.SERVER_URL || 'https://www.trafficbarriersolutions.com'}/api/quotes/${newQuote._id}/approve" 
                           style="display:inline-block;padding:14px 30px;background:#17365D;color:#fff;text-decoration:none;border-radius:6px;font-size:16px;font-weight:bold;">
                            ✅ Approve Quote
                        </a>
                    </div>

                    <div style="margin-top:30px;padding-top:20px;border-top:1px solid #ddd;font-size:14px;color:#666;">
                        <p style="margin:5px 0;"><strong>Bryson C Davis</strong></p>
                        <p style="margin:5px 0;">Traffic & Barrier Solutions, LLC</p>
                        <p style="margin:5px 0;">723 N Wall Street, Calhoun, GA 30701</p>
                        <p style="margin:5px 0;">Email: materialworx2@gmail.com</p>
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
                res.status(200).json({ message: 'Quote sent successfully', quote: newQuote });
            }
        });

    } catch (error) {
        console.error('Error submitting quote:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

const getMonthlyQuotes = async (req, res) => {
    try {
        const { month, year } = req.query;
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);
        
        const quotes = await Quote.find({
            date: {
                $gte: startDate.toISOString().split('T')[0],
                $lte: endDate.toISOString().split('T')[0]
            }
        });
        
        res.json(quotes);
    } catch (error) {
        console.error('Error fetching monthly quotes:', error);
        res.status(500).json({ error: 'Failed to fetch quotes' });
    }
};

const getDailyQuotes = async (req, res) => {
    try {
        const { date } = req.query;
        const quotes = await Quote.find({ date });
        res.json(quotes);
    } catch (error) {
        console.error('Error fetching daily quotes:', error);
        res.status(500).json({ error: 'Failed to fetch quotes' });
    }
};

const resendQuote = async (req, res) => {
    try {
        const { id } = req.params;
        const quote = await Quote.findById(id);
        
        if (!quote) {
            return res.status(404).json({ error: 'Quote not found' });
        }

        const pdfBuffer = await generateQuotePdf(quote);

        const emailList = quote.email.split(',').map(e => e.trim()).filter(e => e);

        const mailOptions = {
            from: 'Traffic & Barrier Solutions LLC <tbsolutions9@gmail.com>',
            to: emailList,
            cc: [
                { name: 'Traffic & Barrier Solutions LLC', address: 'tbsolutions9@gmail.com' },
                { name: 'Carson Speer', address: 'tbsolutions4@gmail.com' },
                { name: 'Bryson Davis', address: 'tbsolutions3@gmail.com' },
                { name: 'bryson davis', address: 'mxbrysondavis@gmail.com' },
            ],
            subject: `Quote for ${quote.customer} - ${quote.company}`,
            html: `
            <!DOCTYPE html>
            <html>
            <body style="font-family:Arial,sans-serif;margin:0;padding:20px;background:#f5f5f5;">
                <div style="max-width:600px;margin:0 auto;background:#fff;padding:30px;border-radius:8px;">
                    
                    <h2 style="color:#17365D;margin-top:0;">Dear ${quote.customer},</h2>
                    
                    <p style="font-size:16px;line-height:1.6;">
                        Thank you for your interest in Traffic & Barrier Solutions! Please see the attached quote for your project.
                    </p>
                    
                    <p style="font-size:16px;line-height:1.6;">
                        If you have any questions or would like to proceed, please email us at <strong><a href="mailto:materialworx2@gmail.com">materialworx2@gmail.com</a></strong>.
                    </p>

                    <div style="text-align:center;margin:30px 0;">
                        <a href="${process.env.SERVER_URL || 'https://www.trafficbarriersolutions.com'}/api/quotes/${quote._id}/approve" 
                           style="display:inline-block;padding:14px 30px;background:#17365D;color:#fff;text-decoration:none;border-radius:6px;font-size:16px;font-weight:bold;">
                            ✅ Approve Quote
                        </a>
                    </div>

                    <div style="margin-top:30px;padding-top:20px;border-top:1px solid #ddd;font-size:14px;color:#666;">
                        <p style="margin:5px 0;"><strong>Bryson C Davis</strong></p>
                        <p style="margin:5px 0;">Traffic & Barrier Solutions, LLC</p>
                        <p style="margin:5px 0;">723 N Wall Street, Calhoun, GA 30701</p>
                        <p style="margin:5px 0;">Email: materialworx2@gmail.com</p>
                        <p style="margin:5px 0;">www.trafficbarriersolutions.com</p>
                    </div>
                </div>
            </body>
            </html>`,
            attachments: [
                {
                    filename: `TBS_Quote_${quote.customer.replace(/\s+/g, '_')}_${quote.date}.pdf`,
                    content: pdfBuffer
                }
            ]
        };

        transporter.sendMail(mailOptions, async (error, info) => {
            if (error) {
                console.log('Error resending quote email:', error);
                return res.status(500).json({ error: 'Failed to resend quote email' });
            } else {
                console.log('Quote email resent:', info.response);
                const updatedQuote = await Quote.findByIdAndUpdate(
                    id, 
                    { lastSentAt: new Date() },
                    { new: true }
                );
                res.status(200).json({ message: 'Quote resent successfully', quote: updatedQuote });
            }
        });

    } catch (error) {
        console.error('Error resending quote:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

const submitInvoice = async (req, res) => {
    try {
        const { invoiceNumber, date, company, customer, email, phone, rows, computed, isTaxExempt, taxExemptNumber, payMethod, cardType, cardLast4, checkNumber, notes, donation } = req.body;
        if (!email) return res.status(400).json({ error: "Email is required" });
        if (!invoiceNumber) return res.status(400).json({ error: "Invoice number is required" });

        // Save invoice to database
        await ShopInvoice.create({ invoiceNumber, date, company, customer, email, phone, rows, computed, isTaxExempt, taxExemptNumber, payMethod, cardType, cardLast4, checkNumber, notes, donation });

        const pdfBuffer = await generateInvoicePdf(req.body);
        const emailList = email.split(',').map(e => e.trim()).filter(e => e);

        const mailOptions = {
            from: 'Traffic & Barrier Solutions LLC <tbsolutions9@gmail.com>',
            to: emailList,
            cc: [
                { name: 'Traffic & Barrier Solutions LLC', address: 'tbsolutions9@gmail.com' },
                
                { name: 'Carson Speer', address: 'tbsolutions4@gmail.com' },
                { name: 'Bryson Davis', address: 'tbsolutions3@gmail.com' },
                { name: 'bryson davis', address: 'mxbrysondavis@gmail.com' },
                { name: 'Dasia Diskey', address: 'materialworx2@gmail.com' },
                 
            ],
            subject: `Invoice #${invoiceNumber} for ${customer} - ${company}`,
            html: `
            <!DOCTYPE html>
            <html>
            <body style="font-family:Arial,sans-serif;margin:0;padding:20px;background:#f5f5f5;">
                <div style="max-width:600px;margin:0 auto;background:#fff;padding:30px;border-radius:8px;">
                    <h2 style="color:#17365D;margin-top:0;">Dear ${customer},</h2>
                    <p style="font-size:16px;line-height:1.6;">Please see the attached invoice <strong>#${invoiceNumber}</strong> for your project.</p>
                    <p style="font-size:16px;line-height:1.6;">If you have any questions, please email us at <strong><a href="mailto:materialworx2@gmail.com">materialworx2@gmail.com</a></strong>.</p>
                    <div style="margin-top:30px;padding-top:20px;border-top:1px solid #ddd;font-size:14px;color:#666;">
                        <p style="margin:5px 0;"><strong>Bryson C Davis</strong></p>
                        <p style="margin:5px 0;">Traffic & Barrier Solutions, LLC</p>
                        <p style="margin:5px 0;">723 N Wall Street, Calhoun, GA 30701</p>
                        <p style="margin:5px 0;">Email: materialworx2@gmail.com</p>
                        <p style="margin:5px 0;">www.trafficbarriersolutions.com</p>
                    </div>
                </div>
            </body>
            </html>`,
            attachments: [{
                filename: `TBS_Invoice_${invoiceNumber}_${customer.replace(/\s+/g, '_')}_${date}.pdf`,
                content: pdfBuffer
            }]
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.log('Error sending invoice email:', error);
                return res.status(500).json({ error: 'Failed to send invoice email' });
            }
            console.log('Invoice email sent:', info.response);
            res.status(200).json({ message: 'Invoice sent successfully' });
        });
    } catch (error) {
        console.error('Error submitting invoice:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

const approveQuote = async (req, res) => {
    try {
        const { id } = req.params;
        const quote = await Quote.findById(id);
        if (!quote) return res.status(404).send('<h1>Quote not found</h1>');
        if (quote.approved) return res.send('<h1 style="font-family:Arial;color:#17365D;">✅ This quote has already been approved. Thank you!</h1>');

        quote.approved = true;
        quote.approvedAt = new Date();
        await quote.save();

        // Notify team of approval
        const mailOptions = {
            from: 'Traffic & Barrier Solutions LLC <tbsolutions9@gmail.com>',
            to: ['materialworx2@gmail.com', 'tbsolutions9@gmail.com', 'tbsolutions4@gmail.com'],
            subject: `✅ Quote Approved by ${quote.customer} - ${quote.company}`,
            html: `<p style="font-family:Arial;font-size:16px;"><strong>${quote.customer}</strong> from <strong>${quote.company}</strong> has approved their quote (Total: $${quote.computed.total.toFixed(2)}).</p>`
        };
        transporter.sendMail(mailOptions);

        res.send('<h1 style="font-family:Arial;color:#17365D;">✅ Quote Approved!</h1><p style="font-family:Arial;">Thank you for approving your quote. Our team will be in touch shortly.</p>');
    } catch (error) {
        console.error('Error approving quote:', error);
        res.status(500).send('<h1>Something went wrong. Please try again.</h1>');
    }
};

module.exports = { submitQuote, getMonthlyQuotes, getDailyQuotes, resendQuote, submitInvoice, approveQuote };
