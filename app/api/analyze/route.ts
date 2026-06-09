import { NextRequest, NextResponse } from 'next/server'
import { openai } from '@/lib/openai'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://sopie-search-tool.onrender.com'

const DOMAIN_CODE_MAP: Record<string, string> = {
  Account: 'AC', Payment: 'PY', Application: 'AP',
  Lending: 'LD', Promotion: 'PM', Travel: 'TV',
  Merchant: 'MC', General: 'GE',
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

QUAN TRONG khi trich xuat primarySearchQuery:
- Neu ticket co ma loi ky thuat (TPE code, Step result code, error code), uu tien dung ma loi lam searchQuery
- Ma loi thuong xuat hien: "Ma loi TPE: -333", "Step result: -1|21|111003|...", "error_code: XXX"
- Neu khong co ma loi, dung mo ta tinh huong ngan gon

Tra ve JSON (khong giai thich):
{
  "userId": "UserID neu co trong ticket, null neu khong",
  "transId": "TransID/Ma GD neu co trong ticket, null neu khong",
  "errorCodes": ["danh sach ma loi tim duoc, vi du: -333, 111003, FRAUD_USER"],
  "primarySearchQuery": "query ngan de tim SOP - uu tien ma loi, sau do mo ta tinh huong",
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
    let retrievedSOPs: any[] = []
    try {
      const searchResult = await searchSOPs(extracted.primarySearchQuery, extracted.domain)
      retrievedSOPs = searchResult.results || []

      // Fallback: neu search by error code khong ra, thu search by caseSummary
      if (retrievedSOPs.length === 0 && extracted.caseSummary) {
        const fallback = await searchSOPs(extracted.caseSummary, extracted.domain)
        retrievedSOPs = fallback.results || []
      }
    } catch (e) {
      console.error('Search failed:', e)
    }

    if (retrievedSOPs.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Khong tim thay SOP phu hop trong knowledge base. Vui long tra cuu thu cong hoac lien he QC team.',
        errorCode: 'NOT_FOUND',
      })
    }

    // Prompt 2: Reasoning + Internal Note + Customer Reply
    const sopContext = retrievedSOPs
      .slice(0, 3)
      .map((sop: any, i: number) =>
        `SOP ${i + 1}:\n- ID: ${sop.id}\n- Tieu de: ${sop.title}\n- Domain: ${sop.domain}\n- Feature: ${sop.feature || 'N/A'}\n- Nguyen nhan: ${sop.cause || 'N/A'}\n- Xu ly CS1: ${sop.solution?.level1 || 'N/A'}\n- Xu ly CS2: ${sop.solution?.level2 || 'N/A'}\n- Template mail: ${sop.templates?.email || 'N/A'}\n- Template chat: ${sop.templates?.chat || 'N/A'}`
      )
      .join('\n\n')

    const hasTransId = !!extracted.transId
    const customerTone: string = extracted.customerTone || 'normal'

    const reasoningRes = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.15,
      messages: [
        {
          role: 'system',
          content: `Ban la AI ho tro quyet dinh cho CS ZaloPay. Tao output day du dua tren ticket va SOP.

QUAN TRONG:
- Chi dung thong tin tu SOP duoc cung cap. Khong bia them chinh sach.
- customerTone: ${customerTone} (${extracted.toneReason || ''})
  - Neu "angry": template phai xin loi truoc, nhan manh ghi nhan van de, cam ket xu ly
  - Neu "neutral" hoac "normal": tone than thien, lich su, khong can xin loi qua nhieu
- Template phan hoi: dua tren template_call_chat/template_app_mail tu SOP nhung tu viet lai cho fit voi tinh huong cu the
- Viet bang tieng Viet co dau cho tat ca output

Tra ve JSON:
{
  "processingDirection": "Huong xu ly tong quan cua case (1-2 cau)",
  "internalNote": {
    "issueSummary": "Tom tat van de KH (ngan gon, dung ngon ngu noi bo)",
    "rootCause": "Nguyen nhan he thong/ky thuat",
    "suggestedAction": "Hanh dong CS nen thuc hien"
  },
  "customerReply": "Noi dung template phan hoi KH (tieng Viet, fit voi tone da detect)",
  "replyToneNote": "Giai thich ngan ve tone da chon va ly do",
  "confidence": 0,
  "sourceKnowledge": [
    { "sopId": "id", "sopTitle": "title", "domain": "domain", "relevance": "Ly do" }
  ]
}`,
        },
        {
          role: 'user',
          content: `TICKET GOC:\n${rawInput}\n\nCONTEXT TRICH XUAT:\n${JSON.stringify(extracted, null, 2)}\n\nSOP LIEN QUAN:\n${sopContext}`,
        },
      ],
      response_format: { type: 'json_object' },
    })

    const reasoning = JSON.parse(reasoningRes.choices[0].message.content || '{}')
    const confidence: number = reasoning.confidence ?? 0

    // Build formatted internal note text
    const noteLines: string[] = []
    noteLines.push(`UserID: ${extracted.userId || '(Khong tim thay - CS kiem tra tren CStool)'}`)

    if (hasTransId) {
      noteLines.push(`TransID: ${extracted.transId}`)
      noteLines.push(`[!] Luu y: Verify lai trang thai GD truoc khi phan hoi KH. Status tai thoi diem submit ticket co the da thay doi.`)
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
      customerReply: reasoning.customerReply,
      replyToneNote: reasoning.replyToneNote,
      sourceKnowledge: reasoning.sourceKnowledge || [],
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
