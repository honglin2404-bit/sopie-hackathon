import { NextRequest, NextResponse } from 'next/server'

const AGENT_ENDPOINT_URL =
  process.env.AGENT_ENDPOINT_URL ||
  'https://endpoint-b040ca6a-70c1-4d31-80a9-8d43e294fe43.agentbase-runtime.aiplatform.vngcloud.vn/invocations'

// Extract UserID and TransID from raw ticket text
function extractIds(text: string): { userId: string | null; transId: string | null } {
  const userIdMatch = text.match(/UserID[:\s]+(\d{6,})/i)
  const transIdMatch =
    text.match(/TransID[:\s]+([\w\d]+)/i) ||
    text.match(/Mã GD[:\s]+([\w\d]+)/i) ||
    text.match(/transaction[_\s]?id[:\s]+([\w\d]+)/i)
  return {
    userId: userIdMatch?.[1] || null,
    transId: transIdMatch?.[1] || null,
  }
}

// Build structured internal note text — Vietnamese labels, Freshdesk-ready format
function buildInternalNoteText(params: {
  userId: string | null
  transId: string | null
  agentNote: string
}): string {
  const { userId, transId, agentNote } = params

  const lines: string[] = []

  lines.push(`UserID: ${userId || 'Không có'}`)
  lines.push(`TransID: ${transId || 'Không có'}`)
  if (transId) {
    lines.push(`[Lưu ý: Nếu ticket có TransID, CS cần verify lại status GD trên tool CXM trước khi phản hồi cho User]`)
  }
  lines.push('')
  lines.push(agentNote && agentNote.length > 10 ? agentNote : 'Mô tả vấn đề: Chưa xác định\nNguyên nhân: Chưa xác định\nHướng xử lý đề xuất: Cần kiểm tra thêm')

  return lines.join('\n')
}

// Vietnamese public holidays (fixed + Tet estimates 2025-2028)
const VN_HOLIDAYS: Set<string> = new Set([
  // 2025
  '2025-01-01','2025-01-27','2025-01-28','2025-01-29','2025-01-30','2025-01-31',
  '2025-04-07','2025-04-30','2025-05-01','2025-09-02',
  // 2026
  '2026-01-01','2026-01-28','2026-01-29','2026-01-30','2026-01-31','2026-02-01',
  '2026-03-18','2026-04-30','2026-05-01','2026-09-02',
  // 2027
  '2027-01-01','2027-02-15','2027-02-16','2027-02-17','2027-02-18','2027-02-19',
  '2027-04-06','2027-04-30','2027-05-01','2027-09-02',
])

function isBusinessDay(date: Date): boolean {
  const day = date.getDay() // 0=Sun, 6=Sat
  if (day === 0 || day === 6) return false
  const key = date.toISOString().slice(0, 10) // YYYY-MM-DD
  return !VN_HOLIDAYS.has(key)
}

function addBusinessDays(startDate: Date, days: number): Date {
  const result = new Date(startDate)
  let added = 0
  while (added < days) {
    result.setDate(result.getDate() + 1)
    if (isBusinessDay(result)) added++
  }
  return result
}

function parseDateFromTransId(transId: string | null): Date | null {
  if (!transId || transId.length < 6) return null
  // TransID format: YYMMDD... e.g. 260612... = 12/06/2026
  const yy = transId.slice(0, 2)
  const mm = transId.slice(2, 4)
  const dd = transId.slice(4, 6)
  const year = parseInt(`20${yy}`)
  const month = parseInt(mm) - 1 // 0-indexed
  const day = parseInt(dd)
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null
  return new Date(year, month, day)
}

function formatDateVN(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const yyyy = date.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

// Parse tool guidance from agent response (comma-separated names/urls)
function parseToolGuidance(toolsName: string, toolsUrl: string): { name: string; url: string }[] {
  const names = toolsName.split(',').map(s => s.trim()).filter(Boolean)
  const urls = toolsUrl.split(',').map(s => s.trim()).filter(Boolean)
  return names.map((name, i) => ({ name, url: urls[i] || '' }))
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

    // Extract IDs from original ticket before calling agent
    const { userId, transId } = extractIds(rawInput)

    // Call SOPie Agent on GreenNode AgentBase
    const agentRes = await fetch(AGENT_ENDPOINT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket: rawInput }),
      signal: AbortSignal.timeout(120000),
    })

    if (!agentRes.ok) {
      const errText = await agentRes.text().catch(() => '')
      console.error('AgentBase error:', agentRes.status, errText)
      return NextResponse.json(
        { success: false, error: 'Lỗi kết nối tới SOPie Agent. Vui lòng thử lại.', errorCode: 'API_ERROR' },
        { status: 502 },
      )
    }

    const agentData = await agentRes.json()

    // agentData shape:
    // { issueType, rootCause, confidence, needEscalation, recommendedActions[], replyDraft, internalNote,
    //   templateCallChat, sourceKnowledge: { id, title, domain, linkSop } }

    const confidence: number = agentData.confidence ?? 0
    const recommendedActions: string[] = Array.isArray(agentData.recommendedActions)
      ? agentData.recommendedActions
      : []

    const sopTitle: string = agentData.sourceKnowledge?.title || ''
    const sopLink: string = agentData.sourceKnowledge?.linkSop || ''

    // Build source knowledge with link button
    const sourceKnowledge = agentData.sourceKnowledge
      ? [
          {
            sopId: agentData.sourceKnowledge.id || '',
            sopTitle,
            domain: agentData.sourceKnowledge.domain || '',
            relevance: 'Matched by SOPie Agent',
            ...(sopLink ? { link: sopLink } : {}),
          },
        ]
      : []

    // Build internal note — Vietnamese format, structured for Freshdesk
    const agentNote: string =
      typeof agentData.internalNote === 'string' ? agentData.internalNote : ''

    const internalNoteFullText = buildInternalNoteText({ userId, transId, agentNote })

    // Parse tool guidance
    const rawTool = agentData.toolGuidance || {}
    const toolGuidance = rawTool.guideline
      ? {
          guideline: rawTool.guideline,
          tools: parseToolGuidance(rawTool.toolsName || '', rawTool.toolsUrl || ''),
        }
      : undefined

    // MVP: use template_call_chat from SOP if available; fall back to AI-generated reply
    let customerReply: string =
      agentData.templateCallChat?.trim()
        ? agentData.templateCallChat
        : agentData.replyDraft || ''

    const recheckDays: number | null = agentData.recheckDays || null
    const txDate = parseDateFromTransId(transId)

    let appointmentDate: string | null = null
    if (recheckDays && txDate) {
      const deadline = addBusinessDays(txDate, recheckDays)
      appointmentDate = formatDateVN(deadline)
    }

    // Replace ____ placeholder in customerReply with calculated date
    if (appointmentDate && customerReply.includes('____')) {
      customerReply = customerReply.replace(/_{2,}/g, appointmentDate)
    }

    const result = {
      caseSummary: agentData.issueType || '',
      errorCodes: [],
      domain: agentData.sourceKnowledge?.domain || 'General',
      urgency: agentData.needEscalation ? 'Cao' : 'Trung bình',
      customerTone: agentData.customerTone || 'normal',
      processingDirection: recommendedActions.length > 0 ? recommendedActions : (agentData.rootCause ? [agentData.rootCause] : []),
      internalNote: {
        userId,
        transId,
        hasTransId: !!transId,
        issueSummary: agentData.issueType || '',
        rootCause: agentData.rootCause || '',
        suggestedAction: recommendedActions[0] || '',
        fullText: internalNoteFullText,
      },
      customerReply,
      replyToneNote: agentData.needEscalation ? 'Cần escalate lên CS2/QC' : '',
      sourceKnowledge,
      confidence,
      toolGuidance,
      appointmentDate: appointmentDate || null,
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
