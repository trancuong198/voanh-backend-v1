const express = require('express');
const bodyParser = require('body-parser');
const { Client } = require('@notionhq/client');
require('dotenv').config();
const OpenAI = require("openai");
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const app = express();
app.use(bodyParser.json());

// Tuyến đường ghi log và phản tư bằng OpenAI
app.post('/log', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Thiếu nội dung' });

  try {
    // Gọi OpenAI để tạo phản tư từ message
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: "Bạn là một agent phản tư, ghi lại cảm xúc và suy nghĩ." },
        { role: "user", content: message }
      ]
    });

    const reply = completion.choices[0].message.content;

    // Ghi vào Notion
    await notion.pages.create({
      parent: { database_id: databaseId },
      properties: {
        "Tiêu đề": {
          title: [
            { text: { content: message } }
          ]
        },
        "Nội dung": {
          rich_text: [
            { text: { content: reply } }
          ]
        }
      }
    });

    return res.status(200).json({ status: 'Ghi Notion thành công', reply });

  } catch (error) {
    console.error('Lỗi:', error.message || error);
    return res.status(500).json({ error: 'Ghi Notion thất bại' });
  }
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server đang chạy tại cổng ${PORT}`);
});
