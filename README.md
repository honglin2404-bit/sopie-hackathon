# SOPie V2 — Resolution Agent

> **Virtual Senior Agent cho CS Newbie của Zalopay**

SOPie V2 đọc ticket Freshdesk thô, phân tích ngữ cảnh, xác định nguyên nhân gốc, truy xuất SOP phù hợp, và sinh sẵn Internal Note + Reply Template — giúp CS Newbie ra quyết định tự tin trong dưới 15 giây, không cần chờ mentor.

🔗 **Live Demo:** [https://cs-sopie-v2.vercel.app](https://cs-sopie-v2.vercel.app)

---

## Bối cảnh & Bài toán

### Trước SOPie V1

CS team Zalopay quản lý SOP, template, scenario phục vụ công việc trên **3–4 platform riêng lẻ** (Confluence, Google Drive, Excel, Google Sites, v.v.). Hậu quả:
- Thông tin rời rạc, khó tìm, khó đồng bộ khi cập nhật
- Search Engine không hiểu context — Agent phải dùng đúng keyword mà QC/IC đã viết mới ra kết quả
- CS Newbie không tự tìm được thông tin trong giai đoạn đầu → phụ thuộc hoàn toàn vào mentor
- Mentor bận KPI riêng, không support hết được → tỷ lệ nhân viên mới nghỉ việc do áp lực kiến thức cao

### SOPie V1 — Knowledge Engine ✅

Tập trung toàn bộ SOP, FAQ, Template về một nền tảng duy nhất. Dùng OpenAI Semantic Search để tìm kiếm hiểu ngữ nghĩa thay vì exact keyword. Giải quyết được: **"Tôi cần tìm thông tin ở đâu?"**

### Vấn đề còn lại sau V1

CS Newbie biết tìm SOP ở đâu rồi — nhưng vẫn không biết **phải làm gì** với ticket trước mặt:

- Ticket này thuộc loại lỗi gì? Nguyên nhân gốc là đâu?
- Cần check tool nào? Quy trình xử lý ra sao?
- Internal Note viết gì? Reply khách hàng nói thế nào?

Cùng một ticket, các Agent xử lý khác nhau. Cần có một "Senior Agent ảo" đồng hành.

### SOPie V2 — Resolution Agent 🔄 (Current)

Giải quyết câu hỏi: **"Tôi cần làm gì tiếp theo?"**

---

## Người dùng

| Đối tượng | Vấn đề được giải quyết | Tính năng sử dụng |
|---|---|---|
| **CS Newbie** | Bơ vơ khi xử lý ticket, phụ thuộc mentor | SOPie Agent View — phân tích ticket, gợi ý xử lý |
| **CS Oldbie** | Phải tra cứu qua nhiều platform | Key Search — tìm SOP/template nhanh từ 1 nơi |
| **Leader / QC** | Knowledge out-of-sync giữa các platform | Quản lý knowledge tập trung, cập nhật một lần |

---

## Workflow của CS Agent

```
Nhận ticket FD
    ↓
Paste vào SOPie V2
    ↓
Đọc: Case Summary + Root Cause + Recommended Actions
    ↓
Check tool theo hướng dẫn (nếu cần)
    ↓
Copy Internal Note + Reply Template vào Freshdesk
    ↓
Close ticket ✅
```

---

## Kiến trúc AI Pipeline

```
FD Ticket Input (raw text)
    ↓
[0] Pre-parse          — Regex extract: bc_code, tpe_code, step_result,
                          mc_status, product_type — không dùng LLM
    ↓
[1] Extract Context    — LLM: intent, product, customerTone
    ↓
[2] Retrieve Knowledge — 4-tier retrieval:
                          Priority -1: error_routing table (tất định, 100% chính xác)
                          Priority  0: Semantic search (pgvector)
                          Priority  1: Exact error code match
                          Priority 2+: Domain + keyword fallback
    ↓
[3] Reason             — LLM: rootCause, recommendedActions,
                          confidence (0-100), needEscalation
    ↓
[4] Generate Response  — LLM: replyDraft + internalNote + templateAdapted
```

**Điểm mấu chốt:** `error_routing` table là lớp tất định — với các lỗi đã biết (BC/TPE/CPS error codes), hệ thống match trực tiếp không qua LLM, đảm bảo 100% chính xác và nhất quán.

---

## Output cho mỗi ticket

```json
{
  "issueType": "Lỗi giao dịch qua thẻ ngân hàng",
  "rootCause": "Thẻ tạm khóa do vượt hạn mức ngày",
  "confidence": 92,
  "needEscalation": false,
  "recommendedActions": ["Hướng dẫn KH kiểm tra hạn mức thẻ", "Đề xuất đổi PTTT"],
  "replyDraft": "...",
  "internalNote": "Mô tả vấn đề: ...\n\nNguyên nhân: ...\n\nHướng xử lý đề xuất: ...",
  "templateCallChat": "...",
  "customerTone": "kho_chiu",
  "sourceKnowledge": {
    "id": "PY_TE_003",
    "title": "Tên SOP",
    "linkSop": "https://..."
  }
}
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Backend Agent | Python, LangGraph, GreenNode AgentBase |
| Database | Supabase (PostgreSQL + pgvector) |
| LLM | Qwen3-5-27B via GreenNode AIP (OpenAI-compatible) |
| Embeddings | OpenAI `text-embedding-3-small` (1536d) |
| Hosting | Vercel (Frontend) + GreenNode AgentBase (Agent) |

**8 domain nghiệp vụ:** Account · Payment · Application · Lending · Promotion · Travel · Merchant · General

---

## Setup

```bash
# 1. Clone & install
git clone https://github.com/honglin2404-bit/sopie-hackathon
cd sopie-hackathon
npm install

# 2. Configure environment
cp .env.local.example .env.local
# Điền vào: SUPABASE_URL, SUPABASE_ANON_KEY, AGENT_BASE_URL, OPENAI_API_KEY

# 3. Run locally
npm run dev
# → http://localhost:3000
```

Xem `.env.local.example` để biết đầy đủ các biến môi trường cần thiết.

### Agent Backend (sopie-agent/)

```bash
cd sopie-agent
pip install -r requirements.txt
python main.py
```

---

## Success Metrics

| Metric | Before SOPie | Target |
|---|---|---|
| Thời gian tra SOP | 3–5 phút | < 30 giây |
| Thời gian phân tích ticket | 2–3 phút | < 15 giây |
| Độ chính xác recommendation | — | > 90% |
| Tính nhất quán xử lý | Thấp | Cao |

---

## Roadmap

| Phase | Product | Status |
|---|---|---|
| 1 | SOPie V1 — Knowledge Engine | ✅ Done |
| 2 | SOPie V2 — Resolution Agent | 🔄 Current (Hackathon MVP) |
| 3 | SOPie Copilot — AI Draft + Human Approval | Planned |
| 4 | Frontline AI Agent — Auto-handle low-risk tickets | Future |

---

## Team

**CS SOPie** — Zalopay Customer Service

---

*Built for Claw-a-thon Hackathon 2026 · Zalopay*
