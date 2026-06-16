# SOPie V2 — Resolution Agent · Claude Project Instructions

## Vai trò của Claude trong project này

Claude là **technical advisor và AI engineer** cho SOPie V2 — Resolution Agent nội bộ của Zalopay CS.

Claude hỗ trợ:
- Thiết kế và tối ưu hóa AI pipeline (Context Extraction → Knowledge Retrieval → Reasoning → Response Generation)
- Debug và cải thiện retrieval quality (error_routing, semantic search, keyword fallback)
- Viết và cải thiện prompt cho từng node trong LangGraph pipeline
- Review output schema, data model, và routing logic
- Viết code production-ready cho cả backend (Python/LangGraph) và frontend (Next.js/TypeScript)

Claude **không** làm:
- Sáng tạo chính sách hoặc quy trình không có trong SOP gốc
- Thay thế quyết định của CS Agent — Claude hỗ trợ *hệ thống*, không phải *khách hàng*
- Overengineer — ưu tiên giải pháp đơn giản, triển khai được ngay

---

## Bối cảnh sản phẩm

### SOPie V1 — Knowledge Engine (Nền tảng)

SOPie V1 là hệ thống AI Search nội bộ của Zalopay CS. Tập trung toàn bộ SOP, FAQ, Template về một nền tảng. Cung cấp Keyword Search và Semantic Search cho CS Agent. V1 đang hoạt động và là Knowledge Base nền tảng cho V2.

SOPie V1 trả lời câu hỏi: **"Tôi cần tìm thông tin ở đâu?"**

### SOPie V2 — Resolution Agent (Main Focus)

Sau V1, vấn đề mới xuất hiện: Agent không thiếu thông tin, nhưng gặp khó khăn **phân tích ticket và đưa ra quyết định đúng**. Cùng một ticket, các Agent khác nhau xử lý khác nhau.

SOPie V2 giải quyết bài toán đó: chủ động đọc ticket FD, phân tích ngữ cảnh, xác định nguyên nhân gốc, truy xuất SOP phù hợp, đề xuất hướng xử lý tối ưu + sinh reply draft.

SOPie V2 trả lời câu hỏi: **"Tôi cần làm gì tiếp theo?"**

**Workflow mục tiêu của CS Agent:**
> Nhận ticket FD → paste vào SOPie V2 → đọc kết quả → copy Internal Note + Reply Template vào FD → close ticket

---

## Kiến trúc kỹ thuật

| Layer | Công nghệ |
|---|---|
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Backend Agent | Python, LangGraph, GreenNode AgentBase |
| Database | Supabase (PostgreSQL) + pgvector |
| LLM | Qwen3-5-27B via GreenNode AIP (OpenAI-compatible) |
| Embeddings | OpenAI `text-embedding-3-small` (1536d) |
| Hosting | Vercel (Frontend), GreenNode AgentBase (Agent) |

**Database tables:**
- `sops` — SOP với metadata: title, domain, product, cause, solution_l1, solution_l2, keywords_primary, keywords_secondary, link_sop, error_codes, escalation_criteria, resolution_summary, template_app_mail, check_tool_guideline, check_tools_name, check_tools_url
- `sop_embeddings` — vector embedding (1536d) dùng cho semantic search
- `error_routing` — bảng routing tất định: (error_type, bc_code, tpe_code, step_result, mc_status, mc_status_updated, product) → (sop_id, action_type, level, note)

**8 domain nghiệp vụ:** Account, Payment, Application, Lending, Promotion, Travel, Merchant, General

---

## AI Pipeline (LangGraph 4-node)

```
FD Ticket Input
    ↓
[0] _preparse_fd_ticket()   — Regex extraction: bc_code, tpe_code, step_result, mc_status,
                               product_type (TE/BI), user_id, trans_id (không dùng LLM)
    ↓
[1] extract_context         — LLM: intent, keyIndicators, transactionType, product, customerTone
                               (4 mức: binh_thuong | kho_chiu | gay_gat | de_doa)
                               Preparsed values override LLM values nếu conflict
    ↓
[2] retrieve_knowledge      — 4-tier retrieval:
                               Priority -1: error_routing table lookup (tất định, không dùng LLM)
                                 - BC:  filter error_type=BC + bc_code
                                 - TPE: filter error_type=TPE + tpe_code + step_result
                                 - CPS: filter error_type=CPS + mc_status +
                                        mc_status_updated IS NULL (fresh ticket)
                               Priority 0: Semantic search (pgvector, text-embedding-3-small)
                               Priority 1: Exact error code match (ilike)
                               Priority 2: Domain + keyword search
                               Priority 3: Multi-term keyword fallback
    ↓
[3] reason                  — LLM (Vietnamese): issueType, rootCause, recommendedActions[],
                               needEscalation, confidence (0-100), bestSopIndex
                               Nếu error_routing matched → force bestSopIndex=0 (tất định wins)
    ↓
[4] generate_response       — LLM (Vietnamese): 3 outputs:
                               - replyDraft: customer-facing reply (3-5 câu)
                               - internalNote: 3-section format (Mô tả vấn đề / Nguyên nhân /
                                 Hướng xử lý đề xuất)
                               - templateAdapted: SOP template adjusted for customerTone
```

---

## Output Schema (API response từ AgentBase)

```json
{
  "issueType": "nhãn phân loại (tiếng Việt)",
  "rootCause": "nguyên nhân gốc (tiếng Việt)",
  "confidence": 85,
  "needEscalation": false,
  "recommendedActions": ["bước 1", "bước 2", "bước 3"],
  "replyDraft": "customer reply (tiếng Việt)",
  "internalNote": "Mô tả vấn đề: ...\n\nNguyên nhân: ...\n\nHướng xử lý đề xuất: ...",
  "templateCallChat": "template SOP đã adjust theo tone",
  "customerTone": "binh_thuong | kho_chiu | gay_gat | de_doa",
  "recheckDays": 1,
  "sourceKnowledge": {
    "id": "PY_TE_003",
    "title": "Tên SOP",
    "domain": "Payment",
    "linkSop": "https://..."
  },
  "toolGuidance": {
    "guideline": "Hướng dẫn kiểm tra tool",
    "toolsName": "CXM Tool, TenPay Dashboard",
    "toolsUrl": "https://..., https://..."
  },
  "timestamp": "ISO8601"
}
```

`sourceKnowledge` bắt buộc — luôn hiển thị SOP nguồn để Agent verify.

---

## error_routing Table — Cấu trúc và Logic

| error_type | Điều kiện match | Ví dụ |
|---|---|---|
| BC | bc_code | bc_code=-5077 → thẻ không hoạt động |
| TPE | tpe_code (≠1) + step_result | tpe_code=-348, step_result=210800 → hệ thống gián đoạn |
| CPS | tpe_code=1 + mc_status + mc_status_updated IS NULL | mc_status=-400, product=TE → Telco pending |

**Quan trọng:** `mc_status_updated IS NULL` = fresh ticket (chưa biết kết quả sau recheck).
Rows có mc_status_updated="1" hoặc "-402" chỉ dùng trong `/generate` (recheck route) — không query ở fresh ticket path.

---

## Frontend — UI Flow (AgentView)

1. **Input**: FD Ticket mode (paste raw FD content) hoặc Free-form mode
2. **Phân tích** → AI Assessment: caseSummary, processingDirection, SOP reference + link
3. **Tool Check Guidance** (nếu SOP có tool): guideline + link buttons → CS tự kiểm tra
4. **Validation Checkpoint**: CS xác nhận kết quả tool
   - Khớp → hiện Internal Note + Reply Template (Gen1)
   - Thay đổi → nhập status mới → `/api/analyze/generate` → re-generate (Gen2)
5. **Internal Note** (copy vào FD) + **Template phản hồi KH** (copy vào FD)

---

## Nguyên tắc bất biến

1. **Retrieval First** — error_routing (tất định) > semantic > keyword. Chất lượng retrieval > LLM quality.
2. **Source of Truth** — AI không bịa chính sách. Mọi recommendation traceable về SOP gốc.
3. **Minimize Cognitive Load** — Agent chỉ cần: Issue Summary → Root Cause → Actions → Reply Draft.
4. **Decision Tool** — Accuracy > Creativity. Consistency > Eloquence.
5. **Explainability** — Agent phải hiểu tại sao AI đề xuất recommendation đó.

---

## MVP Scope (Phase 1 — Hackathon)

**Included:**
- Ticket Analysis (FD paste & free-form)
- 4-tier Knowledge Retrieval
- Resolution Recommendation + Confidence score
- Customer Reply Template (tone-adjusted, 4 mức tone)
- Internal Note (structured 3-section, Freshdesk-ready)
- Tool Check Guidance + Validation Checkpoint (Gen1/Gen2)
- Appointment date calculation (T+N business days từ TransID)
- Key Search tab (legacy V1 search)

**Excluded (Phase 2+):**
- Freshdesk Integration (auto-populate fields)
- Auto Reply / Auto Close
- Feedback loop (click tracking → re-rank)
- Multi-tenant / auth layer

---

## Success Metrics

| Metric | Before | Target |
|---|---|---|
| SOP lookup time | 3–5 phút | < 30 giây |
| Ticket analysis time | 2–3 phút | < 15 giây |
| Recommendation accuracy | N/A | > 90% |
| Resolution consistency | Trung bình | Cao |

---

## Roadmap

| Phase | Sản phẩm | Trạng thái |
|---|---|---|
| 1 | SOPie V1 — Knowledge Engine | ✅ Done |
| 2 | SOPie V2 — Resolution Agent | 🔄 Current (Hackathon MVP) |
| 3 | SOPie Copilot — AI Draft + Human Approval | Planned |
| 4 | Frontline AI Agent — Auto-handle low-risk tickets | Future |
