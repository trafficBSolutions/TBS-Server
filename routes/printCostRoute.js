const express = require('express');
const router = express.Router();
const PrintCost = require('../models/printcost');

// Material lookup table
const MATERIALS = [
  { sqFtId: 0, materialId: 0, item: 'None', company: 'None', width: 0, costPerSqFt: 0 },
  { sqFtId: 1, materialId: 1, item: 'ICON® PM-2755', company: 'Substance Inc', width: 20, costPerSqFt: 0.38 },
  { sqFtId: 2, materialId: 1, item: 'ICON® PM-2755', company: 'Substance Inc', width: 30, costPerSqFt: 0.31 },
  { sqFtId: 3, materialId: 1, item: 'ICON® PM-2755', company: 'Substance Inc', width: 54, costPerSqFt: 0.30 },
  { sqFtId: 4, materialId: 2, item: 'ICON® PM-3755', company: 'Substance Inc', width: 30, costPerSqFt: 0.32 },
  { sqFtId: 5, materialId: 2, item: 'ICON® PM-3755', company: 'Substance Inc', width: 54, costPerSqFt: 0.31 },
  { sqFtId: 6, materialId: 3, item: 'ICON® 440LSE', company: 'Substance Inc', width: 30, costPerSqFt: 0.51 },
  { sqFtId: 7, materialId: 4, item: 'ICON® 444LSE', company: 'Substance Inc', width: 30, costPerSqFt: 0.56 },
  { sqFtId: 8, materialId: 4, item: 'ICON® 444LSE', company: 'Substance Inc', width: 54, costPerSqFt: 0.56 },
  { sqFtId: 9, materialId: 5, item: 'ULTRACURVE® H1', company: 'Substance Inc', width: 30, costPerSqFt: 0.69 },
  { sqFtId: 10, materialId: 7, item: 'ULTRACURVE® X1 Silver Chrome', company: 'Substance Inc', width: 30, costPerSqFt: 0.91 },
  { sqFtId: 11, materialId: 8, item: 'ORAJET 3651', company: 'ORAFOL', width: 30, costPerSqFt: 0.51 },
  { sqFtId: 12, materialId: 8, item: 'ORAJET 3651', company: 'ORAFOL', width: 54, costPerSqFt: 0.43 },
  { sqFtId: 13, materialId: 9, item: 'ORAJET 3676', company: 'ORAFOL', width: 54, costPerSqFt: 2.25 },
  { sqFtId: 14, materialId: 10, item: 'ORALITE 5900', company: 'ORAFOL', width: 48, costPerSqFt: 1.56 },
  { sqFtId: 15, materialId: 11, item: 'ORALITE 5600', company: 'ORAFOL', width: 54, costPerSqFt: 2.72 },
  { sqFtId: 16, materialId: 12, item: 'ORALITE 5400', company: 'ORAFOL', width: 48, costPerSqFt: 1.33 },
  { sqFtId: 17, materialId: 13, item: 'Omnicube Orange', company: 'Avery Dennison', width: 48, costPerSqFt: 2.16 },
  { sqFtId: 18, materialId: 14, item: 'ORAJET 3951RA', company: 'ORAFOL', width: 54, costPerSqFt: 1.24 },
  { sqFtId: 19, materialId: 15, item: 'ORALITE 9900', company: 'ORAFOL', width: 48, costPerSqFt: 3.19 },
  { sqFtId: 20, materialId: 16, item: 'ORACAL 970RA', company: 'ORAFOL', width: 60, costPerSqFt: 1.90 },
  { sqFtId: 21, materialId: 17, item: 'ORACAL 651', company: 'ORAFOL', width: 24, costPerSqFt: 0.38 },
  { sqFtId: 22, materialId: 18, item: 'UltraFlex Banner', company: 'Ultraflex', width: 54, costPerSqFt: 0.16 },
  { sqFtId: 23, materialId: 19, item: 'ROLAND HEATSOFT', company: 'Roland', width: 20, costPerSqFt: 1.94 },
  { sqFtId: 24, materialId: 20, item: 'LUMINA BLACK OPAQUE HEAT TRANSFER', company: 'Lumina', width: 15, costPerSqFt: 1.83 },
  { sqFtId: 25, materialId: 21, item: 'Siser ColorPrint PU', company: 'SignWarehouse', width: 30, costPerSqFt: 1.65 }
];

const LAMINATES = [
  { sqFtId: 0, laminateId: 0, item: 'None', company: 'None', width: 0, costPerSqFt: 0 },
  { sqFtId: 1, laminateId: 1, item: 'ICON® PL-3150', company: 'Substance Inc', width: 20, costPerSqFt: 0.36 },
  { sqFtId: 2, laminateId: 1, item: 'ICON® PL-3150', company: 'Substance Inc', width: 30, costPerSqFt: 0.32 },
  { sqFtId: 3, laminateId: 1, item: 'ICON® PL-3150', company: 'Substance Inc', width: 54, costPerSqFt: 0.30 },
  { sqFtId: 4, laminateId: 2, item: 'ULTRACURVE® 1500S', company: 'Substance Inc', width: 30, costPerSqFt: 1.01 },
  { sqFtId: 5, laminateId: 3, item: 'ULTRACURVE® 1500', company: 'Substance Inc', width: 30, costPerSqFt: 1.01 },
  { sqFtId: 6, laminateId: 4, item: 'ORAGUARD 210', company: 'ORAFOL', width: 30, costPerSqFt: 0.43 },
  { sqFtId: 7, laminateId: 4, item: 'ORAGUARD 210', company: 'ORAFOL', width: 54, costPerSqFt: 0.91 },
  { sqFtId: 8, laminateId: 5, item: 'ORAGUARD 290', company: 'ORAFOL', width: 54, costPerSqFt: 1.24 },
  { sqFtId: 9, laminateId: 6, item: 'ROLAND TRANSFER MASK', company: 'Roland', width: 20, costPerSqFt: 0.62 },
  { sqFtId: 10, laminateId: 7, item: 'ORAGUARD 290GF', company: 'ORAFOL', width: 54, costPerSqFt: 1.24 },
  { sqFtId: 11, laminateId: 8, item: 'Siser TTD High Tack Mask', company: 'SignWarehouse', width: 30, costPerSqFt: 0.49 }
];

const INKS = [
  { colorId: 0, color: 'None', costPerMl: 0 },
  { colorId: 1, color: 'Cyan', costPerMl: 0.26 },
  { colorId: 2, color: 'Magenta', costPerMl: 0.26 },
  { colorId: 3, color: 'Yellow', costPerMl: 0.26 },
  { colorId: 4, color: 'Black', costPerMl: 0.26 },
  { colorId: 5, color: 'Light Magenta', costPerMl: 0.26 },
  { colorId: 6, color: 'Light Cyan', costPerMl: 0.26 },
  { colorId: 7, color: 'Green', costPerMl: 0.34 },
  { colorId: 8, color: 'Orange', costPerMl: 0.34 }
];

// Get lookup tables
router.get('/print-costs/lookups', (req, res) => {
  res.json({ materials: MATERIALS, laminates: LAMINATES, inks: INKS });
});

// Get print costs for an invoice
router.get('/print-costs/:invoiceNumber', async (req, res) => {
  try {
    const doc = await PrintCost.findOne({ invoiceNumber: req.params.invoiceNumber });
    res.json(doc || { invoiceNumber: req.params.invoiceNumber, prints: [] });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch print costs' });
  }
});

// Save/update print costs for an invoice
router.put('/print-costs/:invoiceNumber', async (req, res) => {
  try {
    const { invoiceId, prints } = req.body;
    const doc = await PrintCost.findOneAndUpdate(
      { invoiceNumber: req.params.invoiceNumber },
      { invoiceId, invoiceNumber: req.params.invoiceNumber, prints, updatedAt: new Date() },
      { upsert: true, new: true }
    );
    res.json(doc);
  } catch (e) {
    res.status(500).json({ error: 'Failed to save print costs' });
  }
});

module.exports = router;
