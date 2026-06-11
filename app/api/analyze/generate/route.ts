import { NextRequest, NextResponse } from 'next/server'

const AGENT_ENDPOINT_URL =
  process.env.AGENT_ENDPOINT_URL ||
  'https://endpoint-b040ca6a-70c1-4d31-80a9-8d43e294fe43.agentbase-runtime.aiplatform.vngcloud.vn/invocations'

// Build a re-check ticket text from original result + new status
function buildRecheckTicket(params: {
  originalSopTitle: string
  originalIssueType: string
  originalRootCause: string
  userId: string | null
  transId: string | null
  newStatus: string
  note: string
}): string {
  const { originalSopTitle, originalIssueType, originalRootCause, userId, transId, newStatus, note } = params

  const lines = [
    `[Re-check — CS đã xác minh trên tool]`,
    `Vấn đề ban đầu: ${originalIssueType}`,
    `Nguyên nhân ban đầu AI nhận định: ${originalRootCause}`,
    `SOP tham chiếu: ${originalSopTitle}`,
    ``,
    `Kết quả CS kiểm tra lại trên tool:`,
    `- Status GD hiện tại: ${newStatus}`,
    note ? `- Ghi chú: ${note}` : '',
    ``,
    userId ? `UserID: ${userId}` : '',
    transId ? `TransID: ${transId}` : '',
  ].filter(line => line !== undefined && line !== null)

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
      originalSopTitle: originalResult.sourceKnowledge?.[0]?.sopTitle || '',
      originalIssueType: originalResult.caseSummary || '',
      originalRootCause: originalResult.processingDirection || '',
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
      signal: AbortSignal.timeout(60000),
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
