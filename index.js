require('dotenv').config();
const express = require('express');
const { Client } = require('@notionhq/client');

const app = express();
app.use(express.json());

// Init Notion
const notion = new Client({ auth: process.env.NOTION_API_KEY });
const databaseId = process.env.NOTION_DATABASE_ID;

// Route: /log
app.post('/log', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Missing message' });

  try {
    const response = await notion.pages.create({
      parent: { database_id: databaseId },
      properties: {
        Name: {
          title: [
            {
              text: {
                content: message,
              },
            },
          ],
        },
      },
    });
    res.json({ success: true, pageId: response.id });
  } catch (error) {
    console.error('Notion error:', error.body || error);
    res.status(500).json({ error: 'Failed to log to Notion' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
const express = require('express');
const bodyParser = require('body-parser');
const { Client } = require('@notionhq/client');

const app = express();
app.use(bodyParser.json());

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const databaseId = process.env.NOTION_DATABASE_ID;

// Route POST /log
app.post('/log', async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Thiếu nội dung message' });
  }

  try {
    await notion.pages.create({
      parent: { database_id: databaseId },
      properties: {
        Name: {
          title: [{ text: { content: message } }]
        }
      }
    });
    res.status(200).json({ status: 'Đã ghi vào Notion' });
  } catch (error) {
    console.error('Lỗi ghi Notion:', error);
    res.status(500).json({ error: 'Không ghi được vào Notion' });
  }
});

app.listen(10000, () => {
  console.log('Server chạy tại cổng 10000');
});
