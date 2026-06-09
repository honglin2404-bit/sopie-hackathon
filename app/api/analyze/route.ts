import { NextRequest, NextResponse } from 'next/server'
import { openai } from '@/lib/openai'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://sopie-search-tool.onrender.com'

const DOMAIN_CODE_MAP: Record<string, string> = {
  Account: 'AC', Payment: 'PY', Application: 'AP',
  Lending: 'LD', Promotion: 'PM', Travel: 'TV',
  Merchant: 'MC', General: 'GE',
}

async function searchSOPs(query: string, domain: string, searchType: 'ai' | 'keyword' = 'ai') {
  const searchDomain =
    domain !== 'General' && DOMAIN_CODE_MAP[domain]
      ? `${domain} (${DOMAIN_CODE_MAP[domain]})`
      : 'all'

  const res = await fetch(`${BACKEND_URL}/api/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, domain: searchDomain, type: searchType, limit: 5 }),
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

    // Prompt 1: Context Extraction
    const extractionRes = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: `Ban la AI phan tich ticket CS cua ZaloPay. Trich xuat thong tin co cau truc.

QUAN TRONG khi trich xuat:
- errorCodes: lay tat ca ma loi ky thuat (TPE code, Step result code). Vi du: "-333", "111003", "FRAUD_USER"
- Ma loi thuong xuat hien: "Ma loi TPE: -333", "Step result: -1|21|111003|...", "error_code: XXX"
- primarySearchQuery: neu co ma loi, dung chinh xac ma loi do (vi du: "-333"). Neu khong co, dung mo ta ngan.

Tra ve JSON (khong giai thich):
{
  "userId": "UserID neu co trong ticket, null neu khong",
  "transId": "TransID/Ma GD neu co trong ticket, null neu khong",
  "errorCodes": ["ma loi 1", "ma loi 2"],
  "primarySearchQuery": "ma loi chinh xac hoac mo ta ngan",
  "caseSummary": "Tom tat van de 1-2 cau theo goc nhin CS",
  "domain": "Account | Payment | Application | Lending | Promotion | Travel | Merchant | General",
  "urgency": "Thap | Trung binh | Cao",
  "customerTone": "angry | neutral | normal",
  "toneReason": "Ly do detect tone"
}`,
        },
        { role: 'user', content: rawInput },
      ],
      response_format: { type: 'json_object' },
    })

    const extracted = JSON.parse(extractionRes.choices[0].message.content || '{}')

    if (!extracted.primarySearchQuery || !extracted.domain) {
      return NextResponse.json(
        { success: false, error: 'Khong the phan tich ticket. Vui long kiem tra lai noi dung.', errorCode: 'EXTRACTION_ERROR' },
        { status: 400 },
      )
    }

    // Knowledge Retrieval
    // Co ma loi -> keyword search truoc (chinh xac hon), fallback AI search
    // Khong co ma loi -> AI search truc tiep
    let retrievedSOPs: any[] = []
    const hasErrorCodes = extracted.errorCodes?.length > 0

    try {
      if (hasErrorCodes) {
        // Keyword search voi ma loi chinh xac
        const kwResult = await searchSOPs(extracted.primarySearchQuery, extracted.domain, 'keyword')
        retrievedSOPs = kwResult.results || []
      }

      // Fallback or primary: AI search
      if (retrievedSOPs.length === 0) {
        const aiResult = await searchSOPs(extracted.primarySearchQuery, extracted.domain, 'ai')
        retrievedSOPs = aiResult.results || []
      }

      // Fallback cuoi: AI search bang caseSummary
      if (retrievedSOPs.length === 0 && extracted.caseSummary) {
        const fallback = await searchSOPs(extracted.caseSummary, extracted.domain, 'ai')
        retrievedSOPs = fallback.results || []
      }
    } catch (e) {
      console.error('Search failed:', e)
    }

    if (retrievedSOPs.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Khong tim thay SOP phu hop. Vui long tra cuu thu cong hoac lien he QC team.',
        errorCode: 'NOT_FOUND',
      })
    }

    // Lay template tu SOP top-1
    const topSOP = retrievedSOPs[0]
    const sopTemplate: string = topSOP?.templates?.email || topSOP?.templates?.chat || ''

    // Build SOP context cho Prompt 2
    const sopContext = retrievedSOPs
      .slice(0, 3)
      .map((sop: any, i: number) =>
        `SOP ${i + 1}:\n- ID: ${sop.id}\n- Tieu de: ${sop.title}\n- Domain: ${sop.domain}\n- Nguyen nhan: ${sop.cause || 'N/A'}\n- Xu ly CS1: ${sop.solution?.level1 || 'N/A'}\n- Xu ly CS2: ${sop.solution?.level2 || 'N/A'}`
      )
      .join('\n\n')

    const hasTransId = !!extracted.transId
    const customerTone: string = extracted.customerTone || 'normal'

    // Prompt 2: Reasoning + Internal Note
    // customerReply duoc xu ly rieng: lay template tu SOP, chi AI-adjust neu KH angry
    const reasoningRes = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.1,
      messages: [
        {
          role: 'system',
          content: `Ban la AI ho tro quyet dinh cho CS ZaloPay. Chi dung thong tin tu SOP duoc cung cap. Khong bia them chinh sach.

Tra ve JSON:
{
  "processingDirection": "Huong xu ly tong quan cua case (1-2 cau)",
  "internalNote": {
    "issueSummary": "Tom tat van de KH (ngan gon, ngon ngu noi bo)",
    "rootCause": "Nguyen nhan he thong/ky thuat",
    "suggestedAction": "Hanh dong CS nen thuc hien"
  },
  "replyToneNote": "Giai thich tone da chon (vi du: KH binh thuong nen dung tone lich su; KH buc xuc nen xin loi truoc)",
  "customerReplyPrefix": "Cau xin loi them vao dau neu KH angry, hoac chuoi rong neu khong can",
  "confidence": <so 0-100>,
  "sourceKnowledge": [
    { "sopId": "id", "sopTitle": "title", "domain": "domain", "relevance": "Ly do" }
  ]
}`,
        },
        {
          role: 'user',
          content: `TICKET GOC:\n${rawInput}\n\nCONTEXT TRICH XUAT:\n${JSON.stringify(extracted, null, 2)}\n\nSOP LIEN QUAN:\n${sopContext}\n\ncustomerTone: ${customerTone}`,
        },
      ],
      response_format: { type: 'json_object' },
    })

    const reasoning = JSON.parse(reasoningRes.choices[0].message.content || '{}')
    const confidence: number = reasoning.confidence ?? 0

    // Merge link_sop from retrievedSOPs into sourceKnowledge
    const sourceKnowledgeWithLinks = (reasoning.sourceKnowledge || []).map((src: any) => {
      const match = retrievedSOPs.find((sop: any) => sop.id === src.sopId)
      return { ...src, link: match?.link || undefined }
    })

    // Build customerReply: dung template tu SOP, them prefix neu KH angry
    let customerReply = sopTemplate
    const prefix: string = reasoning.customerReplyPrefix || ''
    if (customerTone === 'angry' && prefix && sopTemplate) {
      customerReply = prefix + '\n\n' + sopTemplate
    } else if (!sopTemplate) {
      customerReply = prefix || '(Khong co template - CS tu soan phan hoi dua tren SOP)'
    }

    // Build internal note
    const noteLines: string[] = []
    noteLines.push(`UserID: ${extracted.userId || '(Khong tim thay - CS kiem tra tren CStool)'}`)

    if (hasTransId) {
      noteLines.push(`TransID: ${extracted.transId}`)
      noteLines.push(`[!] Luu y: Verify lai trang thai GD truoc khi phan hoi KH. Status tai thoi diem submit co the da thay doi.`)
    } else {
      noteLines.push(`TransID: Khong co`)
    }

    if (extracted.errorCodes?.length > 0) {
      noteLines.push(`Ma loi: ${extracted.errorCodes.join(', ')}`)
    }

    noteLines.push(``)
    noteLines.push(`Tom tat van de: ${reasoning.internalNote?.issueSummary || extracted.caseSummary}`)
    noteLines.push(`Nguyen nhan: ${reasoning.internalNote?.rootCause || 'N/A'}`)
    noteLines.push(`Huong xu ly de xuat: ${reasoning.internalNote?.suggestedAction || 'N/A'}`)

    const result = {
      caseSummary: extracted.caseSummary,
      errorCodes: extracted.errorCodes || [],
      domain: extracted.domain,
      urgency: extracted.urgency,
      customerTone: extracted.customerTone,
      processingDirection: reasoning.processingDirection,
      internalNote: {
        userId: extracted.userId,
        transId: extracted.transId,
        hasTransId,
        issueSummary: reasoning.internalNote?.issueSummary || '',
        rootCause: reasoning.internalNote?.rootCause || '',
        suggestedAction: reasoning.internalNote?.suggestedAction || '',
        fullText: noteLines.join('\n'),
      },
      customerReply,
      replyToneNote: reasoning.replyToneNote,
      sourceKnowledge: sourceKnowledgeWithLinks,
      confidence,
    }

    if (confidence < 60) {
      return NextResponse.json({
        success: false,
        error: `Do tin cay thap (${confidence}/100) - ket qua chi mang tinh tham khao`,
        errorCode: 'LOW_CONFIDENCE',
        result,
      })
  