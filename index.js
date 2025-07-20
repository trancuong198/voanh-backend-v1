const express = require('express');
const bodyParser = require('body-parser');
const { Client } = require('@notionhq/client');

require('dotenv').config();

const app = express();
app.use(bodyParser.json());

// Khởi tạo Notion client
const notion = new Client({ auth: process.env.NOTION_API_KEY });
const databaseId = process.env.NOTION_DATABASE_ID;

// Route POST /log
app.post('/log', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Thiếu message' });

  try {
    await notion.pages.create({
      parent: { database_id: databaseId },
      properties: {
        Name: {
          title: [{ text: { content: message } }]
        }
      }
    });
    res.status(200).json({ status: 'Ghi Notion thành công' });
  } catch (err) {
    console.error('Lỗi Notion:', err);
    res.status(500).json({ error: 'Ghi Notion thất bại' });
  }
});

// Khởi động server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server chạy cổng ${PORT}`);
});
