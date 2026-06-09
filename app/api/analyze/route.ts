import { NextRequest, NextResponse } from 'next/server'
import { openai } from '@/lib/openai'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://sopie-search-tool.onrender.com'

const DOMAIN_CODE_MAP: Record<string, string> = {
  Account: 'AC',
  Payment: 'PY',
  Application: 'AP',
  Lending: 'LD',
  Promotion: 'PM',
  Travel: 'TV',
  Merchant: 'MC',
  General: 'GE',
}

async function searchSOPs(query: string, domain: string) {
  const searchDomain =
    domain !== 'General' && DOMAIN_CODE_MAP[domain]
      ? `${domain} (${DOMAIN_CODE_MAP[domain]})`
      : 'all'

  const res = await fetch(`${BACKEND_URL}/api/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, domain: searchDomain, type: 'ai', limit: 5 }),
  })
  if (!res.ok) throw new Error(`Search API error: ${res.status}`)
  return res.json()
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { mode, ticketContent, issueDescription, attemptedSolutions } = body

    if (mode === 'fd' && !ticketContent?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Nội dung ticket không được để trống', errorCode: 'EXTRACTION_ERROR' },
        { status: 400 },
      )
    }
    if (mode === 'free' && !issueDescription?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Mô tả vấn đề không được để trống', errorCode: 'EXTRACTION_ERROR' },
        { status: 400 },
      )
    }

    const rawInput =
      mode === 'fd'
        ? ticketContent
        : `Vấn đề: ${issueDescription}${attemptedSolutions ? `\nĐã thử: ${attemptedSolutions}` : ''}`

    // ── Prompt 1: Context Extraction ──────────────────────────────────────
    const extractionRes = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: `Bạn là AI phân tích ticket của ZaloPay CS. Trích xuất thông tin có cấu trúc từ ticket.

Trả về JSON (không giải thích thêm):
{
  "ticketSummary": "Tóm tắt vấn đề ngắn gọn, 1-2 câu",
  "rootCause": "Nguyên nhân gốc rễ có thể có",
  "customerIntent": "Khách hàng muốn gì",
  "domain": "Một trong: Account | Payment | Application | Lending | Promotion | Travel | Merchant | General",
  "urgency": "Thấp | Trung bình | Cao",
  "searchQuery": "Query ngắn gọn để tìm SOP liên quan, tiếng Việt, 5-10 từ"
}`,
        },
        { role: 'user', content: rawInput },
      ],
      response_format: { type: 'json_object' },
    })

    const extracted = JSON.parse(extractionRes.choices[0].message.content || '{}')

    if (!extracted.searchQuery || !extracted.domain) {
      return NextResponse.json(
        { success: false, error: 'Không thể phân tích ticket. Vui lòng kiểm tra lại nội dung.', errorCode: 'EXTRACTION_ERROR' },
        { status: 400 },
      )
    }

    // ── Knowledge Retrieval ───────────────────────────────────────────────
    let retrievedSOPs: any[] = []
    try {
      const searchResult = await searchSOPs(extracted.searchQuery, extracted.domain)
      retrievedSOPs = searchResult.results || []
    } catch (e) {
      console.error('Search failed:', e)
    }

    if (retrievedSOPs.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Không tìm thấy SOP phù hợp. Vui lòng liên hệ QC team.',
          errorCode: 'NOT_FOUND',
        },
        { status: 200 },
      )
    }

    // ── Prompt 2+3+4: Reasoning + Recommendation + Response Generation ────
    const sopContext = retrievedSOPs
      .slice(0, 3)
      .map(
        (sop: any, i: number) =>
          `SOP ${i + 1}:\n- ID: ${sop.id}\n- Tiêu đề: ${sop.title}\n- Domain: ${sop.domain}\n- Nguyên nhân: ${sop.cause || 'N/A'}\n- Xử lý CS1: ${sop.solution?.level1 || 'N/A'}\n- Xử lý CS2: ${sop.solution?.level2 || 'N/A'}`,
      )
      .join('\n\n')

    const reasoningRes = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.1,
      messages: [
        {
          role: 'system',
          content: `Bạn là AI hỗ trợ quyết định cho CS ZaloPay. Dựa trên ticket và SOP được cung cấp, tạo phân tích đầy đủ.

QUAN TRỌNG:
- Chỉ dùng thông tin từ SOP được cung cấp. Không bịa thêm chính sách.
- Nếu SOP không đủ thông tin, ghi rõ trong internalNote.
- customerReply phải lịch sự, đầy đủ, phù hợp văn phong CS ZaloPay.

Trả về JSON:
{
  "recommendation": {
    "primaryAction": "Hành động chính cần thực hiện",
    "steps": ["Bước 1", "Bước 2", "Bước 3"],
    "escalate": true/false,
    "escalateTo": "CS2 / QC Team / null"
  },
  "customerReply": "Template phản hồi gửi khách hàng (tiếng Việt, thân thiện, đầy đủ)",
  "internalNote": "Ghi chú nội bộ cho CS agent (ngắn gọn, kỹ thuật, nêu SOP áp dụng)",
  "confidence": <số 0-100>,
  "sourceKnowledge": [
    { "sopId": "id", "sopTitle": "title", "domain": "domain", "relevance": "Lý do chọn SOP này" }
  ]
}`,
        },
        {
          role: 'user',
          content: `TICKET GỐC:\n${rawInput}\n\nCONTEXT ĐÃ TRÍCH XUẤT:\n${JSON.stringify(extracted, null, 2)}\n\nSOP LIÊN QUAN:\n${sopContext}`,
        },
      ],
      response_format: { type: 'json_object' },
    })

    const reasoning = JSON.parse(reasoningRes.choices[0].message.content || '{}')
    const confidence: number = reasoning.confidence ?? 0

    const result = {
      ticketSummary: extracted.ticketSummary,
      rootCause: extracted.rootCause,
      customerIntent: extracted.customerIntent,
      domain: extracted.domain,
      urgency: extracted.urgency,
      recommendation: reasoning.recommendation,
      customerReply: reasoning.customerReply,
      internalNote: reasoning.internalNote,
      confidence,
      sourceKnowledge: reasoning.sourceKnowledge || [],
    }

    if (confidence < 60) {
      return NextResponse.json({
        success: false,
        error: `Độ tin cậy thấp (${confidence}/100) — kết quả chỉ mang tính tham khảo`,
        errorCode: 'LOW_CONFIDENCE',
        result,
      })
    }

    return NextResponse.json({ success: true, result })
  } catch (error: any) {
    console.error('Analyze error:', error)
    return NextResponse.json(
      { success: false, error: 'Lỗi hệ thống, vui lòng thử lại', errorCode: 'API_ERROR' },
      { status: 500 },
    )
  }
}
