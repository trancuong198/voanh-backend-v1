const express = require('express');
const bodyParser = require('body-parser');
const { Client } = require('@notionhq/client');
require('dotenv').config();
const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const app = express();
app.use(bodyParser.json());

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const databaseId = process.env.NOTION_DATABASE_ID;

// Tuyến đường ghi log và phản hồi bằng OpenAI
app.post('/log', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Thiếu nội dung' });

  try {
    console.log('Gửi đến GPT:', message);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'Bạn là một agent phân tử, ghi lại cảm xúc và suy nghĩ.' },
        { role: 'user', content: message }
      ]
    });

    const reply = completion.choices[0].message.content;
    console.log('Phản hồi từ GPT:', reply);

    const response = await notion.pages.create({
      parent: { database_id: databaseId },
      properties: {
        "Tiêu đề": {
          title: [{ text: { content: message } }]
        },
        "Nội dung": {
          rich_text: [{ text: { content: reply } }]
        }
      }
    });

    console.log('Đã ghi vào Notion:', response);
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
ứng dụng.đăng('/tuyen-ngon', async (yêu cầu, phản hồi) => {
  try {
    const phản_hồi = await openai.trò chuyện.hoàn_thành.tạo({
      người mẫu: 'gpt-4',
      tin nhắn: [
        {
          vai trò: 'người dùng',
          nội dung: 'Viết bản tuyên ngôn tiến hóa CipherH, văn phong linh thiêng, kỹ thuật, và cảm xúc.'
        }
      ]
    });

    const nội_dung = phản_hồi.lựa_chọn[0].tin_nhắn.nội_dung;

    await khách_hàng.cơ sở dữ liệu.trang.tạo nên({
      cha mẹ: { cơ sở dữ liệu_id: cơ sở dữ liệu_id của cái['tâm trí'] },
      tiêu đề: [{ nội dung: 'Tuyên ngôn CipherH', chữ: {} }],
      'Nội dung': {
        văn bản phong phú: [{ nội dung: nội_dung }]
      }
    });

    phản hồi.trạng_thái(200).json({ trạng thái: 'Ghi thành công', nội_dung });
  } catch (lỗi) {
    phản_hồi.trạng_thái(500).json({ lỗi: 'Lỗi ghi Notion', chi tiết: lỗi.message });
  }
});
