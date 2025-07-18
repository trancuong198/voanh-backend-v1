require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const { Client } = require("@notionhq/client");

const app = express();
const port = process.env.PORT || 3000;

// Khởi tạo client Notion
const notion = new Client({ auth: process.env.NOTION_API_KEY });

app.use(bodyParser.json());

// ✅ Route test GET để kiểm tra backend hoạt động
app.get("/api/log", (req, res) => {
  res.send("✅ Backend Vô Ảnh đang hoạt động ổn định!");
});

// 📌 Route chính để ghi log vào Notion
app.post("/log", async (req, res) => {
  const { message } = req.body;

  try {
    const response = await notion.pages.create({
      parent: {
        database_id: process.env.NOTION_DATABASE_ID,
      },
      properties: {
        Title: {
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

    res.status(200).json({ status: "Success", data: response });
  } catch (error) {
    console.error("❌ Error:", error);
    res.status(500).json({ status: "Error", message: error.message });
  }
});

// 🔌 Khởi chạy server
app.listen(port, () => {
  console.log(`🚀 Server is running on http://localhost:${port}`);
});
