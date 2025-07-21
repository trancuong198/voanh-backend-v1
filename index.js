const express = require('express');
const bodyParser = require('body-parser');
const { Client } = require('@notionhq/client');

require('dotenv').config();

const app = express();
app.use(bodyParser.json());

// Khởi tạo Notion client
const notion = new Client({ auth: process.env.KHOA_API_NOTION });
const databaseId = process.env.NOTION_DATABASE_ID;

// Tuyến đường POST /log
app.post('/log', async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ lỗi: 'Thiếu tin nhắn' });
  }

  try {
    await notion.pages.create({
      parent: { database_id: databaseId },
      properties: {
        Tên: {
          title: [{ text: { content: message } }]
        }
      }
    });

    res.status(200).json({ trạng_thái: 'Ghi Notion thành công' });
  } catch (err) {
    console.error('Lỗi Notion:', JSON.stringify(err.body || err, null, 2));

    res.status(500).json({ lỗi: 'Ghi Notion thất bại' });
  }
});

// Khởi động máy chủ
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server chạy cổng ${PORT}`);
});
