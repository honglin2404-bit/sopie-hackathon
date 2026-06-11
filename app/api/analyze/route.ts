import { NextRequest, NextResponse } from 'next/server'

const AGENT_ENDPOINT_URL =
  process.env.AGENT_ENDPOINT_URL ||
  'https://endpoint-b040ca6a-70c1-4d31-80a9-8d43e294fe43.agentbase-runtime.aiplatform.vngcloud.vn/invocations'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { mode, ticketContent, issueDescription, attemptedSolutions } = body

    if (mode === 'fd' && !ticketContent?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Noi dung ticket khong duoc de trong', errorCode: 'EXTRACTION_ERROR' },
        { status: 400 },
      )
    }
    if (mode === 'free' && !issueDescription?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Mo ta van de khong duoc de trong', errorCode: 'EXTRACTION_ERROR' },
        { status: 400 },
      )
    }

    const rawInput =
      mode === 'fd'
        ? ticketContent
        : `Van de: ${issueDescription}${attemptedSolutions ? `\nDa thu: ${attemptedSolutions}` : ''}`

    // Call SOPie Agent on GreenNode AgentBase
    const agentRes = await fetch(AGENT_ENDPOINT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket: rawInput }),
      signal: AbortSignal.timeout(60000), // 60s timeout
    })

    if (!agentRes.ok) {
      const errText = await agentRes.text().catch(() => '')
      console.error('AgentBase error:', agentRes.status, errText)
      return NextResponse.json(
        { success: false, error: 'Loi ket noi toi SOPie Agent. Vui long thu lai.', errorCode: 'API_ERROR' },
        { status: 502 },
      )
    }

    const agentData = await agentRes.json()

    // agentData shape:
    // { issueType, rootCause, confidence, needEscalation, recommendedActions[], replyDraft, internalNote, sourceKnowledge: { id, title, domain } }

    const confidence: number = agentData.confidence ?? 0

    const sourceKnowledge = agentData.sourceKnowledge
      ? [
          {
            sopId: agentData.sourceKnowledge.id || '',
            sopTitle: agentData.sourceKnowledge.title || '',
            domain: agentData.sourceKnowledge.domain || '',
            relevance: 'Matched by SOPie Agent',
          },
        ]
      : []

    const recommendedActions: string[] = Array.isArray(agentData.recommendedActions)
      ? agentData.recommendedActions
      : []

    const internalNoteText: string =
      typeof agentData.internalNote === 'string'
        ? agentData.internalNote
        : JSON.stringify(agentData.internalNote || '')

    const result = {
      caseSummary: agentData.issueType || '',
      errorCodes: [],
      domain: agentData.sourceKnowledge?.domain || 'General',
      urgency: agentData.needEscalation ? 'Cao' : 'Trung binh',
      customerTone: 'normal',
      processingDirection: recommendedActions.join(' → ') || agentData.rootCause || '',
      internalNote: {
        userId: null,
        transId: null,
        hasTransId: false,
        issueSummary: agentData.issueType || '',
        rootCause: agentData.rootCause || '',
        suggestedAction: recommendedActions[0] || '',
        fullText: internalNoteText,
      },
      customerReply: agentData.replyDraft || '',
      replyToneNote: agentData.needEscalation ? 'Can escalate len CS2/QC' : '',
      sourceKnowledge,
      confidence,
    }

    if (confidence < 60) {
      return NextResponse.json({
        success: false,
        error: `Do tin cay thap (${confidence}/100) - ket qua chi mang tinh tham khao`,
        errorCode: 'LOW_CONFIDENCE',
        result,
      })
    }

    return NextResponse.json({ success: true, result })
  } catch (error: any) {
    console.error('Analyze error:', error)
    return NextResponse.json(
      { success: false, error: 'Loi he thong, vui long thu lai', errorCode: 'API_ERROR' },
      { status: 500 },
    )
  }
}
