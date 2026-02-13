const { transporter } = require('../utils/emailConfig');
const { generateQuotePdf } = require('../services/quotePDF');
const Quote = require('../models/quoteuser');
const path = require('path');
const fs = require('fs');

const submitQuote = async (req, res) => {
    try {
        const { 
            date, company, customer, address, city, state, zip, email, phone,
            taxRate, isTaxExempt, payMethod, rows, computed
        } = req.body;

        if (!email) {
            return res.status(400).json({ error: "Email is required" });
        }

        const newQuote = await Quote.create(req.body);

        const pdfBuffer = await generateQuotePdf(req.body);

        const mailOptions = {
            from: 'Traffic & Barrier Solutions LLC <tbsolutions9@gmail.com>',
            to: email,
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

        const mailOptions = {
            from: 'Traffic & Barrier Solutions LLC <tbsolutions9@gmail.com>',
            to: quote.email,
            cc: [
                { name: 'Traffic & Barrier Solutions LLC', address: 'tbsolutions9@gmail.com' },
                { name: 'Carson Speer', address: 'tbsolutions4@gmail.com' },
                { name: 'Bryson Davis', address: 'tbsolutions3@gmail.com' },
                { name: 'bryson davis', address: 'mxbrysondavis@gmail.com' }
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

module.exports = { submitQuote, getMonthlyQuotes, getDailyQuotes, resendQuote };
