# SOPie Resolution Agent — PRD v2
## Tool Validation Flow + Internal Note Format

**Version:** 2.0  
**Date:** 2026-06-11  
**Scope:** MVP — Payment domain, transaction check use case  
**Status:** Draft

---

## 1. Background

SOPie Agent V1 thực hiện flow đơn giản:

```
Input ticket → AI phân tích → Output (Internal Note + Reply template)
```

Vấn đề: CS agent không có cơ chế validate kết quả AI với dữ liệu thực tế trên tool trước khi gửi phản hồi. Điều này dẫn đến nguy cơ tư vấn sai khi trạng thái giao dịch đã thay đổi giữa lúc KH submit ticket và lúc CS xử lý.

---

## 2. Mục tiêu

- CS có thể xác thực nhận định của AI với dữ liệu tool thực tế **trong cùng một flow**, không cần chuyển tab hay tra thủ công
- Nếu kết quả tool khớp → generate output ngay
- Nếu kết quả tool thay đổi → CS nhập thông tin mới theo template chuẩn → AI re-generate chính xác hơn
- Internal Note theo đúng format chuẩn để paste vào Freshdesk

---

## 3. Flow Mới (V2)

```
┌─────────────────────────────────────────────────────┐
│  STEP 1: Input (không thay đổi)                      │
│  CS paste FD ticket hoặc mô tả vấn đề tự do         │
└─────────────────────────┬───────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────┐
│  STEP 2: AI Nhận Định (không thay đổi)               │
│  - Case summary, root cause, domain, confidence      │
│  - SOP tham chiếu + link Xem SOP                     │
└─────────────────────────┬───────────────────────────┘
                          ↓ [MỚI]
┌─────────────────────────────────────────────────────┐
│  STEP 3: Hướng Dẫn Kiểm Tra Tool                     │
│  - Hiển thị check_tool_guideline từ SOP matched      │
│  - Quick link buttons: tên tool + URL                │
│  (pattern giống Key Search SOP detail modal)         │
└─────────────────────────┬───────────────────────────┘
                          ↓ [MỚI]
┌─────────────────────────────────────────────────────┐
│  STEP 4: CS Validation Checkpoint                    │
│                                                      │
│  [✓ Kết quả khớp]  [↺ Kết quả thay đổi]            │
│                                                      │
│  Path A — Khớp:                                      │
│    CS click "Xác nhận đúng"                          │
│    → AI auto-generate Internal Note + Reply template │
│                                                      │
│  Path B — Thay đổi:                                  │
│    CS chọn "Status mới" từ dropdown                  │
│    (pre-defined: 1 / -400 / -402 / -1 / -333 / khác)│
│    → AI re-generate Internal Note + Reply template   │
└─────────────────────────┬───────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────┐
│  STEP 5: Final Output                                │
│  - Internal Note (format chuẩn Freshdesk)            │
│  - Template phản hồi KH                              │
│  [Copy note]  [Copy template]                        │
└─────────────────────────────────────────────────────┘
```

---

## 4. Chi Tiết Từng Component Mới

### 4.1 Tool Check Guidance Box (Step 3)

**Data source:** Từ SOP matched, các cột:
- `check_tool_guideline` — hướng dẫn từng bước kiểm tra
- `check_tools_name` — tên tool (có thể nhiều tool, phân cách dấu phẩy)
- `check_tools_url` — URL tool tương ứng

**UI pattern:** Blue box, giống "Hướng dẫn kiểm tra tool" trong Key Search SOP detail modal.

**Render:**
```
🔧 Hướng dẫn kiểm tra tool

[nội dung check_tool_guideline — whitespace-pre-wrap]

[🔗 Tool CXM_TPE - Lịch sử GD]  [🔗 Tool CXM_Thông tin tài khoản]
```

**Edge case:** Nếu SOP không có `check_tool_guideline` → ẩn toàn bộ Step 3 và Step 4, hiển thị thẳng output (giữ backward-compatible với SOP cũ chưa có data).

---

### 4.2 CS Validation Checkpoint (Step 4)

**Trigger:** Hiển thị sau Tool Check Guidance Box (chỉ khi có tool guideline data).

**Path A — Kết quả khớp:**
- Button: "✓ Xác nhận đúng — Generate output"
- Action: gọi `/api/analyze/generate` với `{ action: 'confirm', analysisId }` → trả Internal Note + Reply template

**Path B — Kết quả thay đổi:**
- Button: "↺ Kết quả thay đổi"
- Mở re-input panel gồm:
  - **Dropdown "Status mới"** (pre-defined list — xem Section 4.3)
  - **Text note ngắn** (optional, placeholder: `"Ví dụ: GD đã cập nhật thành công, KH xác nhận nhận được tiền"`) — max 150 chars
  - Button: "Re-generate"
- Action: gọi `/api/analyze/generate` với `{ action: 'recheck', originalAnalysis, newStatus, note }`

---

### 4.3 Dropdown Status Codes (MVP Payment)

Pre-defined list — có thể mở rộng sau:

| Value | Label hiển thị |
|-------|---------------|
| `1` | 1 — Giao dịch thành công |
| `-400` | -400 — Đang xử lý / Pending |
| `-402` | -402 — Thất bại hoàn toàn |
| `-1` | -1 — Lỗi hệ thống |
| `-333` | -333 — Voucher / Khuyến mãi lỗi |
| `-1343` | -1343 — Vượt hạn mức chi tiêu |
| `other` | Khác (nhập tay) |

---

### 4.4 Gen 2 Output

- **Chỉ** generate Internal Note + Reply template — **không** re-render lại AI nhận định
- Có badge "Đã cập nhật theo kết quả tool" phân biệt với Gen 1
- Cấu trúc output giống Gen 1 (cùng format)

---

## 5. Internal Note Format (Fix)

Format chuẩn để paste vào Freshdesk, **toàn bộ tiếng Việt**, không có English label:

```
UserID: {userId | "Không có"}
TransID: {transId | "Không có"}
[Lưu ý: Nếu ticket có TransID, CS cần verify lại status GD trên tool CXM trước khi phản hồi cho User]

Mô tả vấn đề: {AI summary — 1-2 câu mô tả tình huống KH}
Nguyên nhân: {rootCause từ AI, 1 câu}
Hướng xử lý đề xuất: {recommendedActions, dạng text tự nhiên hoặc numbered list}
```

**Ví dụ:**
```
UserID: 2206130003500068
TransID: 260530000433904
[Lưu ý: Nếu ticket có TransID, CS cần verify lại status GD trên tool CXM trước khi phản hồi cho User]

Mô tả vấn đề: KH thanh toán hóa đơn điện bị báo lỗi -400, giao dịch không hoàn thành.
Nguyên nhân: Giao dịch đang ở trạng thái pending, chờ đối soát T+1 ngày làm việc.
Hướng xử lý đề xuất: Xác nhận với KH giao dịch đang được xử lý, hướng dẫn chờ đến ngày làm việc tiếp theo để kiểm tra kết quả.
```

---

## 6. Technical Changes

### 6.1 Backend — `sopie-agent/main.py`

Thêm vào `_SOP_COLS`:
```python
_SOP_COLS = "id, title, domain, ..., check_tool_guideline, check_tools_name, check_tools_url"
```

Thêm vào handler response:
```python
"toolGuidance": {
    "guideline": sop.get("check_tool_guideline", "") or "",
    "toolsName": sop.get("check_tools_name", "") or "",
    "toolsUrl": sop.get("check_tools_url", "") or "",
}
```

Fix internal note prompt: yêu cầu output theo format chuẩn (Vietnamese labels, structured).

### 6.2 API Route — `app/api/analyze/route.ts`

- Pass `toolGuidance` từ agent response vào result
- Fix `buildInternalNoteText()` theo format mới (Vietnamese labels)
- Thêm route mới `/api/analyze/generate` để xử lý Path A (confirm) và Path B (recheck with new status)

### 6.3 Types — `app/types/agent.ts`

Thêm:
```typescript
export interface ToolGuidance {
  guideline: string
  toolsName: string   // comma-separated, e.g. "Tool CXM_TPE,Tool CXM_Thông tin tài khoản"
  toolsUrl: string    // comma-separated URLs
}

// Thêm vào AnalysisResult:
toolGuidance?: ToolGuidance
```

### 6.4 Frontend — `app/components/AgentView.tsx`

Thêm 2 component mới:
- `ToolCheckBox` — render guideline + quick link buttons
- `ValidationCheckpoint` — render Path A/B, dropdown, re-generate

---

## 7. Scope MVP

**Trong scope:**
- Payment domain — transaction check use case
- Dropdown status codes cho Payment
- Tool guidance từ SOP có data (`check_tool_guideline` không null)
- Gen 2 output: Internal Note + Reply template only

**Ngoài scope (future):**
- Status dropdown cho các domain khác (Lending, Promotion...)
- CS ghi nhận feedback để improve retrieval (click tracking)
- Multi-turn conversation (gen 3, gen 4...)
- Auto-prefill status từ tool API (real-time check)

---

## 8. Open Questions

| # | Question | Owner | Status |
|---|----------|-------|--------|
| 1 | `check_tools_url` có multiple URLs không? Delimiter là gì? | Data team | TBD |
| 2 | Dropdown status codes đủ chưa? Cần thêm mã nào? | CS Lead | TBD |
| 3 | Gen 2 có cần lưu log so sánh Gen 1 vs Gen 2 không? | PM | TBD |
