import { NextRequest, NextResponse } from 'next/server'

const AGENT_ENDPOINT_URL =
  process.env.AGENT_ENDPOINT_URL ||
  'https://endpoint-b040ca6a-70c1-4d31-80a9-8d43e294fe43.agentbase-runtime.aiplatform.vngcloud.vn/invocations'

const STATUS_LABELS: Record<string, string> = {
  '1':     'Giao dịch thành công',
  '-400':  'Đang xử lý / Pending',
  '-53':   'Đang xử lý / Pending (đối tác)',
  '6':     'Đang xử lý / Pending (đối tác)',
  '7':     'Đang xử lý / Pending (đối tác)',
  '-402':  'Thất bại hoàn toàn',
  '-1':    'Lỗi hệ thống',
  '-333':  'Voucher / Khuyến mãi lỗi',
  '-1343': 'Vượt hạn mức chi tiêu',
}

// Build a re-check ticket using ONLY the new status and domain context.
// caseSummary is intentionally excluded — it may contain old error codes
// (e.g. "-400") that cause extract_context to latch onto the wrong SOP.
// STATUS_LABELS gives the LLM enough semantic signal to find the right SOP
// without numeric codes (most SOPs have no error_codes data for billing).
function buildRecheckTicket(params: {
  domain: string
  userId: string | null
  transId: string | null
  newStatus: string
  note: string
}): string {
  const { domain, userId, transId, newStatus, note } = params
  const statusLabel = STATUS_LABELS[newStatus] || newStatus

  const lines = [
    `Cần hỗ trợ xử lý giao dịch ${domain || 'thanh toán'}.`,
    `Trạng thái giao dịch xác nhận: mã ${newStatus} — ${statusLabel}.`,
    note ? `Ghi chú thêm: ${note}` : '',
    userId ? `UserID: ${userId}` : '',
    transId ? `TransID: ${transId}` : '',
  ].filter(Boolean)

  return lines.join('\n').trim()
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { originalResult, newStatus, note } = body

    if (!originalResult || !newStatus) {
      return NextResponse.json(
        { error: 'Thiếu thông tin re-check' },
        { status: 400 },
      )
    }

    const recheckTicket = buildRecheckTicket({
      domain: originalResult.domain || '',
      userId: originalResult.internalNote?.userId || null,
      transId: originalResult.internalNote?.transId || null,
      newStatus,
      note: note || '',
    })

    // Call SOPie Agent with re-check context
    const agentRes = await fetch(AGENT_ENDPOINT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket: recheckTicket }),
      signal: AbortSignal.timeout(120000),
    })

    if (!agentRes.ok) {
      return NextResponse.json(
        { error: 'Lỗi kết nối SOPie Agent khi re-generate' },
        { status: 502 },
      )
    }

    const agentData = await agentRes.json()

    const userId = originalResult.internalNote?.userId || null
    const transId = originalResult.internalNote?.transId || null
    const agentNote: string = typeof agentData.internalNote === 'string' ? agentData.internalNote : ''

    // Build internal note with Vietnamese format
    const internalNoteLines = [
      `UserID: ${userId || 'Không có'}`,
      `TransID: ${transId || 'Không có'}`,
      transId ? `[Lưu ý: Nếu ticket có TransID, CS cần verify lại status GD trên tool CXM trước khi phản hồi cho User]` : '',
      ``,
      agentNote && agentNote.length > 10
        ? agentNote
        : `Mô tả vấn đề: ${agentData.issueType || originalResult.caseSummary}\nNguyên nhân: ${agentData.rootCause || ''}\nHướng xử lý đề xuất: ${(agentData.recommendedActions || []).join('; ')}`,
    ].filter(l => l !== null && l !== undefined)

    const internalNote = internalNoteLines.join('\n').trim()

    // Prefer template_call_chat, fallback to replyDraft
    const customerReply: string =
      agentData.templateCallChat?.trim()
        ? agentData.templateCallChat
        : agentData.replyDraft || ''

    return NextResponse.json({ internalNote, customerReply })
  } catch (error: any) {
    console.error('Generate route error:', error)
    return NextResponse.json(
      { error: 'Lỗi hệ thống khi re-generate' },
      { status: 500 },
    )
  }
}
