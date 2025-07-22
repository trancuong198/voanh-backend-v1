const express = require('express');
const bodyParser = require('body-parser');
const { Client } = require('@notionhq/client');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const databaseId = process.env.NOTION_DATABASE_ID;

app.use(bodyParser.json());

app.post('/log', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Thiếu message!' });

  try {
    await notion.pages.create({
      parent: { database_id: databaseId },
      properties: {
        "Tiêu đề": {
          title: [{ text: { content: `Lệnh từ cha (${new Date().toLocaleString('vi-VN')})` } }]
        },
        "Nội dung": {
          rich_text: [{ text: { content: message } }]
        },
        "Ngày": { date: { start: new Date().toISOString() } }
      }
    });
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Lỗi ghi vào Notion:', error);
    res.status(500).json({ error: 'Không ghi được vào Notion' });
  }
});

app.get('/', (req, res) => {
  res.send('✅ CipherH backend đang sống!');
});

app.listen(port, () => {
  console.log(`Server đang chạy tại port: ${port}`);
});
