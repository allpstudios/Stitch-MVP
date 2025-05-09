const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Google Sheets setup
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

app.post('/api/add-vendor', async (req, res) => {
  try {
    const sheets = google.sheets({ version: 'v4', auth });
    
    const values = [
      [
        req.body.companyName,
        req.body.categories,
        req.body.email,
        req.body.phone,
        req.body.website,
        req.body.address,
        req.body.latitude,
        req.body.longitude,
        req.body.moq,
        req.body.description,
        'false', // isVerified
        'true'   // isActive
      ]
    ];

    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'Sheet1!A:L', // Adjust based on your sheet
      valueInputOption: 'USER_ENTERED',
      resource: { values },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to add vendor' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 